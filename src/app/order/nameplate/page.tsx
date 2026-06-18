import Link from "next/link";
import { getNameplateConfig } from "@/lib/catalog";
import { NameplateWizard } from "@/components/NameplateWizard";

export const dynamic = "force-dynamic";

export default async function NameplateOrderPage() {
  const config = await getNameplateConfig();

  if (!config || !config.active) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-muted">ขณะนี้ยังไม่เปิดรับสั่งป้ายชื่อ 3D</p>
        <Link href="/" className="mt-4 text-primary underline">
          กลับหน้าแรก
        </Link>
      </main>
    );
  }

  return <NameplateWizard config={config} />;
}
