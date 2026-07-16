# Shopee Integration — Design Doc

Status: **PLAN — manual-first** (PR1 in progress). Target repo: `codingklaeng/keycap-shop`.
Goal: sell keycap-shop products on **Shopee** using the **single stock** that keycap-shop
already owns — Shopee is a mirror, not a second source of truth.

---

## 0. Why manual-first (the eligibility constraint)

Shopee **Thailand** only grants Open Platform API access to **Managed Sellers** (assigned a Key
Account Manager) or **Shopee Mall** sellers. An **Individual Seller cannot self-register for API
access.** Confirmed on the Open Platform console ("You do not meet one of the criteria: Managed
Sellers / Mall Seller") and in Shopee's TH developer guidance.

Third-party OMS middleware (ZORT, Ginee) can bridge this — they hold the Shopee partnership and
expose their own API — but the only ones with an open API we could push into are **paid monthly
subscriptions** (ZORT ~716 THB/mo; Ginee is order-tier priced with a 6-month minimum and gates
its Open API to higher plans). The free tools (Seller Pao, BigSeller) only connect standard
marketplaces, **not** a custom app like keycap-shop, so they cannot participate.

**Decision:** build a **manual-first** sync that is free and keeps keycap-shop as the single
source of truth. The database records every stock change as a "pending Shopee update"; an admin
page shows the pending list; the owner applies the change on Shopee Seller Centre by hand and
marks it done. If API access is ever obtained (Managed status, or a paid middleware), a worker
(PR3) drains the same queue automatically — **no rework of PR1/PR2.**

---

## 1. Principles

1. **keycap-shop is the single source of truth.** Shopee mirrors its stock; never a second inventory.
2. **Absolute values, not deltas.** Every queued update carries the *current* stock number to
   set on Shopee — idempotent, replay-safe, and tolerant of Shopee-originated sales.
3. **Touch existing code minimally.** A Postgres `AFTER UPDATE` trigger on the stock-bearing
   tables captures changes, so we do **not** edit `place_order` (order RPC) or
   `src/lib/items-actions.ts` (admin edits). Both paths flow through the trigger for free.

---

## 2. What syncs & how stock maps

| Shopee listing      | keycap-shop table        | Sync? | Notes |
|---------------------|--------------------------|-------|-------|
| **NFC keychain**    | `social_platforms.stock` | ✅    | 1 listing ↔ 1 row. |
| **keycap keychain** | `base_variants.stock`    | ✅    | Shopee variations จำนวนตัว (size) × สี (color) ↔ a `base_variant` row. The base is the slow/limited stock gate; letters are not (buyer sends text via chat). |
| **3D nameplate**    | —                        | ❌    | Made-to-order; **no** stock sync (owner confirmed). |
| letter tiles        | `keycap_stock`           | ❌    | Reprinted quickly; a stats table, not a Shopee gate. |

**Scope: `base_variants` + `social_platforms` only.**

---

## 3. Stock mutation points (what the trigger captures)

Stock is mutated in exactly two places today — one trigger covers both:

1. **`place_order` RPC** — a customer order deducts stock (called from `src/components/Wizard.tsx`).
2. **`src/lib/items-actions.ts`** server actions (`service_role`) — admin edits: `saveBaseVariant`,
   `addVariantsBatch`, `saveSocialPlatform`, …

Both write to `base_variants` / `social_platforms`, so an `AFTER UPDATE` trigger on those tables
catches every stock change without editing either path.

---

## 4. New Supabase objects (NO changes to existing tables)

Manual mode needs only **two** tables + a trigger:

- **`shopee_item_map`** — maps a keycap-shop row to a Shopee listing:
  - `source_table` (`'base_variants' | 'social_platforms'`), `source_id`
  - `shopee_label` — human label of the Shopee listing + variation (so the admin knows what to edit)
  - `shopee_item_id`, `shopee_model_id` — nullable; unused in manual mode, reserved for the API worker (PR3)
  - `active`; `UNIQUE (source_table, source_id)`
- **`shopee_stock_queue`** — the trigger inserts here on every stock change:
  - `source_table`, `source_id`, `new_stock` (absolute), `status` (`'pending' | 'done'`),
    `created_at`, `done_at`

Deferred to PR3 (only when API access exists): `shopee_shop` (OAuth tokens) and `shopee_orders`
(pulled orders). Not needed for manual operation.

### Trigger
```sql
-- on base_variants AND social_platforms
AFTER UPDATE ... FOR EACH ROW
WHEN (OLD.stock IS DISTINCT FROM NEW.stock)
  → INSERT INTO shopee_stock_queue (source_table, source_id, new_stock, status)
    VALUES (<table>, NEW.id, NEW.stock, 'pending');
```

---

## 5. Flows (manual mode)

### A. keycap-shop → Shopee (stock changed)
```
customer order (place_order)  OR  admin stock edit
  → AFTER UPDATE trigger → INSERT shopee_stock_queue (new_stock, pending)
  → /admin/shopee lists it: "Base M / สีดำ → set Shopee stock = 3" (with shopee_label)
  → owner edits Shopee Seller Centre by hand → clicks "mark done" (status = done, done_at set)
```
Stock 0 ⇒ set the Shopee listing out-of-stock.

### B. Shopee → keycap-shop (a Shopee sale happened)
```
owner sees the order in Shopee
  → deducts stock in keycap-shop admin (the source of truth)
  → trigger enqueues a row (this change originated on Shopee)
  → owner marks it done immediately (no need to re-edit Shopee)
```
Both sides stay equal, gated by the owner's confirmation.

---

## 6. Rollout

| PR | Scope | Test | Needs Shopee? |
|----|-------|------|---------------|
| **PR1** | Supabase CLI migration: `shopee_item_map` + `shopee_stock_queue` + `AFTER UPDATE` trigger on `base_variants` & `social_platforms` | edit a stock value → a `pending` row appears in `shopee_stock_queue` | ❌ |
| **PR2** | `/admin/shopee` page: pending-queue list + mapping editor + "mark done" | open page, see pending work, clear it | ❌ |
| **PR3** *(future, only if API access)* | add `shopee_shop` + `shopee_orders` + Edge Function / pg_cron worker to drain the queue (absolute `update_stock`) and pull orders | queue drains itself | ✅ Managed seller or paid middleware |

**PR1 + PR2 = a complete, free, working system.** PR3 bolts on later without touching PR1/PR2.

### Migrations
Managed with the **Supabase CLI** (`supabase migration new …`), files versioned under
`supabase/migrations/` in this repo. Apply with `supabase db push` (against the linked project)
when ready. keycap-shop had no `supabase/` scaffold before PR1; PR1 runs `supabase init`.

---

## 7. Future API path (deferred, for reference)

If Managed-seller status or a paid middleware is obtained later:
- **ZORT / Ginee:** swap the PR3 worker's endpoint to the middleware's absolute stock-update API
  (`ZORT UpdateProduct` / `Ginee UpdateSpareStock` override); pull orders from the middleware's
  order API to deduct in keycap-shop.
- **Direct Shopee (Managed):** register at open.shopee.com → `partner_id` + `partner_key`; OAuth
  per shop; HMAC-SHA256 signing; endpoints `product/get_item_list`, `product/get_model_list`,
  `product/update_stock`, `order/get_order_list`, `order/get_order_detail`; sandbox available.
- Either way the queue/trigger from PR1 is the unchanged substrate; only the drain step differs.
