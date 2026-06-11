import Link from "next/link";
import { logout } from "@/lib/admin-actions";

export function AdminNav({ active }: { active: "board" | "items" }) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1">
          <Link
            href="/admin"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              active === "board" ? "bg-primary text-primary-foreground" : "text-muted"
            }`}
          >
            คิวออเดอร์
          </Link>
          <Link
            href="/admin/items"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              active === "items" ? "bg-primary text-primary-foreground" : "text-muted"
            }`}
          >
            จัดการสินค้า
          </Link>
        </div>
        <form action={logout}>
          <button className="text-sm text-muted hover:text-foreground">
            ออกจากระบบ
          </button>
        </form>
      </div>
    </header>
  );
}
