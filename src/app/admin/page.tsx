import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { AdminNav } from "@/components/AdminNav";
import { AdminBoard } from "@/components/AdminBoard";

export const dynamic = "force-dynamic";

function bangkokToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return (
    <div className="flex-1">
      <AdminNav active="board" />
      <AdminBoard today={bangkokToday()} />
    </div>
  );
}
