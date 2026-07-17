alter table orders
  add column source text not null default 'customer',
  add column external_ref text;

alter table orders
  add constraint orders_source_check
  check (source in ('customer','shopee','walk_in','line','facebook','other'));

comment on column orders.source is 'Sales channel / how the order was created: customer = self-service online, others = admin-created (shopee, walk_in, line, facebook, other).';
comment on column orders.external_ref is 'Optional external reference for admin-created orders, e.g. the Shopee order number.';
