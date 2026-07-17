"use client";

import { useState } from "react";
import Link from "next/link";
import { Wizard } from "@/components/Wizard";
import { NfcWizard } from "@/components/NfcWizard";
import { NameplateWizard } from "@/components/NameplateWizard";
import {
  adminCreateKeycapOrder,
  adminCreateNfcOrder,
  adminCreateNameplateOrder,
} from "@/lib/admin-actions";
import {
  ADMIN_ORDER_SOURCES,
  type OrderSource,
  type AdminOrderMeta,
  type AdminOrderResult,
  type Catalog,
  type SocialPlatform,
} from "@/lib/types";
import type { NameplateConfig } from "@/lib/catalog";

type Product = "keycap" | "nfc" | "nameplate";

const PRODUCTS: { value: Product; label: string; emoji: string }[] = [
  { value: "keycap", label: "คีย์แคป", emoji: "⌨️" },
  { value: "nfc", label: "พวงกุญแจ NFC", emoji: "📶" },
  { value: "nameplate", label: "ป้ายชื่อ 3D", emoji: "🪧" },
];

// Turn an admin action result into the wizard's contract: resolve to the order
// id, or throw the place_* error code so the wizard translates it for display.
function unwrap(r: AdminOrderResult): { order_id: string } {
  if (!r.ok) throw new Error(r.code);
  return { order_id: r.order_id };
}

export function AdminOrderCreator({
  catalog,
  platforms,
  nameplateConfig,
}: {
  catalog: Catalog | null;
  platforms: SocialPlatform[];
  nameplateConfig: NameplateConfig | null;
}) {
  const [phase, setPhase] = useState<"setup" | "wizard">("setup");
  const [product, setProduct] = useState<Product>("keycap");
  const [source, setSource] = useState<OrderSource>("shopee");
  const [externalRef, setExternalRef] = useState("");
  const [markPaid, setMarkPaid] = useState(true);

  const meta = (): AdminOrderMeta => ({
    source,
    external_ref: externalRef.trim() || null,
    markPaid,
  });

  const keycapReady =
    !!catalog &&
    catalog.baseSizes.length > 0 &&
    catalog.baseColors.length > 0 &&
    catalog.keycapColors.length > 0;
  const nfcReady = platforms.length > 0;
  const nameplateReady = !!nameplateConfig && nameplateConfig.active;

  const readyFor = (p: Product) =>
    p === "keycap" ? keycapReady : p === "nfc" ? nfcReady : nameplateReady;

  if (phase === "wizard") {
    // exitHref returns to this setup screen (fresh navigation resets to setup).
    const exitHref = "/admin/orders/new";
    if (product === "keycap" && catalog) {
      return (
        <Wizard
          catalog={catalog}
          adminMode
          exitHref={exitHref}
          submitLabel="สร้างออเดอร์"
          onSubmit={async (p) => unwrap(await adminCreateKeycapOrder(p, meta()))}
        />
      );
    }
    if (product === "nfc") {
      return (
        <NfcWizard
          platforms={platforms}
          adminMode
          exitHref={exitHref}
          submitLabel="สร้างออเดอร์"
          onSubmit={async (p) => unwrap(await adminCreateNfcOrder(p, meta()))}
        />
      );
    }
    if (product === "nameplate" && nameplateConfig) {
      return (
        <NameplateWizard
          config={nameplateConfig}
          adminMode
          exitHref={exitHref}
          submitLabel="สร้างออเดอร์"
          onSubmit={async (p) => unwrap(await adminCreateNameplateOrder(p, meta()))}
        />
      );
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-6 px-4 py-6">
      <div>
        <h1 className="text-lg font-bold">สร้างออเดอร์ (ฝั่งร้าน)</h1>
        <p className="mt-1 text-sm text-muted">
          บันทึกออเดอร์จาก Shopee / หน้าร้าน ให้เข้าคิวและตัดสต็อกเหมือนลูกค้าสั่งเอง
        </p>
      </div>

      <div>
        <label className="mb-2 block font-semibold">ประเภทสินค้า</label>
        <div className="grid grid-cols-3 gap-2">
          {PRODUCTS.map((p) => {
            const ready = readyFor(p.value);
            return (
              <button
                key={p.value}
                disabled={!ready}
                onClick={() => setProduct(p.value)}
                className={`rounded-xl border px-3 py-3 text-center transition ${
                  p.value === product
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary"
                } ${!ready ? "cursor-not-allowed opacity-40 hover:border-border" : ""}`}
              >
                <div className="text-2xl">{p.emoji}</div>
                <div className="mt-1 text-sm font-medium">{p.label}</div>
              </button>
            );
          })}
        </div>
        {product === "nameplate" && !nameplateReady && (
          <p className="mt-2 text-xs text-amber-600">
            ป้ายชื่อ 3D ปิดรับอยู่ — เปิดสวิตช์ในหน้า “คิวออเดอร์” ก่อนจึงจะสร้างได้
          </p>
        )}
        {product === "keycap" && !keycapReady && (
          <p className="mt-2 text-xs text-amber-600">ยังไม่ได้ตั้งค่าสินค้าคีย์แคป</p>
        )}
        {product === "nfc" && !nfcReady && (
          <p className="mt-2 text-xs text-amber-600">ยังไม่มีแพลตฟอร์ม NFC ที่เปิดขาย</p>
        )}
      </div>

      <div>
        <label className="mb-2 block font-semibold">ช่องทางการขาย</label>
        <div className="flex flex-wrap gap-2">
          {ADMIN_ORDER_SOURCES.map((s) => (
            <button
              key={s.value}
              onClick={() => {
                setSource(s.value);
                setMarkPaid(s.value === "shopee");
              }}
              className={`rounded-xl border px-4 py-2 font-medium transition ${
                s.value === source
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block font-semibold">
          เลขอ้างอิง{source === "shopee" ? " (เลขออเดอร์ Shopee)" : " (ถ้ามี)"}
        </label>
        <input
          value={externalRef}
          onChange={(e) => setExternalRef(e.target.value)}
          placeholder={source === "shopee" ? "เช่น 250717ABCDEF" : "อ้างอิงภายใน"}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-primary"
        />
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <input
          type="checkbox"
          checked={markPaid}
          onChange={(e) => setMarkPaid(e.target.checked)}
          className="h-5 w-5"
        />
        <span className="font-medium">จ่ายครบแล้ว (บันทึกยอดชำระเต็มจำนวน)</span>
      </label>

      <div className="flex items-center gap-3 pt-2">
        <Link
          href="/admin"
          className="rounded-xl border border-border px-4 py-3 font-medium"
        >
          ยกเลิก
        </Link>
        <button
          disabled={!readyFor(product)}
          onClick={() => setPhase("wizard")}
          className="flex-1 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-40"
        >
          ถัดไป — กรอกรายละเอียดสินค้า
        </button>
      </div>
    </main>
  );
}
