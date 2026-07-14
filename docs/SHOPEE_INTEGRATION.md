# Shopee Integration — Design Doc

Status: **DRAFT / plan only** (no code yet). Target repo: `codingklaeng/keycap-shop`.
Goal: sell keycap-shop products on **Shopee** using the **single stock** that keycap-shop
already owns — Shopee is a mirror, not a second source of truth.

---

## 1. Principles

1. **keycap-shop is the single source of truth.** Shopee is a mirror of stock. We never let
   Shopee become a second inventory.
2. **Push stock as an ABSOLUTE value** — set Shopee stock = the current keycap-shop value,
   never apply a `+/-` delta. This is idempotent: loops, retries, and replays are safe, and it
   tolerates orders that originate on Shopee (the next push simply re-asserts the true number).
3. **Touch existing code minimally.** Use a **Postgres `AFTER UPDATE` trigger** on the
   stock-bearing tables so we do **not** edit `place_order` (the order RPC) or
   `src/lib/items-actions.ts` (admin edits). Both existing mutation paths flow through the same
   trigger for free.

---

## 2. What sells on Shopee & how stock maps

| Shopee listing        | keycap-shop table    | Sync? | Notes |
|-----------------------|----------------------|-------|-------|
| **NFC keychain**      | `social_platforms.stock` | ✅ auto | 1 listing ↔ 1 row. |
| **keycap keychain**   | `base_variants.stock`    | ✅ auto | Shopee variations: จำนวนตัว (size) × สี (color) ↔ a `base_variant` row. The **base** is the slow/limited component and the stock gate; letters are not. Letter text is sent by the buyer via Shopee chat. |
| **3D nameplate**      | — | ❌ **no auto-sync** | Made-to-order, per thickness/layer = a separate listing. Confirmed by owner: nameplate stock is **not** synced. |
| letter tiles          | `keycap_stock` | ❌ excluded | Reprinted quickly; owner tracks these as stats, they are not a Shopee stock gate. |

**Scope of auto-sync: `base_variants` + `social_platforms` only.**

---

## 3. Stock mutation points (the push hook points)

Stock is mutated in exactly two places today — both are covered by a single DB trigger:

1. **`place_order` RPC** (Postgres transaction) — a customer order deducts stock. Called from
   `src/components/Wizard.tsx`.
2. **`src/lib/items-actions.ts`** server actions — admin manual edits via the `service_role`
   client: `saveBaseVariant`, `addVariantsBatch`, `saveSocialPlatform`, … .

Because both write to `base_variants` / `social_platforms`, an `AFTER UPDATE` trigger on those
tables captures every stock change without editing either path.

---

## 4. New Supabase objects (NO changes to existing tables)

- **`shopee_shop`** — OAuth tokens per shop: `shop_id`, `access_token`, `refresh_token`,
  `expires_at`, timestamps.
- **`shopee_item_map`** — maps a keycap-shop row to a Shopee listing:
  `source_table` ('base_variants' | 'social_platforms'), `source_id`, `shopee_item_id`,
  `shopee_model_id` (variation), unique on (`source_table`, `source_id`).
- **`shopee_stock_queue`** — the trigger writes a row here on every stock change:
  `source_table`, `source_id`, `new_stock`, `status` ('pending' | 'done' | 'error'),
  `attempts`, `created_at`. Worker drains it.
- **`shopee_orders`** — orders pulled from Shopee: `order_sn` (unique), `buyer_note`, `status`,
  raw payload, `synced_at`.

The `AFTER UPDATE` trigger on `base_variants` and `social_platforms` inserts into
`shopee_stock_queue` only when `NEW.stock IS DISTINCT FROM OLD.stock`.

---

## 5. Flows

### (a) Auth
OAuth connect once per shop (redirect to Shopee, store tokens in `shopee_shop`) + scheduled
token refresh before `expires_at`.

### (b) Stock push (keycap-shop → Shopee)
```
stock UPDATE (order or admin edit)
  → AFTER UPDATE trigger
  → INSERT shopee_stock_queue (new_stock, pending)
  → Edge Function worker (pg_cron every N min) drains pending rows
  → look up shopee_item_map → Shopee update_stock (ABSOLUTE new_stock)
  → mark row done  (stock 0 ⇒ listing goes out-of-stock)
```

### (c) Order pull (Shopee → keycap-shop)
```
pg_cron → get_order_list / get_order_detail
  → upsert shopee_orders (order_sn unique, capture buyer_note)
  → deduct mapped stock in keycap-shop
     (the resulting re-push is a harmless no-op because pushes are ABSOLUTE)
  → optionally add to the admin order queue, tagged "Shopee"
```

---

## 6. Shopee Open Platform API notes

- Register at **open.shopee.com** → obtain `partner_id` + `partner_key`.
- OAuth per shop; requests signed with **HMAC-SHA256**.
- Endpoints used: `product/get_item_list`, `product/get_model_list`, `product/update_stock`,
  `order/get_order_list`, `order/get_order_detail`.
- Rate-limited; a **sandbox** is available — build and test there first.
- Env vars: `SHOPEE_PARTNER_ID`, `SHOPEE_PARTNER_KEY`, `SHOPEE_REDIRECT_URL`, `SHOPEE_ENV`
  (sandbox | live).

---

## 7. Rollout — 5 small PRs

1. **PR1** — Supabase migration: the 4 tables + `AFTER UPDATE` trigger → `shopee_stock_queue`.
   Testable end-to-end **without any Shopee access** (edit stock → a row appears in the queue).
2. **PR2** — Shopee API client + OAuth + `/admin/shopee` connect page (sandbox).
3. **PR3** — stock-push worker (Edge Function + pg_cron) + item mapping UI.
4. **PR4** — order-pull worker + stock deduct + "Shopee" queue tag.
5. **PR5** — token refresh, retry/alerting, sandbox → live cutover.

---

## 8. Open items

- Owner to sign up for Shopee Open Platform (`partner_id` / `partner_key`) — the real gate for
  building/testing PR2+. May require approval / be region-limited; start in parallel.
- Nameplate = **no** auto stock-sync (confirmed).
