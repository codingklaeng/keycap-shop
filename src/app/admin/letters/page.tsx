import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/AdminNav";
import { LetterRankings, type CharRow } from "@/components/LetterRankings";

export const dynamic = "force-dynamic";

export default async function LettersPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const sb = createAdminClient();
  const { data } = await sb.rpc("char_rankings");
  const rows = (data ?? []) as CharRow[];

  return (
    <div className="flex-1">
      <AdminNav active="letters" />
      <LetterRankings rows={rows} />
    </div>
  );
}
