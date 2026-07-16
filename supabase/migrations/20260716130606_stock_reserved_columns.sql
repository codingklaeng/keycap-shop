-- Stock reservation model — PR1: add the `reserved` counter to every stock-bearing table.
-- See docs/STOCK_RESERVATION.md.
--
-- Purely additive (default 0). No behaviour change yet: nothing reads `reserved`
-- until PR2, and stock is still deducted-on-order by the current RPCs.
--
-- No data backfill here: the only open order right now is a nameplate (no stock),
-- so there is nothing to convert. The real backfill (un-deduct open keycap/NFC
-- orders into `reserved`) must run atomically at the cutover (PR2/PR3), together
-- with recording the exact keycap_stock pieces each order consumed — order_letters
-- stores only the composite char, not the base+mark decomposition that place_order
-- actually deducts.

alter table public.base_variants    add column if not exists reserved integer not null default 0;
alter table public.keycap_stock      add column if not exists reserved integer not null default 0;
alter table public.social_platforms  add column if not exists reserved integer not null default 0;
alter table public.pendants          add column if not exists reserved integer not null default 0;

-- Guard against negative reservations.
alter table public.base_variants    add constraint base_variants_reserved_nonneg    check (reserved >= 0) not valid;
alter table public.keycap_stock      add constraint keycap_stock_reserved_nonneg     check (reserved >= 0) not valid;
alter table public.social_platforms  add constraint social_platforms_reserved_nonneg check (reserved >= 0) not valid;
alter table public.pendants          add constraint pendants_reserved_nonneg         check (reserved >= 0) not valid;
