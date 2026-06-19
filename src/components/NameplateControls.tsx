"use client";

import {
  NAMEPLATE_FONTS,
  NAMEPLATE_ICONS,
  type NameplateSpec,
  type RingPos,
} from "@/lib/nameplate";

type SetSpec = <K extends keyof NameplateSpec>(k: K, v: NameplateSpec[K]) => void;

// All of the nameplate design controls, shared by the customer wizard and the
// admin order editor. The owner provides `spec` and a `set(key, value)` updater.
export function NameplateControls({
  spec,
  set,
}: {
  spec: NameplateSpec;
  set: SetSpec;
}) {
  const hasIcon = !!spec.icon && spec.icon !== "none";
  const iconHasAccent =
    hasIcon && !!NAMEPLATE_ICONS.find((i) => i.name === spec.icon)?.accent;

  return (
    <div className="space-y-5">
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
        <>
          <div className="grid grid-cols-2 gap-3">
            <Slider label="เส้นผ่านศูนย์กลางห่วง" unit="มม." min={6} max={20} step={0.5}
              value={spec.ringDiameter ?? 12} onChange={(v) => set("ringDiameter", v)} />
            <Slider label="ความหนาห่วง" unit="มม." min={1} max={5} step={0.5}
              value={spec.ringThickness ?? 3.5} onChange={(v) => set("ringThickness", v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Slider label="เลื่อนห่วง ←→" unit="มม." min={-15} max={15} step={0.5}
              value={spec.ringOffsetX ?? 0} onChange={(v) => set("ringOffsetX", v)} />
            <Slider label="เลื่อนห่วง ↑↓" unit="มม." min={-15} max={15} step={0.5}
              value={spec.ringOffsetY ?? 0} onChange={(v) => set("ringOffsetY", v)} />
          </div>
        </>
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

      {/* decorative icon */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <Field label="ไอคอนตกแต่ง">
          <div className="flex flex-wrap gap-2">
            <Chip active={(spec.icon ?? "none") === "none"} onClick={() => set("icon", "none")}>
              ไม่มี
            </Chip>
            {NAMEPLATE_ICONS.map((ic) => (
              <Chip key={ic.name} active={spec.icon === ic.name} onClick={() => set("icon", ic.name)}>
                {ic.label}
              </Chip>
            ))}
          </div>
        </Field>
        {hasIcon && (
          <>
            <Field label="ตำแหน่งไอคอน">
              <div className="flex gap-2">
                <Chip active={(spec.iconPos ?? "left") === "left"} onClick={() => set("iconPos", "left")}>
                  ซ้ายของชื่อ
                </Chip>
                <Chip active={spec.iconPos === "right"} onClick={() => set("iconPos", "right")}>
                  ขวาของชื่อ
                </Chip>
              </div>
            </Field>
            <Slider label="ขนาดไอคอน (เท่าของตัวอักษร)" unit="x" min={0.7} max={2} step={0.1}
              value={spec.iconScale ?? 1.2} onChange={(v) => set("iconScale", v)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="สีไอคอน">
                <input
                  type="color"
                  value={spec.iconColor ?? "#ef4444"}
                  onChange={(e) => set("iconColor", e.target.value)}
                  className="h-11 w-full rounded-xl border border-border"
                />
              </Field>
              {iconHasAccent && (
                <Field label="สีลายในไอคอน">
                  <input
                    type="color"
                    value={spec.iconAccentColor ?? "#fde047"}
                    onChange={(e) => set("iconAccentColor", e.target.value)}
                    className="h-11 w-full rounded-xl border border-border"
                  />
                </Field>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Slider label="เลื่อนไอคอน ←→" unit="มม." min={-30} max={30} step={0.5}
                value={spec.iconOffsetX ?? 0} onChange={(v) => set("iconOffsetX", v)} />
              <Slider label="เลื่อนไอคอน ↑↓" unit="มม." min={-20} max={20} step={0.5}
                value={spec.iconOffsetY ?? 0} onChange={(v) => set("iconOffsetY", v)} />
            </div>
            <p className="text-[11px] text-muted">
              เลื่อนไอคอนให้ทับตัวอักษรได้ — ส่วนที่ทับ ตัวอักษรจะเป็นตัวหลัก ไอคอนจะเว้าตามรอยตัวอักษร
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export const inp =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

export function Chip({
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
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted"
      }`}
    >
      {children}
    </button>
  );
}

export function Slider({
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
