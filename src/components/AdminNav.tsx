import Link from "next/link";
import { logout } from "@/lib/admin-actions";
import { createAdminClient } from "@/lib/supabase/admin";

// Number of distinct items with pending Shopee sync work (matches the /admin/shopee
// list, which collapses repeated changes to one card per item).
async function pendingShopeeCount(): Promise<number> {
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from("shopee_stock_queue")
      .select("source_table,source_id")
      .eq("status", "pending");
    if (!data) return 0;
    return new Set(data.map((r) => `${r.source_table}:${r.source_id}`)).size;
  } catch {
    return 0;
  }
}

export async function AdminNav({
  active,
}: {
  active: "board" | "items" | "summary" | "letters" | "shopee";
}) {
  const shopeeCount = await pendingShopeeCount();
  const link = (active2: string) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${
      active === active2 ? "bg-primary text-primary-foreground" : "text-muted"
    }`;
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1">
          <Link href="/admin" className={link("board")}>
            คิวออเดอร์
          </Link>
          <Link href="/admin/items" className={link("items")}>
            จัดการสินค้า
          </Link>
          <Link href="/admin/summary" className={link("summary")}>
            สรุปยอด
          </Link>
          <Link href="/admin/letters" className={link("letters")}>
            อันดับตัวอักษร
          </Link>
          <Link href="/admin/shopee" className={`${link("shopee")} inline-flex items-center gap-1`}>
            Shopee
            {shopeeCount > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 text-xs font-semibold leading-5 text-white">
                {shopeeCount}
              </span>
            )}
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders/new"
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
          >
            ➕ สร้างออเดอร์
          </Link>
          <form action={logout}>
            <button className="text-sm text-muted hover:text-foreground">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
