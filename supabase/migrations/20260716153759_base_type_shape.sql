-- Base type gains a `shape` that drives how the base plate is rendered in the
-- customer preview: rounded_square (default) | circle | hexagon | octagon.

alter table public.base_types
  add column if not exists shape text not null default 'rounded_square';

alter table public.base_types
  add constraint base_types_shape_check
  check (shape in ('rounded_square','circle','hexagon','octagon')) not valid;

-- Surface the order's base-type shape in get_order so the tracking-page preview
-- renders the right silhouette. Only the base_shape field is added.
create or replace function public.get_order(p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v jsonb;
begin
  select jsonb_build_object(
    'id', o.id,
    'queue_number', o.queue_number,
    'status', o.status,
    'text', o.text,
    'total_price', o.total_price,
    'paid_amount', o.paid_amount,
    'deposit_required', case when o.product_type = 'nameplate'
      then (select round(o.total_price * coalesce(nc.min_deposit_percent, 0) / 100.0, 2) from nameplate_config nc where nc.id = 1)
      else 0 end,
    'note', o.note,
    'created_at', o.created_at,
    'product_type', o.product_type,
    'layout', o.layout,
    'customer_name', o.customer_name,
    'base_shape', (
      select bt.shape from base_sizes bs join base_types bt on bt.id = bs.base_type_id
      where bs.id = o.base_size_id),
    'base_size', (
      select jsonb_build_object('label', coalesce(bt.name || ' · ', '') || bs.max_chars || ' ช่อง')
      from base_sizes bs left join base_types bt on bt.id = bs.base_type_id
      where bs.id = o.base_size_id),
    'base_color', (select jsonb_build_object('name', bc.name, 'swatch', bc.swatch) from base_colors bc where bc.id = o.base_color_id),
    'pendant', (select jsonb_build_object('name', p.name) from pendants p where p.id = o.pendant_id),
    'letters', (
      select coalesce(jsonb_agg(jsonb_build_object('position', ol.position, 'char', ol.char,
        'color', (select jsonb_build_object('name', kc.name, 'key_color', kc.key_color, 'text_color', kc.text_color) from keycap_colors kc where kc.id = ol.keycap_color_id))
        order by ol.position), '[]'::jsonb)
      from order_letters ol where ol.order_id = o.id),
    'nfc', (
      select jsonb_build_object('platform', sp.name, 'icon', sp.icon, 'image', sp.image_url, 'value', onf.social_value, 'url', onf.social_url)
      from order_nfc onf left join social_platforms sp on sp.id = onf.platform_id
      where onf.order_id = o.id),
    'nameplate', (
      select jsonb_build_object('text', np.text, 'spec', np.spec)
      from order_nameplate np where np.order_id = o.id)
  ) into v from orders o where o.id = p_id;
  return v;
end;
$function$;
