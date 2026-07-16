# Stock Reservation Model — Design Doc

Status: **DRAFT / plan only.** Target repo: `codingklaeng/keycap-shop`.
Goal: web orders should **reserve** stock (not consume it immediately), block when the
available quantity is insufficient, **deduct for real when the item is made**, and **release**
the reservation when an order is cancelled.

---

## 1. Current behaviour (verified from the live RPCs)

`place_order` / `place_nfc_order` / `place_nameplate_order` and `cancel_order` are Postgres
`SECURITY DEFINER` functions. Confirmed from their source:

- **Deduct-on-order.** `place_order` checks `stock < 1` (→ `BASE_OUT` / `PENDANT_OUT`) and deducts
  letters atomically with `update keycap_stock set stock = stock - qty where … and stock >= qty;
  if not found → KEYCAP_OUT:<char>`. It then `base_variants.stock -= 1` and `pendants.stock -= 1`.
  **Real stock drops the moment the order is placed**, while the order is created as `pending`.
- A keycap letter consumes **one `keycap_stock` unit per glyph piece** — base char **plus** each
  stacked upper/lower mark (Thai vowels/tones) — grouped by `(char, keycap_color_id)`.
- **`cancel_order` restocks** everything back (keycap/base/pendant, and NFC via
  `order_nfc.platform_id`) and sets `cancelled`. It **refuses** to cancel a `picked_up` order
  (`ALREADY_PICKED_UP`).
- There is **no `reserved` concept** anywhere.

**Order statuses:** `pending` (รอคิว) → `in_progress` (กำลังทำ) → `ready` (พร้อมรับ) →
`picked_up` (รับแล้ว), plus `cancelled` (ยกเลิก). **`ready` = "ทำเสร็จ"** (made, awaiting pickup).

**Line-item storage (all normalised):** `orders(base_variant_id, pendant_id, …)`,
`order_letters(order_id, position, char, keycap_color_id)`, `order_nfc(order_id, platform_id)`,
`order_nameplate(order_id, text, spec jsonb)`. Nameplate is made-to-order → **no stock**.

Net: today's model is already "reserve-like" for availability (available == `stock` because it
deducts at order time; cancel restores). The change we want is to make **`stock` mean physical
on-hand** and track commitments separately as `reserved`.

---

## 2. Target model

Track a **`reserved`** quantity per stock unit. Define:

```
available = stock − reserved         (what a new order may take)
stock     = physical units on hand   (only changes when an item is actually made, or restocked)
reserved  = units committed to open orders not yet made
```

### Stock effect per order lifecycle step

Decision: **real stock is consumed at `picked_up` ("รับแล้ว")**, so a unit stays *reserved*
through `pending` → `in_progress` → `ready`. This makes cancellation uniform: any cancel before
pickup is just a reservation release (nothing was deducted yet).

| Step | Trigger | Effect on each consumed unit |
|------|---------|------------------------------|
| **Place order** | `place_*` (creates `pending`) | check `available ≥ qty`, else `*_OUT`; then `reserved += qty` |
| **→ picked_up** ("รับแล้ว") | `ready` → `picked_up` | `stock -= qty`, `reserved -= qty` (consume) |
| **→ cancelled** from `pending` / `in_progress` / `ready` | cancel before pickup | `reserved -= qty` (release; `stock` untouched → the unit becomes available again) |
| **reopen** `picked_up` → earlier (rare) | undo a pickup | `stock += qty`, `reserved += qty` |

`available` moves by exactly `qty` at *place order* (down) and *cancel* (up), and is unchanged at
`ready` and `picked_up` (at pickup, `stock` and `reserved` drop together). So customer-facing
availability behaves the same as today, but `stock` now reflects **physical on-hand** right up to
pickup. Cancelling a `ready` (already-made) order releases its reservation — availability returns,
matching today's "คืนของ"; if the physical item was scrapped, the owner adjusts `stock` manually.

**Consumed units of a keycap order:** base_variant ×1, pendant ×0–1, and the `keycap_stock`
units from `order_letters` (base + upper + lower marks per position, grouped by char+color).
**NFC order:** the `social_platforms` unit from `order_nfc`. **Nameplate:** none.

---

## 3. Schema changes

Add a reserved counter to every stock-bearing table:

```sql
alter table public.base_variants    add column reserved integer not null default 0;
alter table public.keycap_stock      add column reserved integer not null default 0;
alter table public.social_platforms  add column reserved integer not null default 0;
alter table public.pendants          add column reserved integer not null default 0;
-- optional guard: check (reserved >= 0)
```

No existing columns change meaning except that reads which used `stock` for *availability* must
switch to `stock - reserved` (see §5).

---

## 4. Where the logic lives

**Keep the availability check + reservation inside the `place_*` RPCs** (they already hold the
right `FOR UPDATE` row locks). Change every `stock -= n` to `reserved += n`, and every
`stock < n` / `stock >= n` guard to `(stock - reserved) < n` / `(stock - reserved) >= n`. Error
names stay the same (`BASE_OUT`, `PENDANT_OUT`, `KEYCAP_OUT:<char>`).

