-- Stock reservation model — PR2: atomic cutover from deduct-on-order to
-- reserve → consume(at picked_up) → release(on cancel). See docs/STOCK_RESERVATION.md.
--
-- This MUST be one atomic migration: place_* (reserve), the status trigger
-- (consume/release), cancel_order, and the Shopee trigger (mirror available) all
-- have to agree at once, or stock corrupts. Test on a Supabase branch before prod.
--
-- Assumes PR1 already added the `reserved` columns.

-- =====================================================================
-- 1. Consumed-units ledger — the exact stock units each order holds.
--    Solves the decomposition gap: order_letters only stores the composite
--    char, but place_order consumes base + upper/lower marks separately.
-- =====================================================================
create table if not exists public.order_stock_usage (
  order_id     uuid not null references public.orders(id) on delete cascade,
  source_table text not null check (source_table in ('base_variants','keycap_stock','social_platforms','pendants')),
  source_id    uuid not null,
  qty          integer not null check (qty > 0),
  primary key (order_id, source_table, source_id)
);
create index if not exists order_stock_usage_order_idx on public.order_stock_usage(order_id);

-- =====================================================================
-- 2. Status-transition trigger — the single place that moves real stock.
--    Reads the order's usage rows and applies per-unit deltas.
--      → picked_up  : consume   (stock -= qty, reserved -= qty)
--      → cancelled  : release   (reserved -= qty)
--      picked_up → back (reopen): re-reserve (stock += qty, reserved += qty)
--      cancelled → back (uncancel): re-reserve (reserved += qty)
--    pending/in_progress/ready shuffles: no stock effect.
-- =====================================================================
create or replace function public.apply_order_stock_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d_stock int;
  d_res int;
  r record;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'picked_up' and old.status <> 'picked_up' then
    d_stock := -1; d_res := -1;                    -- consume
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    d_stock := 0;  d_res := -1;                     -- release
  elsif old.status = 'picked_up' and new.status not in ('picked_up','cancelled') then
    d_stock := 1;  d_res := 1;                      -- reopen a pickup
  elsif old.status = 'cancelled' and new.status <> 'cancelled' then
    d_stock := 0;  d_res := 1;                      -- uncancel
  else
    return new;                                     -- no stock effect
  end if;

  for r in select source_table, source_id, qty from public.order_stock_usage where order_id = new.id loop
    execute format('update public.%I set stock = stock + $1, reserved = reserved + $2 where id = $3', r.source_table)
      using d_stock * r.qty, d_res * r.qty, r.source_id;
  end loop;
  return new;
end;
$$;

drop trigger if exists apply_order_stock_transition on public.orders;
create trigger apply_order_stock_transition
  after update of status on public.orders
  for each row execute function public.apply_order_stock_transition();

