-- Shopee integration — PR1: manual-first stock sync substrate
--
-- keycap-shop stays the single source of truth. Every change to a stock-bearing
-- row is recorded as an absolute "set Shopee stock = N" task in shopee_stock_queue.
-- The admin (PR2) reads the pending queue, applies the change on Shopee by hand,
-- and marks it done. If API access is ever obtained, a worker (PR3) drains the
-- same queue automatically — no rework here.
--
-- No changes to existing tables. Both existing mutation paths are captured by a
-- single AFTER UPDATE trigger:
--   1. place_order RPC        (customer orders)
--   2. src/lib/items-actions  (admin edits, service_role)
--
-- Assumes base_variants.id / social_platforms.id are uuid (Supabase default).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Maps a keycap-shop stock row to its Shopee listing. shopee_label is a human
-- hint for manual mode ("Base M / สีดำ"); the id columns are reserved for the
-- future API worker (PR3) and stay null until then.
create table if not exists public.shopee_item_map (
  id              uuid primary key default gen_random_uuid(),
  source_table    text not null check (source_table in ('base_variants', 'social_platforms')),
  source_id       uuid not null,
  shopee_label    text,
  shopee_item_id  bigint,
  shopee_model_id bigint,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (source_table, source_id)
);

comment on table public.shopee_item_map is
  'Maps a base_variants/social_platforms row to a Shopee listing. Manual mode uses shopee_label; item/model ids are reserved for the API worker (PR3).';

-- Pending "set Shopee stock = new_stock" tasks written by the trigger below.
create table if not exists public.shopee_stock_queue (
  id           uuid primary key default gen_random_uuid(),
  source_table text not null check (source_table in ('base_variants', 'social_platforms')),
  source_id    uuid not null,
  new_stock    integer not null,
  status       text not null default 'pending' check (status in ('pending', 'done')),
  created_at   timestamptz not null default now(),
  done_at      timestamptz
);

comment on table public.shopee_stock_queue is
  'Absolute stock-sync tasks. A row per stock change; status pending until applied on Shopee (manual in PR2, worker in PR3).';

-- Fast lookup for the admin "what is still pending" view.
create index if not exists shopee_stock_queue_pending_idx
  on public.shopee_stock_queue (created_at)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- Trigger: enqueue on stock change
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER so the insert succeeds regardless of which role triggered
-- the stock change (place_order's definer, or the service_role admin client).
create or replace function public.shopee_enqueue_stock_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stock is distinct from old.stock then
    insert into public.shopee_stock_queue (source_table, source_id, new_stock)
    values (tg_argv[0], new.id, new.stock);
  end if;
  return new;
end;
$$;

drop trigger if exists shopee_enqueue_stock_change on public.base_variants;
create trigger shopee_enqueue_stock_change
  after update of stock on public.base_variants
  for each row
  execute function public.shopee_enqueue_stock_change('base_variants');

drop trigger if exists shopee_enqueue_stock_change on public.social_platforms;
create trigger shopee_enqueue_stock_change
  after update of stock on public.social_platforms
  for each row
  execute function public.shopee_enqueue_stock_change('social_platforms');

-- ---------------------------------------------------------------------------
-- RLS: admin-only (service_role bypasses RLS; no public policies on purpose)
-- ---------------------------------------------------------------------------
alter table public.shopee_item_map    enable row level security;
alter table public.shopee_stock_queue enable row level security;
