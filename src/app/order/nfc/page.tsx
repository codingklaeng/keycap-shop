import Link from "next/link";
import { getActivePlatforms } from "@/lib/catalog";
import { NfcWizard } from "@/components/NfcWizard";

export const dynamic = "force-dynamic";

export default async function NfcOrderPage() {
  const platforms = await getActivePlatforms();

  if (platforms.length === 0) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-muted">ขณะนี้ยังไม่เปิดรับสั่งพวงกุญแจ NFC</p>
        <Link href="/" className="mt-4 text-primary underline">
          กลับหน้าแรก
        </Link>
      </main>
    );
  }

  return <NfcWizard platforms={platforms} />;
}
