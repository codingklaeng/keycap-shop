import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/AdminNav";
import { formatBaht } from "@/lib/price";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function bangkokToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}
function shiftDay(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

type Row = {
  status: OrderStatus;
  total_price: number;
  product_type: "keycap" | "nfc";
  base_colors: { name: string } | null;
  pendants: { name: string } | null;
  order_nfc: { social_platforms: { name: string } | null }[] | { social_platforms: { name: string } | null } | null;
};

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { date: dateParam } = await searchParams;
  const date = dateParam ?? bangkokToday();

  const sb = createAdminClient();
  const { data } = await sb
    .from("orders")
    .select(
      "status,total_price,product_type,base_colors(name),pendants(name),order_nfc(social_platforms(name))"
    )
    .eq("queue_date", date);
  const rows = (data ?? []) as unknown as Row[];

  const sold = rows.filter((r) => r.status !== "cancelled");
  const revenue = sold.reduce((s, r) => s + Number(r.total_price), 0);
  const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  const tally = (pick: (r: Row) => string | undefined) => {
    const m = new Map<string, number>();
    for (const r of sold) {
      const k = pick(r);
      if (!k) continue;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  };
  const topColors = tally((r) => r.base_colors?.name);
  const topPendants = tally((r) => r.pendants?.name);
  const topPlatforms = tally((r) => {
    const n = r.order_nfc;
    const one = Array.isArray(n) ? n[0] : n;
    return one?.social_platforms?.name;
  });

  const isToday = date === bangkokToday();

  return (
    <div className="flex-1">
      <AdminNav active="summary" />
      <div className="mx-auto max-w-3xl px-4 py-6">
        {/* date nav */}
        <div className="mb-4 flex items-center justify-between">
          <Link href={`/admin/summary?date=${shiftDay(date, -1)}`} className="rounded-lg border border-border px-3 py-1.5 text-sm">
            ← วันก่อน
          </Link>
          <div className="text-center">
            <div className="font-bold">{date}</div>
            {isToday && <div className="text-xs text-muted">วันนี้</div>}
          </div>
          {isToday ? (
            <span className="w-20" />
          ) : (
            <Link href={`/admin/summary?date=${shiftDay(date, 1)}`} className="rounded-lg border border-border px-3 py-1.5 text-sm">
              วันถัดไป →
            </Link>
          )}
        </div>

        {/* headline numbers */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-sm text-muted">รายได้ (ไม่รวมยกเลิก)</div>
            <div className="mt-1 text-3xl font-extrabold">{formatBaht(revenue)}</div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-sm text-muted">ออเดอร์ที่ขายได้</div>
            <div className="mt-1 text-3xl font-extrabold">{sold.length}</div>
          </div>
        </div>

        {/* status breakdown */}
        <div className="mt-4 rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">แยกตามสถานะ</h2>
          {rows.length === 0 ? (
            <p className="text-sm text-muted">ยังไม่มีออเดอร์ในวันนี้</p>
          ) : (
            <div className="flex flex-wrap gap-2 text-sm">
              {(Object.keys(byStatus) as OrderStatus[]).map((s) => (
                <span key={s} className="rounded-full bg-background px-3 py-1">
                  {ORDER_STATUS_LABEL[s]}: <b>{byStatus[s]}</b>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* top sellers */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TopList title="สีฐานขายดี" items={topColors} />
          <TopList title="ตัวห้อยขายดี" items={topPendants} />
          <TopList title="NFC แพลตฟอร์มขายดี" items={topPlatforms} />
        </div>
      </div>
    </div>
  );
}

function TopList({ title, items }: { title: string; items: [string, number][] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-2 font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">—</p>
      ) : (
        <ol className="space-y-1 text-sm">
          {items.map(([name, count], i) => (
            <li key={name} className="flex justify-between">
              <span className="text-muted">
                {i + 1}. {name}
              </span>
              <b>{count}</b>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
