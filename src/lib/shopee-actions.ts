"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ShopeeSource } from "@/lib/types";

async function guard() {
  if (!(await isAdmin())) throw new Error("unauthorized");
  return createAdminClient();
}

// Retention: drop done rows older than this so the queue doesn't grow forever.
const DONE_RETENTION_DAYS = 60;

// Opportunistic cleanup — runs whenever the admin clears queue items (the only
// way rows become 'done'), so no cron/extension is needed.
async function pruneOldDone(sb: SupabaseClient) {
  const cutoff = new Date(Date.now() - DONE_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await sb.from("shopee_stock_queue").delete().eq("status", "done").lt("done_at", cutoff);
}

// Mark every pending queue row for one item as done (the admin has applied the
// latest stock value on Shopee). Collapses repeated changes to the same item.
export async function markItemDone(source_table: ShopeeSource, source_id: string) {
  const sb = await guard();
  const { error } = await sb
    .from("shopee_stock_queue")
    .update({ status: "done", done_at: new Date().toISOString() })
    .eq("status", "pending")
    .eq("source_table", source_table)
    .eq("source_id", source_id);
  if (error) throw new Error(error.message);
  await pruneOldDone(sb);
}

// Clear the whole pending queue at once.
export async function markAllDone() {
  const sb = await guard();
  const { error } = await sb
    .from("shopee_stock_queue")
    .update({ status: "done", done_at: new Date().toISOString() })
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  await pruneOldDone(sb);
}

// Create/update the Shopee listing mapping for an item. On the active↔inactive
// transition we keep the queue coherent: turning sync ON enqueues one task to set
// Shopee to the current stock; turning it OFF clears that item's pending tasks.
export async function saveShopeeMap(input: {
  source_table: ShopeeSource;
  source_id: string;
  shopee_label: string | null;
  shopee_url: string | null;
  active: boolean;
}) {
  const sb = await guard();

  const { data: existing } = await sb
    .from("shopee_item_map")
    .select("active")
    .eq("source_table", input.source_table)
    .eq("source_id", input.source_id)
    .maybeSingle();
  const wasActive = (existing as { active?: boolean } | null)?.active ?? false;

  const { error } = await sb.from("shopee_item_map").upsert(
    {
      source_table: input.source_table,
      source_id: input.source_id,
      shopee_label: input.shopee_label,
      shopee_url: input.shopee_url,
      active: input.active,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "source_table,source_id" },
  );
  if (error) throw new Error(error.message);

  if (input.active && !wasActive) {
    // Newly synced: surface one task to set Shopee to the current stock.
    const { data: row } = await sb
      .from(input.source_table)
      .select("stock")
      .eq("id", input.source_id)
      .maybeSingle();
    const stock = (row as { stock?: number } | null)?.stock;
    if (typeof stock === "number") {
      await sb
        .from("shopee_stock_queue")
        .insert({ source_table: input.source_table, source_id: input.source_id, new_stock: stock });
    }
  } else if (!input.active && wasActive) {
    // Sync turned off: this item's pending tasks are moot.
    await sb
      .from("shopee_stock_queue")
      .update({ status: "done", done_at: new Date().toISOString() })
      .eq("status", "pending")
      .eq("source_table", input.source_table)
      .eq("source_id", input.source_id);
  }
}
