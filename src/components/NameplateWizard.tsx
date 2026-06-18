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
import {
  buildNameplate,
  NAMEPLATE_FONTS,
  type NameplateSpec,
  type RingPos,
} from "@/lib/nameplate";
import type { NameplateConfig } from "@/lib/catalog";

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
  const totalThick =
    spec.baseThickness + (hasStroke ? spec.strokeHeight ?? 2 : 0) + spec.thickness;
  const price =
    Number(config.base_price) +
    Number(config.price_per_char) * charCount +
    Number(config.price_per_size_mm) * spec.size +
    Number(config.price_per_mm_thick) * totalThick +
    (hasStroke ? Number(config.stroke_surcharge) : 0);

  function set<K extends keyof NameplateSpec>(k: K, v: NameplateSpec[K]) {
    setSpec((s) => ({ ...s, [k]: v }));
  }

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
        setError(
          rpcError.message === "CUSTOMER_NAME_REQUIRED"
            ? "กรุณากรอกชื่อผู้รับ"
            : "เกิดข้อผิดพลาด กรุณาลองใหม่"
        );
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
        <Field label="ข้อความ">
          <input
            value={spec.text}
            onChange={(e) => set("text", e.target.value)}
            placeholder="พิมพ์ชื่อ/ข้อความ"
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-lg font-semibold outline-none focus:border-primary"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="ฟอนต์">
            <select
              value={spec.font}
              onChange={(e) => set("font", e.target.value)}
              className={inp}
              style={{ fontFamily: spec.font }}
            >
              {NAMEPLATE_FONTS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: f }}>
                  {f}
                </option>
              ))}
            </select>
          </Field>
          <Field label="น้ำหนัก">
            <select
              value={spec.weight}
              onChange={(e) => set("weight", Number(e.target.value))}
              className={inp}
            >
              <option value={300}>บาง</option>
              <option value={400}>ปกติ</option>
              <option value={500}>กลาง</option>
              <option value={600}>กึ่งหนา</option>
              <option value={700}>หนา</option>
            </select>
          </Field>
        </div>

        <Field label="รูปแบบ">
          <div className="flex gap-2">
            <Chip active={(spec.style ?? "normal") === "normal"} onClick={() => set("style", "normal")}>
              ตั้งตรง
            </Chip>
            <Chip active={spec.style === "italic"} onClick={() => set("style", "italic")}>
              เอียง (italic)
            </Chip>
          </div>
        </Field>

        <Slider label="ขนาดตัวอักษร" unit="มม." min={10} max={40} step={1}
          value={spec.size} onChange={(v) => set("size", v)} />
        <Slider label="ความหนาตัวอักษร" unit="มม." min={1.5} max={8} step={0.5}
          value={spec.thickness} onChange={(v) => set("thickness", v)} />
        <Slider label="ระยะห่างตัวอักษร" unit="" min={-6} max={24} step={1}
          value={spec.letterSpacing} onChange={(v) => set("letterSpacing", v)} />
        <Slider label="ความหนาฐาน" unit="มม." min={1.5} max={6} step={0.5}
          value={spec.baseThickness} onChange={(v) => set("baseThickness", v)} />

        <Field label="ตำแหน่งห่วง">
          <div className="flex gap-2">
            {(
              [
                { v: "left", l: "ซ้าย" },
                { v: "top", l: "บน" },
                { v: "right", l: "ขวา" },
                { v: "none", l: "ไม่มี" },
              ] as { v: RingPos; l: string }[]
            ).map((o) => (
              <Chip key={o.v} active={spec.ring === o.v} onClick={() => set("ring", o.v)}>
                {o.l}
              </Chip>
            ))}
          </div>
        </Field>

        {spec.ring !== "none" && (
          <div className="grid grid-cols-2 gap-3">
            <Slider label="เส้นผ่านศูนย์กลางห่วง" unit="มม." min={6} max={20} step={0.5}
              value={spec.ringDiameter ?? 12} onChange={(v) => set("ringDiameter", v)} />
            <Slider label="ความหนาห่วง" unit="มม." min={1} max={5} step={0.5}
              value={spec.ringThickness ?? 3.5} onChange={(v) => set("ringThickness", v)} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="ลักษณะขอบฐาน">
            <div className="flex flex-wrap gap-2">
              <Chip active={spec.edge === "sharp"} onClick={() => set("edge", "sharp")}>
                คม
              </Chip>
              <Chip active={spec.edge === "round"} onClick={() => set("edge", "round")}>
                มน
              </Chip>
              <Chip active={spec.edge === "contour"} onClick={() => set("edge", "contour")}>
                ตามตัวอักษร
              </Chip>
            </div>
          </Field>
          <Field label="สีตัวอักษร">
            <input
              type="color"
              value={spec.color}
              onChange={(e) => set("color", e.target.value)}
              className="h-11 w-full rounded-xl border border-border"
            />
          </Field>
        </div>

        <Field label="สีฐาน">
          <input
            type="color"
            value={spec.baseColor ?? "#e5e7eb"}
            onChange={(e) => set("baseColor", e.target.value)}
            className="h-11 w-full rounded-xl border border-border"
          />
        </Field>

        {/* middle stroke layer */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <label className="flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={!!spec.stroke}
              onChange={(e) => set("stroke", e.target.checked)}
            />
            เพิ่มเส้นขอบรอบตัวอักษร (ชั้นกลาง)
          </label>
          {spec.stroke && (
            <>
              <Field label="สีเส้นขอบ">
                <input
                  type="color"
                  value={spec.strokeColor ?? "#111827"}
                  onChange={(e) => set("strokeColor", e.target.value)}
                  className="h-11 w-full rounded-xl border border-border"
                />
              </Field>
              <Slider label="ความกว้างเส้นขอบ" unit="มม." min={0.4} max={5} step={0.2}
                value={spec.strokeWidth ?? 1.2} onChange={(v) => set("strokeWidth", v)} />
              <Slider label="ความหนาเส้นขอบ" unit="มม." min={1} max={6} step={0.5}
                value={spec.strokeHeight ?? 2} onChange={(v) => set("strokeHeight", v)} />
            </>
          )}
        </div>

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

const inp =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function Slider({
  label,
  unit,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-muted">
        {label}: {value}
        {unit ? ` ${unit}` : ""}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