**Move the consume/release logic into a status-transition trigger** on `orders` —
`AFTER UPDATE OF status` (and it fires for every caller: the admin `updateOrderStatus` action and
`cancel_order` alike). The trigger reads the order's consumed units (same joins `cancel_order`
uses today) and applies the §2 table based on `OLD.status → NEW.status`. This centralises all
post-placement stock math in one place and keeps it consistent regardless of who changes the
status.

**`cancel_order`** then simplifies to: guard `picked_up`, set `status = 'cancelled'`, and let the
trigger do the release/restock. (Its current inline restock logic moves into the trigger.)

**`place_nfc_order`** gets the same reserve-instead-of-deduct treatment for `social_platforms`.
`place_nameplate_order` is unaffected (no stock).

---

## 5. Availability everywhere (`stock − reserved`)

- **RPCs:** the `place_*` guards above.
- **Web wizard (`src/components/Wizard.tsx`):** availability currently derives from `stock`
  (`keycap_stock.stock > 0`, in-stock variants, `colorsForUnit`). The catalog read must expose
  `available = stock − reserved` and the wizard must use it, so customers can't pick something
  that's fully reserved. (The RPC still enforces it, but the UI should match.)
- **Show "เหลือ N" to customers** (confirmed): display the remaining `available` next to each
  choice — base color / size variant, letter color, pendant, NFC platform — so the customer sees
  scarcity. `0` → the option is disabled/hidden as today.
- **Catalog loader (`src/lib/catalog.ts`):** select `reserved` alongside `stock` (or compute
  `available` in the query) for base_variants / keycap_stock / social_platforms / pendants.

---

## 6. Interaction with Shopee sync ‼️

Today the Shopee trigger fires on `base_variants.stock` / `social_platforms.stock` and pushes the
**raw stock**, which currently equals availability (deduct-on-order). **Under reservation, raw
`stock` overstates availability during the open-order window → Shopee would oversell.**

Fix: Shopee must mirror **`available = stock − reserved`**.

- Change `shopee_enqueue_stock_change` to fire `AFTER UPDATE OF stock, reserved` and compare
  `(new.stock - new.reserved)` vs `(old.stock - old.reserved)`; enqueue the new **available** as
  `new_stock`.
- `shopee_stock_queue.new_stock` keeps its meaning ("value to set on Shopee") but now carries
  available, not raw stock.
- `keycap_stock` stays out of Shopee (unchanged); pendants are not on Shopee.

Effect: reserving an item on the web (order placed) immediately lowers the Shopee target →
no oversell; cancelling raises it back.

---

## 7. Backfill (one-time, at migration)

Existing **open** orders (`pending`, `in_progress`, **`ready`**) already deducted their stock
under the old model. Since the new model keeps them *reserved* until `picked_up`, move them across
without changing availability:

```
for each order in (pending, in_progress, ready):
  for each consumed unit: stock += qty ;  reserved += qty
```

`picked_up` orders are consumed under both models (no change); `cancelled` already restored (no
change). Because line items are normalised, this backfill is exact. Run it in the same migration
that adds the columns, before the new RPCs go live.

---

## 8. Reconciliation (drift guard)

`reserved` is a denormalised counter; a missed transition could drift it. Because line items are
normalised, the true value is derivable — a periodic check (or an admin button) can compare and
repair:

```
expected_reserved(unit) = Σ qty over orders in (pending, in_progress, ready) that consume that unit
```

If `reserved <> expected`, flag/repair. Cheap to run for a small shop.

---

## 9. Rollout (small PRs; test on a Supabase branch first — this is the live order path)

1. **PR1** — migration: add `reserved` columns + backfill from open orders. No behaviour change
   yet (nothing reads `reserved`).
2. **PR2** — rewrite `place_order` / `place_nfc_order` to check `available` and `reserved += n`;
   update catalog + wizard to use `available`.
3. **PR3** — status-transition trigger (consume at `ready`, release/restock at `cancelled`,
   reopen handling); slim down `cancel_order` to defer to it.
4. **PR4** — Shopee trigger mirrors `available` (§6).
5. **PR5** — reconciliation check + optional admin "ตรวจ/ซ่อม reserved" button.

**Testing:** exercise on a Supabase **branch** (isolated copy) — place → ready → picked_up, place
→ cancel, place → over-reserve (expect `*_OUT`), and verify Shopee `available` math — before
touching production. Order flow is customer-facing and must not break.

---

## 10. Decisions (confirmed)

1. **Consume point = `picked_up` ("รับแล้ว").** Stock is deducted only when the customer receives
   the order. Units stay reserved through `pending`/`in_progress`/`ready`.
2. **Cancel restores availability (as today).** Since nothing is deducted before pickup, any cancel
   before `picked_up` just releases the reservation → the unit is available again. (`picked_up`
   itself cannot be cancelled — unchanged `ALREADY_PICKED_UP` guard.)
3. **Show "เหลือ N" to customers** on the storefront next to each choice.
