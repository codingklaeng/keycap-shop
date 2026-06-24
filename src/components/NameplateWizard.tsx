"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import * as THREE from "three";
import { createBrowserClient } from "@/lib/supabase/client";
import { formatBaht } from "@/lib/price";
import { splitGraphemes } from "@/lib/graphemes";
import { saveLastOrder } from "@/components/TrackOrderButton";
import { buildNameplate, type NameplateSpec } from "@/lib/nameplate";
import {
  NameplateControls,
  Field,
  inp,
} from "@/components/NameplateControls";
import { getNameplateColors, type NameplateConfig } from "@/lib/catalog";
import type { NameplateColor } from "@/lib/types";

const NameplateCanvas = dynamic(
  () => import("@/components/NameplateCanvas").then((m) => m.NameplateCanvas),
  { ssr: false }
);

const DEFAULT: NameplateSpec = {
  text: "ชื่อคุณ",
  font: "Sarabun",
  weight: 700,
  style: "normal",
  size: 18,
  thickness: 4,
  letterSpacing: 0,
  ring: "left",
  ringDiameter: 12,
  ringThickness: 3.5,
  ringOffsetX: 0,
  ringOffsetY: 0,
  icon: "none",
  iconPos: "left",
  iconScale: 1.2,
  iconColor: "#ef4444",
  iconAccentColor: "#fde047",
  iconOffsetX: 0,
  iconOffsetY: 0,
  baseThickness: 3,
  color: "#6d28d9",
  baseColor: "#e5e7eb",
  edge: "round",
  stroke: false,
  strokeColor: "#111827",
  strokeWidth: 1.2,
  strokeHeight: 2,
};

function disposeGroup(g: THREE.Object3D | null) {
  g?.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) {
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat.dispose();
    }
  });
}

export function NameplateWizard({ config }: { config: NameplateConfig }) {
  const router = useRouter();
  const [spec, setSpec] = useState<NameplateSpec>(DEFAULT);
  const [colors, setColors] = useState<NameplateColor[]>([]);
  const [note, setNote] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [group, setGroup] = useState<THREE.Group | null>(null);
  const [size, setSize] = useState({ w: 40, h: 20, d: 7 });
  const [building, setBuilding] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);

  const charCount = useMemo(
    () => splitGraphemes(spec.text.trim()).length,
    [spec.text]
  );
  const hasStroke = !!spec.stroke && (spec.strokeWidth ?? 0) > 0;
  const hasIcon = !!spec.icon && spec.icon !== "none";
  const totalThick =
    spec.baseThickness + (hasStroke ? spec.strokeHeight ?? 2 : 0) + spec.thickness;
  const strokeFee = hasStroke
    ? Number(config.stroke_surcharge) +
      Number(config.stroke_price_per_width_char) * (spec.strokeWidth ?? 0) * charCount
    : 0;
  const edgeFee =
    spec.edge === "contour" ? 0 : Number(config.edge_surcharge_per_char) * charCount;
  const iconFee = hasIcon
    ? (spec.iconScale ?? 1) > 1
      ? Number(config.icon_surcharge_large)
      : Number(config.icon_surcharge_small)
    : 0;
  const price =
    Number(config.base_price) +
    Number(config.price_per_char) * charCount +
    Number(config.price_per_size_mm) * spec.size +
    Number(config.price_per_mm_thick) * totalThick +
    strokeFee +
    edgeFee +
    iconFee;

  function set<K extends keyof NameplateSpec>(k: K, v: NameplateSpec[K]) {
    setSpec((s) => ({ ...s, [k]: v }));
  }

  // load the shop's filament colors and snap any default that isn't available
  // onto a real swatch so the customer only ever ends up with offered colors
  useEffect(() => {
    getNameplateColors().then((list) => {
      setColors(list);
      if (list.length === 0) return;
      const palette = list.map((c) => c.swatch.toLowerCase());
      const pick = (v?: string) =>
        v && palette.includes(v.toLowerCase()) ? v : list[0].swatch;
      setSpec((s) => ({
        ...s,
        color: pick(s.color),
        baseColor: pick(s.baseColor),
        strokeColor: pick(s.strokeColor),
        iconColor: pick(s.iconColor),
        iconAccentColor: pick(s.iconAccentColor),
      }));
    });
  }, []);

  // rebuild the 3D model (debounced) whenever the spec changes
  useEffect(() => {
    let alive = true;
    setBuilding(true);
    const t = setTimeout(async () => {
      try {
        const r = await buildNameplate(spec);
        if (!alive) {
          disposeGroup(r.group);
          return;
        }
        disposeGroup(groupRef.current);
        groupRef.current = r.group;
        setGroup(r.group);
        setSize(r.sizeMM);
      } catch (e) {
        if (alive) setError(String(e));
      } finally {
        if (alive) setBuilding(false);
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [spec]);

  const canSubmit = !!spec.text.trim() && !!customerName.trim();

  async function submit() {
    setError(null);
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const sb = createBrowserClient();
      const { data, error: rpcError } = await sb.rpc("place_nameplate_order", {
        p_text: spec.text.trim(),
        p_char_count: charCount,
        p_spec: spec,
        p_note: note.trim() || null,
        p_customer_name: customerName.trim(),
        p_customer_contact: customerContact.trim() || null,
      });
      if (rpcError) {
        const msg = rpcError.message.includes("CUSTOMER_NAME_REQUIRED")
          ? "กรุณากรอกชื่อผู้รับ"
          : rpcError.message.includes("NAMEPLATE_CLOSED")
            ? "ขณะนี้ปิดรับสั่งป้ายชื่อ 3D ชั่วคราว"
            : "เกิดข้อผิดพลาด กรุณาลองใหม่";
        setError(msg);
        setSubmitting(false);
        return;
      }
      const id = (data as { order_id: string }).order_id;
      saveLastOrder(id);
      router.push(`/order/${id}`);
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm text-muted">
            ← ออก
          </Link>
          <div className="text-sm font-medium">ป้ายชื่อ 3D</div>
          <div className="w-10" />
        </div>
        <div className="relative mx-auto max-w-lg">
          <NameplateCanvas group={group} size={size} height={190} />
          {building && (
            <span className="pointer-events-none absolute right-3 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[11px] text-muted">
              กำลังสร้าง…
            </span>
          )}
          <span className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-muted">
            ลากเพื่อหมุน · {size.w.toFixed(0)}×{size.h.toFixed(0)}×{size.d.toFixed(0)} มม.
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-4 py-5 pb-28">
        <NameplateControls spec={spec} set={set} colors={colors} />

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <Field label="ชื่อผู้รับ (สำหรับเรียกรับของ)">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="เช่น ดวง"
              className={inp}
            />
          </Field>
          <Field label="เบอร์/LINE (ถ้ามี)">
            <input
              value={customerContact}
              onChange={(e) => setCustomerContact(e.target.value)}
              placeholder="ไว้ติดต่อกรณีไม่มารับ"
              className={inp}
            />
          </Field>
          <Field label="หมายเหตุถึงร้าน (ถ้ามี)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className={inp}
            />
          </Field>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t border-border bg-card">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <div className="text-xs text-muted">ราคา ({charCount} ตัวอักษร)</div>
            <div className="text-lg font-bold">{formatBaht(price)}</div>
          </div>
          <button
            disabled={!canSubmit || submitting}
            onClick={submit}
            className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-40"
          >
            {submitting ? "กำลังส่ง..." : "ยืนยันสั่ง"}
          </button>
        </div>
      </footer>
    </div>
  );
}
