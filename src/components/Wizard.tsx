"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import { splitGraphemes } from "@/lib/graphemes";
import { decomposeCluster, addonCount, unitPieceChars, type Unit } from "@/lib/thai";
import { calcPrice, formatBaht } from "@/lib/price";
import { saveLastOrder } from "@/components/TrackOrderButton";
import { KeycapPreview3D } from "@/components/KeycapPreview3D";
import type { Catalog, LetterChoice } from "@/lib/types";

// Payload sent to place_order — shared with the admin create-order flow so it
// can submit the same shape through a server action instead of the anon RPC.
export type KeycapOrderPayload = {
  p_base_variant_id: string;
  p_pendant_id: string | null;
  p_layout: "horizontal" | "vertical";
  p_letters: {
    position: number;
    char: string;
    base: string;
    upper: string;
    lower: string;
    keycap_color_id: string | null;
  }[];
  p_note: string | null;
  p_customer_name: string;
  p_customer_contact: string | null;
};

const STEPS = ["แบบฐาน + สี", "ข้อความ + สีตัวอักษร", "ตัวห้อย", "ยืนยัน"];

const ERROR_TH: Record<string, string> = {
  EMPTY_TEXT: "กรุณาพิมพ์ข้อความ",
  CUSTOMER_NAME_REQUIRED: "กรุณากรอกชื่อเล่นผู้รับ",
  TEXT_TOO_LONG: "ข้อความยาวเกินจำนวนช่องของฐานที่เลือก",
  BASE_VARIANT_INVALID: "ฐาน/สีที่เลือกไม่ถูกต้อง",
  BASE_OUT: "ฐานสีที่เลือกหมดสต็อกแล้ว",
  PENDANT_INVALID: "ตัวห้อยไม่ถูกต้อง",
  PENDANT_OUT: "ตัวห้อยที่เลือกหมดสต็อกแล้ว",
  KEYCAP_COLOR_INVALID: "สีตัวอักษรไม่ถูกต้อง",
};

