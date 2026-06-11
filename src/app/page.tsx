import Link from "next/link";
import { TrackOrderButton } from "@/components/TrackOrderButton";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-3xl font-bold shadow-lg">
          ⌨️
        </div>
        <h1 className="text-2xl font-bold">Keycap Studio</h1>
        <p className="mt-2 text-muted">
          สั่งทำพวงกุญแจคีย์แคปตามชื่อของคุณ
          <br />
          เลือกขนาด เลือกสี เลือกตัวห้อย
        </p>

        <Link
          href="/order/new"
          className="mt-8 block w-full rounded-xl bg-primary px-6 py-4 text-lg font-semibold text-primary-foreground shadow-md transition hover:opacity-90"
        >
          เริ่มสั่งสินค้า
        </Link>

        <TrackOrderButton />

        <p className="mt-10 text-xs text-muted">
          ชำระเงินตอนมารับสินค้า · ไม่ต้องสมัครสมาชิก
        </p>
      </div>
    </main>
  );
}
