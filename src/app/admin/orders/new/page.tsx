import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { AdminNav } from "@/components/AdminNav";
import { AdminOrderCreator } from "@/components/AdminOrderCreator";
import {
  getActiveCatalog,
  getActivePlatforms,
  getNameplateConfig,
} from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function AdminNewOrderPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const [catalog, platforms, nameplateConfig] = await Promise.all([
    getActiveCatalog(),
    getActivePlatforms(),
    getNameplateConfig(),
  ]);

  return (
    <div className="flex-1 flex flex-col">
      <AdminNav active="board" />
      <AdminOrderCreator
        catalog={catalog}
        platforms={platforms}
        nameplateConfig={nameplateConfig}
      />
    </div>
  );
}
