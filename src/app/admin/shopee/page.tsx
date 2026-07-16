import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/AdminNav";
import { ShopeeSync, type SyncItem } from "@/components/ShopeeSync";
import type { ShopeeItemMap, ShopeeStockQueue } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ShopeePage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const sb = createAdminClient();
  const [queue, history, maps, variants, sizes, colors, types, platforms] = await Promise.all([
    sb
      .from("shopee_stock_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    sb
      .from("shopee_stock_queue")
      .select("*")
      .eq("status", "done")
      .order("done_at", { ascending: false })
      .limit(50),
    sb.from("shopee_item_map").select("*"),
    sb.from("base_variants").select("id,stock,base_size_id,base_color_id,active").order("sort_order"),
    sb.from("base_sizes").select("id,max_chars,base_type_id"),
    sb.from("base_colors").select("id,name"),
    sb.from("base_types").select("id,name"),
    sb.from("social_platforms").select("id,name,stock,active").order("sort_order"),
  ]);

  const sizeRows = (sizes.data ?? []) as { id: string; max_chars: number; base_type_id: string | null }[];
  const colorRows = (colors.data ?? []) as { id: string; name: string }[];
  const typeRows = (types.data ?? []) as { id: string; name: string }[];

  // Build the flat list of syncable items with a human label, in scope order:
  // keycap base variants first, then NFC platforms.
  const items: SyncItem[] = [
    ...((variants.data ?? []) as {
      id: string;
      stock: number;
      base_size_id: string;
      base_color_id: string;
      active: boolean;
    }[]).map((v) => {
      const size = sizeRows.find((s) => s.id === v.base_size_id);
      const color = colorRows.find((c) => c.id === v.base_color_id);
      const type = size ? typeRows.find((t) => t.id === size.base_type_id) : undefined;
      const label =
        [type?.name, color?.name, size ? `${size.max_chars} ช่อง` : null]
          .filter(Boolean)
          .join(" · ") || "ฐาน";
      return {
        source_table: "base_variants" as const,
        source_id: v.id,
        label,
        stock: v.stock,
        active: v.active,
      };
    }),
    ...((platforms.data ?? []) as { id: string; name: string; stock: number; active: boolean }[]).map(
      (p) => ({
        source_table: "social_platforms" as const,
        source_id: p.id,
        label: `NFC · ${p.name}`,
        stock: p.stock,
        active: p.active,
      }),
    ),
  ];

  return (
    <div className="flex-1">
      <AdminNav active="shopee" />
      <ShopeeSync
        pending={(queue.data ?? []) as ShopeeStockQueue[]}
        history={(history.data ?? []) as ShopeeStockQueue[]}
        maps={(maps.data ?? []) as ShopeeItemMap[]}
        items={items}
      />
    </div>
  );
}
