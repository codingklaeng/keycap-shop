import Link from "next/link";
import { OrderLookup } from "@/components/OrderLookup";

export default function TrackPage() {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
      <div className="mb-5 flex items-center justify-between">
        <Link href="/" className="text-sm text-muted">
          ← หน้าแรก
        </Link>
        <h1 className="text-lg font-bold">ค้นหาออเดอร์</h1>
        <div className="w-12" />
      </div>
      <p className="mb-4 text-sm text-muted">
        กรอกเบอร์โทรหรือไลน์ที่ให้ไว้ตอนสั่ง เพื่อดูสถานะออเดอร์ของคุณ
      </p>
      <OrderLookup />
    </main>
  );
}
