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

        <div className="mt-8 grid gap-3">
          <Link
            href="/order/new"
            className="block rounded-xl bg-primary px-6 py-4 text-left text-primary-foreground shadow-md transition hover:opacity-90"
          >
            <div className="text-lg font-semibold">⌨️ พวงกุญแจคีย์แคป</div>
            <div className="text-sm opacity-90">สั่งทำตามชื่อ เลือกสี+ตัวห้อย</div>
          </Link>
          <Link
            href="/order/nfc"
            className="block rounded-xl border border-border bg-card px-6 py-4 text-left text-foreground shadow-sm transition hover:border-primary"
          >
            <div className="text-lg font-semibold">📱 พวงกุญแจ NFC</div>
            <div className="text-sm text-muted">แตะแชร์ช่อง social ของคุณ</div>
          </Link>
          <Link
            href="/order/nameplate"
            className="block rounded-xl border border-border bg-card px-6 py-4 text-left text-foreground shadow-sm transition hover:border-primary"
          >
            <div className="text-lg font-semibold">🔤 ป้ายชื่อ 3D</div>
            <div className="text-sm text-muted">ออกแบบเอง ปรับฟอนต์/ขนาด/ห่วง</div>
          </Link>
        </div>

        <TrackOrderButton />

        <p className="mt-10 text-xs text-muted">
          ชำระเงินตอนมารับสินค้า · ไม่ต้องสมัครสมาชิก
        </p>
      </div>
    </main>
  );
}
