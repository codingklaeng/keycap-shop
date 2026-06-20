import Link from "next/link";
import { MyOrders } from "@/components/MyOrders";

export default function MyOrdersPage() {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
      <div className="mb-5 flex items-center justify-between">
        <Link href="/" className="text-sm text-muted">
          ← หน้าแรก
        </Link>
        <h1 className="text-lg font-bold">ออเดอร์ของฉัน</h1>
        <div className="w-12" />
      </div>
      <MyOrders />
    </main>
  );
}
