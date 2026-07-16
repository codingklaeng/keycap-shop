"use server";

import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ShopeeSource } from "@/lib/types";

async function guard() {
  if (!(await isAdmin())) throw new Error("unauthorized");
  return createAdminClient();
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
}

// Clear the whole pending queue at once.
export async function markAllDone() {
  const sb = await guard();
  const { error } = await sb
    .from("shopee_stock_queue")
    .update({ status: "done", done_at: new Date().toISOString() })
    .eq("status", "pending");
  if (error) throw new Error(error.message);
}

// Create/update the Shopee listing mapping for an item.
export async function saveShopeeMap(input: {
  source_table: ShopeeSource;
  source_id: string;
  shopee_label: string | null;
  active: boolean;
}) {
  const sb = await guard();
  const { error } = await sb.from("shopee_item_map").upsert(
    {
      source_table: input.source_table,
      source_id: input.source_id,
      shopee_label: input.shopee_label,
      active: input.active,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "source_table,source_id" },
  );
  if (error) throw new Error(error.message);
}
