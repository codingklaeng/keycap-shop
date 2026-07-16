-- Shopee admin QoL:
--  - shopee_item_map.shopee_url : direct link to the Shopee listing (open + edit fast)
--  - shopee_stock_queue.old_stock : previous stock, so the admin sees the delta (3 -> 2)
--
-- old_stock is captured by the trigger going forward; existing pending rows keep null.

alter table public.shopee_item_map
  add column if not exists shopee_url text;

alter table public.shopee_stock_queue
  add column if not exists old_stock integer;

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
    insert into public.shopee_stock_queue (source_table, source_id, new_stock, old_stock)
    values (tg_argv[0], new.id, new.stock, old.stock);
  end if;
  return new;
end;
$$;
