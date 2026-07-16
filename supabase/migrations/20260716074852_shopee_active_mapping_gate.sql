-- Shopee integration — refinement: gate the enqueue on an ACTIVE mapping.
--
-- Before: every stock change on base_variants/social_platforms enqueued a task,
-- so items NOT sold on Shopee kept creating noise in the pending queue.
-- After: only enqueue when the item has an active row in shopee_item_map.
--
-- The initial "set Shopee = current stock" task when an item is first mapped
-- (and clearing pending when sync is turned off) is handled in saveShopeeMap
-- (src/lib/shopee-actions.ts), so mapping an item still surfaces one task.
--
-- Triggers are unchanged; only the function body is replaced.

create or replace function public.shopee_enqueue_stock_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stock is distinct from old.stock
     and exists (
       select 1
       from public.shopee_item_map m
       where m.source_table = tg_argv[0]
         and m.source_id = new.id
         and m.active
     )
  then
    insert into public.shopee_stock_queue (source_table, source_id, new_stock)
    values (tg_argv[0], new.id, new.stock);
  end if;
  return new;
end;
$$;
