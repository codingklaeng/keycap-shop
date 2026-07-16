-- Stock reservation — expose `available = stock - reserved` as a generated column
-- so the storefront can filter and show "เหลือ N" without recomputing everywhere.
-- Additive; STORED so PostgREST can filter/select it.

alter table public.base_variants    add column if not exists available integer generated always as (stock - reserved) stored;
alter table public.keycap_stock      add column if not exists available integer generated always as (stock - reserved) stored;
alter table public.social_platforms  add column if not exists available integer generated always as (stock - reserved) stored;
alter table public.pendants          add column if not exists available integer generated always as (stock - reserved) stored;
