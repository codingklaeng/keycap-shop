import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/AdminNav";
import { LetterRankings, type Stats } from "@/components/LetterRankings";

export const dynamic = "force-dynamic";

function bangkokToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}
function shiftDay(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

export default async function LettersPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const today = bangkokToday();
  const sb = createAdminClient();
  const [d, w, m, all] = await Promise.all([
    sb.rpc("usage_stats", { p_since: today }),
    sb.rpc("usage_stats", { p_since: shiftDay(today, -6) }),
    sb.rpc("usage_stats", { p_since: shiftDay(today, -29) }),
    sb.rpc("usage_stats", { p_since: null }),
  ]);

  const empty: Stats = { chars: [], lengths: [] };
  const data = {
    d: (d.data ?? empty) as Stats,
    w: (w.data ?? empty) as Stats,
    m: (m.data ?? empty) as Stats,
    all: (all.data ?? empty) as Stats,
  };

  return (
    <div className="flex-1">
      <AdminNav active="letters" />
      <LetterRankings data={data} />
    </div>
  );
}