-- =====================================================================
-- 3. place_order — reserve instead of deduct; availability = stock - reserved;
--    record consumed units in order_stock_usage.
-- =====================================================================
create or replace function public.place_order(
  p_base_variant_id uuid, p_pendant_id uuid, p_letters jsonb,
  p_layout text default 'horizontal', p_note text default null,
  p_customer_name text default null, p_customer_contact text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_variant base_variants%rowtype;
  v_size base_sizes%rowtype;
  v_pendant pendants%rowtype;
  v_total numeric(10,2) := 0;
  v_addon numeric(10,2);
  v_count int;
  v_order_id uuid;
  v_queue text;
  v_seq int;
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_text text;
  v_layout text;
  v_ks keycap_stock%rowtype;
  r record;
begin
  v_count := coalesce(jsonb_array_length(p_letters), 0);
  if v_count = 0 then raise exception 'EMPTY_TEXT'; end if;
  if coalesce(btrim(p_customer_name), '') = '' then raise exception 'CUSTOMER_NAME_REQUIRED'; end if;
  v_layout := case when p_layout = 'vertical' then 'vertical' else 'horizontal' end;

  select addon_price into v_addon from keycap_config where id = 1;
  v_addon := coalesce(v_addon, 0);

  -- base: check available (stock - reserved)
  select * into v_variant from base_variants where id = p_base_variant_id and active for update;
  if not found then raise exception 'BASE_VARIANT_INVALID'; end if;
  if v_variant.stock - v_variant.reserved < 1 then raise exception 'BASE_OUT'; end if;

  select * into v_size from base_sizes where id = v_variant.base_size_id;
  if v_count > v_size.max_chars then raise exception 'TEXT_TOO_LONG'; end if;

  if p_pendant_id is not null then
    select * into v_pendant from pendants where id = p_pendant_id and active for update;
    if not found then raise exception 'PENDANT_INVALID'; end if;
    if v_pendant.stock - v_pendant.reserved < 1 then raise exception 'PENDANT_OUT'; end if;
  end if;

  for r in select distinct (e->>'keycap_color_id')::uuid as color_id from jsonb_array_elements(p_letters) e loop
    if not exists (select 1 from keycap_colors where id = r.color_id and active and base_type_id = v_size.base_type_id) then
      raise exception 'KEYCAP_COLOR_INVALID';
    end if;
  end loop;

  -- price (unchanged)
  v_total := v_variant.price + coalesce(v_pendant.price, 0);
  select v_total + coalesce(sum(kc.price), 0) into v_total
  from jsonb_array_elements(p_letters) e join keycap_colors kc on kc.id = (e->>'keycap_color_id')::uuid;
  select v_total + v_addon * coalesce(sum(
    (case when coalesce(e->>'upper','') <> '' then 1 else 0 end) +
    (case when coalesce(e->>'lower','') <> '' then 1 else 0 end)), 0) into v_total
  from jsonb_array_elements(p_letters) e;

  insert into queue_counters(queue_date, product_type, last_seq) values (v_today, 'keycap', 1)
  on conflict (queue_date, product_type) do update set last_seq = queue_counters.last_seq + 1
  returning last_seq into v_seq;
  v_queue := 'K' || lpad(v_seq::text, 3, '0');

  select string_agg(e->>'char', '' order by (e->>'position')::int) into v_text from jsonb_array_elements(p_letters) e;

  insert into orders(queue_number, queue_date, status, text, layout, base_size_id, base_color_id, base_variant_id, pendant_id, total_price, note, customer_name, customer_contact)
  values (v_queue, v_today, 'pending', v_text, v_layout, v_variant.base_size_id, v_variant.base_color_id, p_base_variant_id, p_pendant_id, v_total, p_note, btrim(p_customer_name), nullif(btrim(p_customer_contact), ''))
  returning id into v_order_id;

  insert into order_letters(order_id, position, char, keycap_color_id)
  select v_order_id, (e->>'position')::int, e->>'char', (e->>'keycap_color_id')::uuid from jsonb_array_elements(p_letters) e;

  -- keycap pieces: base + upper/lower marks, grouped by (char, color). Reserve each
  -- and record the exact keycap_stock unit in order_stock_usage.
  for r in
    select ch, color_id, count(*)::int as qty from (
      select e->>'base' as ch, (e->>'keycap_color_id')::uuid as color_id from jsonb_array_elements(p_letters) e
      union all
      select m, (e->>'keycap_color_id')::uuid from jsonb_array_elements(p_letters) e, lateral regexp_split_to_table(coalesce(e->>'upper',''), '') m where m <> ''
      union all
      select m, (e->>'keycap_color_id')::uuid from jsonb_array_elements(p_letters) e, lateral regexp_split_to_table(coalesce(e->>'lower',''), '') m where m <> ''
    ) pieces
    where ch is not null and ch <> ''
    group by ch, color_id
  loop
    select * into v_ks from keycap_stock where char = r.ch and color_id = r.color_id for update;
    if not found or v_ks.stock - v_ks.reserved < r.qty then raise exception 'KEYCAP_OUT:%', r.ch; end if;
    update keycap_stock set reserved = reserved + r.qty where id = v_ks.id;
    insert into order_stock_usage(order_id, source_table, source_id, qty)
      values (v_order_id, 'keycap_stock', v_ks.id, r.qty)
      on conflict (order_id, source_table, source_id) do update set qty = order_stock_usage.qty + excluded.qty;
  end loop;

  -- reserve base + pendant, record usage
  update base_variants set reserved = reserved + 1 where id = p_base_variant_id;
  insert into order_stock_usage(order_id, source_table, source_id, qty) values (v_order_id, 'base_variants', p_base_variant_id, 1);
  if p_pendant_id is not null then
    update pendants set reserved = reserved + 1 where id = p_pendant_id;
    insert into order_stock_usage(order_id, source_table, source_id, qty) values (v_order_id, 'pendants', p_pendant_id, 1);
  end if;

  return jsonb_build_object('order_id', v_order_id, 'queue_number', v_queue, 'total_price', v_total);
end;
$$;

-- =====================================================================
-- 4. place_nfc_order — reserve the social_platforms unit + record usage.
-- =====================================================================
create or replace function public.place_nfc_order(
  p_platform_id uuid, p_social_value text, p_note text default null,
  p_customer_name text default null, p_customer_contact text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_p social_platforms%rowtype;
  v_clean text; v_url text;
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_seq int; v_queue text; v_order_id uuid;
begin
  v_clean := btrim(coalesce(p_social_value, ''));
  if v_clean = '' then raise exception 'EMPTY_VALUE'; end if;

  select * into v_p from social_platforms where id = p_platform_id and active for update;
  if not found then raise exception 'PLATFORM_INVALID'; end if;
  if v_p.stock - v_p.reserved < 1 then raise exception 'PLATFORM_OUT'; end if;

  if v_clean ~* '^https?://' then v_url := v_clean;
  else v_url := replace(v_p.url_template, '{id}', ltrim(v_clean, '@')); end if;

  update social_platforms set reserved = reserved + 1 where id = p_platform_id;

  insert into queue_counters(queue_date, product_type, last_seq) values (v_today, 'nfc', 1)
  on conflict (queue_date, product_type) do update set last_seq = queue_counters.last_seq + 1
  returning last_seq into v_seq;
  v_queue := 'N' || lpad(v_seq::text, 3, '0');

  insert into orders(queue_number, queue_date, status, text, product_type, total_price, note, customer_name, customer_contact)
  values (v_queue, v_today, 'pending', v_clean, 'nfc', v_p.price, p_note, nullif(btrim(p_customer_name), ''), nullif(btrim(p_customer_contact), ''))
  returning id into v_order_id;

  insert into order_nfc(order_id, platform_id, social_value, social_url) values (v_order_id, p_platform_id, v_clean, v_url);
  insert into order_stock_usage(order_id, source_table, source_id, qty) values (v_order_id, 'social_platforms', p_platform_id, 1);

  return jsonb_build_object('order_id', v_order_id, 'queue_number', v_queue, 'total_price', v_p.price);
end;
$$;

-- =====================================================================
-- 5. cancel_order — just set cancelled; the status trigger releases the reservation.
-- =====================================================================
create or replace function public.cancel_order(p_id uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_status order_status;
begin
  select status into v_status from orders where id = p_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_status = 'cancelled' then return; end if;
  if v_status = 'picked_up' then raise exception 'ALREADY_PICKED_UP'; end if;
  update orders set status = 'cancelled' where id = p_id;  -- trigger releases
end;
$$;

-- =====================================================================
-- 6. Shopee sync must mirror AVAILABLE (stock - reserved), not raw stock.
-- =====================================================================
create or replace function public.shopee_enqueue_stock_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.stock - new.reserved) is distinct from (old.stock - old.reserved)
     and exists (
       select 1 from public.shopee_item_map m
       where m.source_table = tg_argv[0] and m.source_id = new.id and m.active
     )
  then
    insert into public.shopee_stock_queue (source_table, source_id, new_stock, old_stock)
    values (tg_argv[0], new.id, new.stock - new.reserved, old.stock - old.reserved);
  end if;
  return new;
end;
$$;

drop trigger if exists shopee_enqueue_stock_change on public.base_variants;
create trigger shopee_enqueue_stock_change
  after update of stock, reserved on public.base_variants
  for each row execute function public.shopee_enqueue_stock_change('base_variants');

drop trigger if exists shopee_enqueue_stock_change on public.social_platforms;
create trigger shopee_enqueue_stock_change
  after update of stock, reserved on public.social_platforms
  for each row execute function public.shopee_enqueue_stock_change('social_platforms');

-- =====================================================================
-- 7. Backfill open orders (pending/in_progress/ready): un-deduct into reserved,
--    and record usage. Under the old model these already deducted stock at order
--    time; convert to physical-on-hand + reserved without changing availability.
--    keycap backfill can't be reconstructed from order_letters (no decomposition);
--    guard: refuse if any open keycap order exists (none right now → passes).
-- =====================================================================
do $$
begin
  if exists (
    select 1 from orders o join order_letters ol on ol.order_id = o.id
    where o.status in ('pending','in_progress','ready')
  ) then
    raise exception 'BACKFILL_KEYCAP_ORDERS_PRESENT: open keycap orders exist; backfill keycap_stock reservations manually';
  end if;

  -- base_variants
  insert into order_stock_usage(order_id, source_table, source_id, qty)
  select o.id, 'base_variants', o.base_variant_id, 1
  from orders o where o.status in ('pending','in_progress','ready') and o.base_variant_id is not null
  on conflict do nothing;
  update base_variants bv set stock = stock + 1, reserved = reserved + 1
  from orders o where o.base_variant_id = bv.id and o.status in ('pending','in_progress','ready');

  -- pendants
  insert into order_stock_usage(order_id, source_table, source_id, qty)
  select o.id, 'pendants', o.pendant_id, 1
  from orders o where o.status in ('pending','in_progress','ready') and o.pendant_id is not null
  on conflict do nothing;
  update pendants p set stock = stock + 1, reserved = reserved + 1
  from orders o where o.pendant_id = p.id and o.status in ('pending','in_progress','ready');

  -- social_platforms (NFC)
  insert into order_stock_usage(order_id, source_table, source_id, qty)
  select onf.order_id, 'social_platforms', onf.platform_id, 1
  from order_nfc onf join orders o on o.id = onf.order_id
  where o.status in ('pending','in_progress','ready')
  on conflict do nothing;
  update social_platforms sp set stock = stock + 1, reserved = reserved + 1
  from order_nfc onf join orders o on o.id = onf.order_id
  where onf.platform_id = sp.id and o.status in ('pending','in_progress','ready');
end $$;
