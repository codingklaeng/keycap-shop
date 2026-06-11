import Link from "next/link";
import { getActiveCatalog } from "@/lib/catalog";
import { Wizard } from "@/components/Wizard";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const catalog = await getActiveCatalog();

  const hasCatalog =
    catalog.baseSizes.length > 0 &&
    catalog.baseColors.length > 0 &&
    catalog.keycapColors.length > 0;

  if (!hasCatalog) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-muted">ขณะนี้ร้านยังไม่ได้ตั้งค่าสินค้า</p>
        <Link href="/" className="mt-4 text-primary underline">
          กลับหน้าแรก
        </Link>
      </main>
    );
  }

  return <Wizard catalog={catalog} />;
}