function translateError(msg: string): string {
  if (msg.startsWith("KEYCAP_OUT:")) {
    return `ตัวอักษร "${msg.split(":")[1]}" หมดสต็อกพอดี กรุณาเลือกใหม่`;
  }
  return ERROR_TH[msg] ?? "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

export function Wizard({
  catalog,
  onSubmit,
  adminMode = false,
  exitHref = "/",
  submitLabel = "ยืนยันสั่ง",
}: {
  catalog: Catalog;
  // When provided (admin flow), the order is created through this instead of
  // the customer's anon RPC. Should resolve to the new order id or throw an
  // Error whose message is a place_order error code (translated for display).
  onSubmit?: (payload: KeycapOrderPayload) => Promise<{ order_id: string }>;
  adminMode?: boolean;
  exitHref?: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [text, setText] = useState("");
  const [typeId, setTypeId] = useState<string | null>(
    catalog.baseTypes[0]?.id ?? null
  );
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [colorId, setColorId] = useState<string | null>(null);
  const [letterColors, setLetterColors] = useState<Record<number, string>>({});
  const [layout, setLayout] = useState<"horizontal" | "vertical">("horizontal");
  const [pendantId, setPendantId] = useState<string | null>(
    catalog.pendants[0]?.id ?? null
  );
  const [note, setNote] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // char -> set of keycap color ids in stock
  const availability = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const s of catalog.keycapStock) {
      if (s.available <= 0) continue;
      if (!map.has(s.char)) map.set(s.char, new Set());
      map.get(s.char)!.add(s.color_id);
    }
    return map;
  }, [catalog.keycapStock]);

  // size ids that have at least one in-stock variant
  const sizesWithVariant = useMemo(
    () => new Set(catalog.baseVariants.map((v) => v.base_size_id)),
    [catalog.baseVariants]
  );

  const graphemes = useMemo(() => splitGraphemes(text), [text]);
  // each grapheme is one keycap/slot, split into base + upper/lower add-ons
  const units = useMemo(() => graphemes.map(decomposeCluster), [graphemes]);
  // Thai keycaps (with stacked vowels/tones) only work laid out horizontally — lock it.
  const isThai = useMemo(() => /[฀-๿]/.test(text), [text]);
  useEffect(() => {
    if (isThai && layout === "vertical") setLayout("horizontal");
  }, [isThai, layout]);
  const addonTotal = useMemo(
    () => units.reduce((n, u) => n + addonCount(u), 0),
    [units]
  );

  // letter colors belong to a keycap shape (base type) — only show this type's
  const typeColors = useMemo(
    () => catalog.keycapColors.filter((c) => c.base_type_id === typeId),
    [catalog.keycapColors, typeId]
  );
  // colors in which a whole unit is makeable (base + every mark all in stock)
  const colorsForUnit = useMemo(() => {
    return (u: Unit) => {
      const pieces = unitPieceChars(u);
      return typeColors.filter((c) =>
        pieces.every((pc) => availability.get(pc)?.has(c.id))
      );
    };
  }, [typeColors, availability]);

  const size = catalog.baseSizes.find((s) => s.id === sizeId) ?? null;
  const variant =
    catalog.baseVariants.find(
      (v) => v.base_size_id === sizeId && v.base_color_id === colorId
    ) ?? null;
  const pendant = catalog.pendants.find((p) => p.id === pendantId) ?? null;
  const baseColor = catalog.baseColors.find((c) => c.id === colorId) ?? null;
  const baseType = catalog.baseTypes.find((t) => t.id === typeId) ?? null;

  const letters: LetterChoice[] = graphemes.map((ch, i) => ({
    position: i,
    char: ch,
    keycap_color_id: letterColors[i] ?? null,
  }));

  const price = calcPrice({
    variant,
    letters,
    keycapColors: catalog.keycapColors,
    pendant,
    addonPrice: catalog.addonPrice,
    addonCount: addonTotal,
  });

  const uniqueUnmakeable = Array.from(
    new Set(units.filter((u) => colorsForUnit(u).length === 0).map((u) => u.char))
  );

  // live preview letters for the mockup at the top:
  // - once text is typed, show each letter with its chosen color (grey until picked)
  // - before that, show as many empty slots as the chosen size, in the base color
  const previewLetters =
    graphemes.length > 0
      ? letters.map((l) => {
          const c = catalog.keycapColors.find((k) => k.id === l.keycap_color_id);
          return {
            char: l.char,
            key: c?.key_color ?? "#d1d5db",
            text: c?.text_color ?? "#9ca3af",
          };
        })
      : size
      ? Array.from({ length: size.max_chars }, () => ({
          char: "",
          key: "#d1d5db",
          text: "#9ca3af",
        }))
      : [];

  // sizes for the selected type that have an in-stock variant (chosen before text)
  const sizeOptions = catalog.baseSizes.filter(
    (s) => s.base_type_id === typeId && s.active && sizesWithVariant.has(s.id)
  );

  // colors available for the chosen size (from in-stock variants)
  const colorOptions = useMemo(() => {
    if (!sizeId) return [];
    return catalog.baseVariants
      .filter((v) => v.base_size_id === sizeId)
      .map((v) => ({
        variant: v,
        color: catalog.baseColors.find((c) => c.id === v.base_color_id)!,
      }))
      .filter((x) => x.color);
  }, [sizeId, catalog.baseVariants, catalog.baseColors]);

  function handleTextChange(v: string) {
    const upper = v.toUpperCase();
    setText(upper);
    const gs = splitGraphemes(upper);

    const next: Record<number, string> = {};
    gs.forEach((ch, i) => {
      const opts = colorsForUnit(decomposeCluster(ch));
      const current = letterColors[i];
      if (current && opts.some((c) => c.id === current)) next[i] = current;
      else if (opts.length > 0) next[i] = opts[0].id;
    });
    setLetterColors(next);
  }

  function chooseSize(id: string) {
    setSizeId(id);
    // reset color if it has no variant for this size
    if (colorId) {
      const ok = catalog.baseVariants.some(
        (v) => v.base_size_id === id && v.base_color_id === colorId
      );
      if (!ok) setColorId(null);
    }
  }

  const canLeaveText =
    graphemes.length > 0 &&
    !!size &&
    graphemes.length <= (size?.max_chars ?? 0) &&
    uniqueUnmakeable.length === 0;
  const allLettersColored = letters.every((l) => !!l.keycap_color_id);

  async function submit() {
    setError(null);
    if (!variant) return;
    setSubmitting(true);
    const payload: KeycapOrderPayload = {
      p_base_variant_id: variant.id,
      p_pendant_id: pendant?.id ?? null,
      p_layout: layout,
      p_letters: letters.map((l) => {
        const u = units[l.position];
        return {
          position: l.position,
          char: u.char,
          base: u.base,
          upper: u.upper,
          lower: u.lower,
          keycap_color_id: l.keycap_color_id,
        };
      }),
      p_note: note.trim() || null,
      p_customer_name: customerName.trim(),
      p_customer_contact: customerContact.trim() || null,
    };
    try {
      let orderId: string;
      if (onSubmit) {
        orderId = (await onSubmit(payload)).order_id;
      } else {
        const sb = createBrowserClient();
        const { data, error: rpcError } = await sb.rpc("place_order", payload);
        if (rpcError) {
          setError(translateError(rpcError.message));
          setSubmitting(false);
          return;
        }
        orderId = (data as { order_id: string }).order_id;
      }
      if (!adminMode) saveLastOrder(orderId);
      router.push(`/order/${orderId}`);
    } catch (e) {
      setError(
        onSubmit && e instanceof Error
          ? translateError(e.message)
          : "เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่"
      );
      setSubmitting(false);
    }
  }

  const sizeLabel = (maxChars: number) => `${maxChars} ช่อง`;

  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Link href={exitHref} className="text-sm text-muted">
            ← ออก
          </Link>
          <div className="text-sm font-medium">
            ขั้นที่ {step + 1}/{STEPS.length} · {STEPS[step]}
          </div>
          <div className="w-10" />
        </div>
        <div className="h-1 w-full bg-border">
          <div
            className="h-1 bg-primary transition-all"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        {/* live product preview, pinned at the top */}
        <div className="mx-auto max-w-lg px-4 py-1">
          <KeycapPreview3D
            letters={previewLetters}
            baseColor={baseColor?.swatch ?? null}
            layout={layout}
            shape={baseType?.shape ?? "rounded_square"}
            pendantName={pendant?.name ?? null}
            pendantImage={pendant?.image_url ?? null}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 pb-28">
        {step === 0 && (
          <section className="space-y-6">
            {catalog.baseTypes.length > 1 && (
              <div>
                <label className="mb-2 block font-semibold">เลือกแบบฐาน</label>
                <div className="flex flex-wrap gap-2">
                  {catalog.baseTypes.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTypeId(t.id);
                        setSizeId(null);
                        setColorId(null);
                        setLetterColors({});
                      }}
                      className={`rounded-xl border px-4 py-2 font-medium transition ${
                        t.id === typeId
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-primary"
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block font-semibold">
                เลือกจำนวนช่อง{baseType ? ` (${baseType.name})` : ""}
              </label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {sizeOptions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => chooseSize(s.id)}
                    className={`rounded-xl border px-3 py-3 text-center font-medium transition ${
                      s.id === sizeId
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary"
                    }`}
                  >
                    {sizeLabel(s.max_chars)}
                  </button>
                ))}
              </div>
            </div>

            {sizeId && (
              <div>
                <label className="mb-2 block font-semibold">เลือกสีฐาน</label>
                {colorOptions.length === 0 ? (
                  <p className="text-sm text-muted">ยังไม่มีสีสำหรับขนาดนี้</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {colorOptions.map(({ variant: v, color: c }) => {
                      const selected = c.id === colorId;
                      const img = v.image_url ?? c.image_url;
                      return (
                        <button
                          key={v.id}
                          onClick={() => setColorId(c.id)}
                          className={`rounded-xl border p-3 text-left transition ${
                            selected
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card hover:border-primary"
                          }`}
                        >
                          <div
                            className="mb-2 h-20 w-full rounded-lg border border-border bg-cover bg-center"
                            style={{
                              background: img ? undefined : c.swatch ?? "#ddd",
                              backgroundImage: img ? `url(${img})` : undefined,
                            }}
                          />
                          <div className="font-medium">{c.name}</div>
                          <div className="text-sm font-semibold text-primary">
                            {formatBaht(v.price)}
                          </div>
                          <div className={`text-xs ${v.available <= 3 ? "text-amber-600" : "text-muted"}`}>
                            เหลือ {v.available}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="mb-2 block font-semibold">
                แนวการจัดวางตัวหนังสือ
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { v: "horizontal", label: "แนวนอน", demo: "flex-row" },
                    { v: "vertical", label: "แนวตั้ง", demo: "flex-col" },
                  ] as const
                ).map((o) => {
                  const disabled = isThai && o.v === "vertical";
                  return (
                  <button
                    key={o.v}
                    disabled={disabled}
                    onClick={() => setLayout(o.v)}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                      layout === o.v
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary"
                    } ${disabled ? "cursor-not-allowed opacity-40 hover:border-border" : ""}`}
                  >
                    <span className={`flex ${o.demo} gap-0.5`}>
                      {["A", "B", "C"].map((c) => (
                        <span
                          key={c}
                          className="flex h-4 w-4 items-center justify-center rounded-sm bg-foreground text-[8px] font-bold text-background"
                        >
                          {c}
                        </span>
                      ))}
                    </span>
                    <span className="font-medium">{o.label}</span>
                  </button>
                  );
                })}
              </div>
              {isThai && (
                <p className="mt-2 text-xs text-muted">
                  ภาษาไทยรองรับเฉพาะแนวนอน (สระ/วรรณยุกต์ต้องเรียงในแนวเดียวกับพยัญชนะ)
                </p>
              )}
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-6">
            <div>
              <label className="mb-2 block font-semibold">
                พิมพ์ข้อความที่ต้องการ
              </label>
              <input
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="เช่น ALEX"
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-2xl font-bold tracking-widest outline-none focus:border-primary"
              />
              <p className="mt-2 text-sm text-muted">
                จำนวนช่อง (ตัวเต็ม): {units.length}
                {size ? ` / ${size.max_chars}` : ""}
                {addonTotal > 0 ? ` · ก้อนเสริม (สระ/วรรณยุกต์): ${addonTotal}` : ""}
              </p>
              {size && graphemes.length > size.max_chars && (
                <p className="mt-1 text-sm text-red-600">
                  ข้อความยาวเกิน {size.max_chars} ช่อง กรุณาลดจำนวนตัวอักษร
                </p>
              )}
              {uniqueUnmakeable.length > 0 && (
                <p className="mt-1 text-sm text-red-600">
                  ตัวที่ทำไม่ได้/หมดสต็อก: {uniqueUnmakeable.join(" ")}
                </p>
              )}
            </div>

            {graphemes.length > 0 && (
              <div>
                <label className="mb-3 block font-semibold">
                  เลือกสีของแต่ละตัวอักษร
                </label>
                <div className="space-y-3">
              {letters.map((l) => {
                const opts = colorsForUnit(units[l.position]);
                return (
                  <div
                    key={l.position}
                    className="rounded-xl border border-border bg-card p-3"
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-lg font-bold text-background">
                        {l.char}
                      </span>
                      <span className="text-sm text-muted">
                        ตัวที่ {l.position + 1}
                      </span>
                    </div>
                    {opts.length === 0 ? (
                      <p className="text-sm text-red-600">ไม่มีสีที่ทำได้</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {opts.map((c) => {
                          const selected = letterColors[l.position] === c.id;
                          return (
                            <button
                              key={c.id}
                              onClick={() =>
                                setLetterColors((prev) => ({
                                  ...prev,
                                  [l.position]: c.id,
                                }))
                              }
                              title={c.name}
                              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition ${
                                selected
                                  ? "border-primary scale-110"
                                  : "border-border"
                              }`}
                              style={{
                                background: c.key_color,
                                color: c.text_color,
                              }}
                            >
                              {l.char}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
                </div>
              </div>
            )}
          </section>
        )}

        {step === 2 && (
          <section>
            <label className="mb-3 block font-semibold">เลือกตัวห้อย</label>
            <div className="grid grid-cols-2 gap-3">
              {catalog.pendants.map((p) => {
                const selected = p.id === pendantId;
                const out = p.available <= 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => !out && setPendantId(p.id)}
                    disabled={out}
                    className={`rounded-xl border p-3 text-left transition ${
                      out
                        ? "cursor-not-allowed border-border bg-card opacity-50"
                        : selected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary"
                    }`}
                  >
                    <div
                      className="mb-2 flex h-16 w-full items-center justify-center rounded-lg border border-border bg-background bg-cover bg-center text-2xl"
                      style={{
                        backgroundImage: p.image_url
                          ? `url(${p.image_url})`
                          : undefined,
                      }}
                    >
                      {!p.image_url && "🔑"}
                    </div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted">
                      {Number(p.price) > 0 ? `+${formatBaht(p.price)}` : "ฟรี"}
                    </div>
                    <div className={`text-xs ${out ? "text-red-500" : p.available <= 3 ? "text-amber-600" : "text-muted"}`}>
                      {out ? "หมด" : `เหลือ ${p.available}`}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex justify-center">
                <div
                  className={`inline-flex flex-wrap gap-1 ${
                    layout === "vertical" ? "flex-col items-center" : "justify-center"
                  }`}
                >
                  {letters.map((l) => {
                    const c = catalog.keycapColors.find(
                      (k) => k.id === l.keycap_color_id
                    );
                    return (
                      <span
                        key={l.position}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-base font-bold shadow"
                        style={{
                          background: c?.key_color ?? "#888",
                          color: c?.text_color ?? "#fff",
                        }}
                      >
                        {l.char}
                      </span>
                    );
                  })}
                </div>
              </div>
              <dl className="space-y-1 text-sm">
                <Row label="ข้อความ" value={text} />
                <Row
                  label="ฐาน"
                  value={`${baseType ? baseType.name + " · " : ""}${
                    size ? size.max_chars + " ช่อง" : "-"
                  }`}
                />
                <Row label="แนววาง" value={layout === "vertical" ? "แนวตั้ง" : "แนวนอน"} />
                <Row label="สีฐาน" value={baseColor?.name ?? "-"} />
                <Row label="ตัวห้อย" value={pendant ? pendant.name : "ไม่มี"} />
              </dl>
            </div>

            <div>
              <label className="mb-2 block font-semibold">
                ชื่อเล่นผู้รับ <span className="text-red-500">*</span>
              </label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="เช่น ฝน"
                className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-primary"
              />
              <p className="mt-1 text-xs text-muted">
                ใช้เรียกตอนมารับ / ติดต่อกรณีลืมมารับ
              </p>
            </div>

            <div>
              <label className="mb-2 block font-semibold">
                ช่องทางติดต่อ (ถ้ามี)
              </label>
              <input
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                placeholder="เบอร์โทร / LINE ID"
                className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="mb-2 block font-semibold">
                หมายเหตุถึงร้าน (ถ้ามี)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="เช่น ขอรับภายในเย็นนี้"
                className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-primary"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
          </section>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t border-border bg-card">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="rounded-xl border border-border px-4 py-3 font-medium"
            >
              ย้อนกลับ
            </button>
          )}
          <div className="flex-1">
            <div className="text-xs text-muted">ราคารวม</div>
            <div className="text-lg font-bold">{formatBaht(price)}</div>
          </div>
          {step < STEPS.length - 1 ? (
            <button
              disabled={
                (step === 0 && !variant) ||
                (step === 1 && !(canLeaveText && allLettersColored))
              }
              onClick={() => setStep((s) => s + 1)}
              className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-40"
            >
              ถัดไป
            </button>
          ) : (
            <button
              disabled={submitting || !customerName.trim()}
              onClick={submit}
              className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-40"
            >
              {submitting ? "กำลังส่ง..." : submitLabel}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
