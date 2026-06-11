"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import { splitGraphemes } from "@/lib/graphemes";
import { calcPrice, formatBaht } from "@/lib/price";
import { saveLastOrder } from "@/components/TrackOrderButton";
import type { Catalog, LetterChoice } from "@/lib/types";

const STEPS = ["ข้อความ", "สีฐาน", "สีตัวอักษร", "ตัวห้อย", "ยืนยัน"];

const ERROR_TH: Record<string, string> = {
  EMPTY_TEXT: "กรุณาพิมพ์ข้อความ",
  TEXT_TOO_LONG: "ข้อความยาวเกินขนาดฐานที่เลือก",
  BASE_SIZE_INVALID: "ขนาดฐานไม่ถูกต้อง",
  BASE_COLOR_INVALID: "สีฐานไม่ถูกต้อง",
  BASE_COLOR_OUT: "สีฐานที่เลือกหมดสต็อกแล้ว",
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

export function Wizard({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [text, setText] = useState("");
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [baseColorId, setBaseColorId] = useState<string | null>(null);
  const [letterColors, setLetterColors] = useState<Record<number, string>>({});
  const [pendantId, setPendantId] = useState<string | null>(
    catalog.pendants[0]?.id ?? null
  );
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // char -> set of color ids that have stock for that char
  const availability = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const s of catalog.keycapStock) {
      if (s.stock <= 0) continue;
      if (!map.has(s.char)) map.set(s.char, new Set());
      map.get(s.char)!.add(s.color_id);
    }
    return map;
  }, [catalog.keycapStock]);

  const graphemes = useMemo(() => splitGraphemes(text), [text]);
  const size = catalog.baseSizes.find((s) => s.id === sizeId) ?? null;
  const baseColor = catalog.baseColors.find((c) => c.id === baseColorId) ?? null;
  const pendant = catalog.pendants.find((p) => p.id === pendantId) ?? null;

  const letters: LetterChoice[] = graphemes.map((ch, i) => ({
    position: i,
    char: ch,
    keycap_color_id: letterColors[i] ?? null,
  }));

  const price = calcPrice({
    size,
    baseColor,
    letters,
    keycapColors: catalog.keycapColors,
    pendant,
  });

  // characters that the shop cannot make (no color in stock)
  const unmakeable = graphemes.filter(
    (ch) => !availability.has(ch) || availability.get(ch)!.size === 0
  );
  const uniqueUnmakeable = Array.from(new Set(unmakeable));

  function colorsForChar(ch: string) {
    const ids = availability.get(ch) ?? new Set<string>();
    return catalog.keycapColors.filter((c) => ids.has(c.id));
  }

  function handleTextChange(v: string) {
    // keycaps are uppercase; match the seeded stock and typical look
    const upper = v.toUpperCase();
    setText(upper);
    // assign a default color for any newly added position
    const next: Record<number, string> = {};
    const gs = splitGraphemes(upper);
    gs.forEach((ch, i) => {
      const opts = availability.get(ch);
      const current = letterColors[i];
      if (current && opts?.has(current)) {
        next[i] = current;
      } else if (opts && opts.size > 0) {
        // pick first available color (in catalog order)
        const first = catalog.keycapColors.find((c) => opts.has(c.id));
        if (first) next[i] = first.id;
      }
    });
    setLetterColors(next);
  }

  // ---- step validation ----
  const sizesThatFit = catalog.baseSizes.filter(
    (s) => graphemes.length <= s.max_chars
  );
  const canLeaveText =
    graphemes.length > 0 &&
    !!size &&
    graphemes.length <= (size?.max_chars ?? 0) &&
    uniqueUnmakeable.length === 0;
  const canLeaveBaseColor = !!baseColor;
  const allLettersColored = letters.every((l) => !!l.keycap_color_id);
  const canLeaveLetters = allLettersColored;

  async function submit() {
    setError(null);
    if (!size || !baseColor) return;
    setSubmitting(true);
    try {
      const sb = createBrowserClient();
      const { data, error: rpcError } = await sb.rpc("place_order", {
        p_base_size_id: size.id,
        p_base_color_id: baseColor.id,
        p_pendant_id: pendant?.id ?? null,
        p_letters: letters.map((l) => ({
          position: l.position,
          char: l.char,
          keycap_color_id: l.keycap_color_id,
        })),
        p_note: note.trim() || null,
      });
      if (rpcError) {
        setError(translateError(rpcError.message));
        setSubmitting(false);
        return;
      }
      const orderId = (data as { order_id: string }).order_id;
      saveLastOrder(orderId);
      router.push(`/order/${orderId}`);
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm text-muted">
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
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 pb-28">
        {step === 0 && (
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
                จำนวนตัวอักษร: {graphemes.length}
              </p>
              {uniqueUnmakeable.length > 0 && (
                <p className="mt-1 text-sm text-red-600">
                  ตัวที่ทำไม่ได้/หมดสต็อก: {uniqueUnmakeable.join(" ")}
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block font-semibold">เลือกขนาดฐาน</label>
              <div className="grid gap-2">
                {catalog.baseSizes.map((s) => {
                  const fits = graphemes.length <= s.max_chars;
                  const selected = s.id === sizeId;
                  return (
                    <button
                      key={s.id}
                      disabled={!fits && graphemes.length > 0}
                      onClick={() => setSizeId(s.id)}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card"
                      } ${
                        !fits && graphemes.length > 0
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:border-primary"
                      }`}
                    >
                      <div>
                        <div className="font-medium">{s.label}</div>
                        <div className="text-xs text-muted">
                          สูงสุด {s.max_chars} ตัว
                        </div>
                      </div>
                      <div className="font-semibold">{formatBaht(s.price)}</div>
                    </button>
                  );
                })}
              </div>
              {graphemes.length > 0 && sizesThatFit.length === 0 && (
                <p className="mt-2 text-sm text-red-600">
                  ข้อความยาวเกินทุกขนาด กรุณาลดจำนวนตัวอักษร
                </p>
              )}
            </div>
          </section>
        )}

        {step === 1 && (
          <section>
            <label className="mb-3 block font-semibold">เลือกสีฐาน</label>
            <div className="grid grid-cols-2 gap-3">
              {catalog.baseColors.map((c) => {
                const selected = c.id === baseColorId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setBaseColorId(c.id)}
                    className={`rounded-xl border p-3 text-left transition ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary"
                    }`}
                  >
                    <div
                      className="mb-2 h-16 w-full rounded-lg border border-border bg-cover bg-center"
                      style={{
                        background: c.image_url
                          ? undefined
                          : c.swatch ?? "#ddd",
                        backgroundImage: c.image_url
                          ? `url(${c.image_url})`
                          : undefined,
                      }}
                    />
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted">
                      {Number(c.price_modifier) > 0
                        ? `+${formatBaht(c.price_modifier)}`
                        : "ราคามาตรฐาน"}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <label className="mb-3 block font-semibold">
              เลือกสีของแต่ละตัวอักษร
            </label>
            <div className="space-y-3">
              {letters.map((l) => {
                const opts = colorsForChar(l.char);
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
                              className={`h-9 w-9 rounded-full border-2 transition ${
                                selected
                                  ? "border-primary scale-110"
                                  : "border-border"
                              }`}
                              style={{ background: c.swatch ?? "#ddd" }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <label className="mb-3 block font-semibold">เลือกตัวห้อย</label>
            <div className="grid grid-cols-2 gap-3">
              {catalog.pendants.map((p) => {
                const selected = p.id === pendantId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPendantId(p.id)}
                    className={`rounded-xl border p-3 text-left transition ${
                      selected
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
                      {Number(p.price) > 0
                        ? `+${formatBaht(p.price)}`
                        : "ฟรี"}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 text-center">
                <div className="inline-flex flex-wrap justify-center gap-1">
                  {letters.map((l) => {
                    const c = catalog.keycapColors.find(
                      (k) => k.id === l.keycap_color_id
                    );
                    return (
                      <span
                        key={l.position}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-base font-bold text-white shadow"
                        style={{ background: c?.swatch ?? "#888" }}
                      >
                        {l.char}
                      </span>
                    );
                  })}
                </div>
              </div>
              <dl className="space-y-1 text-sm">
                <Row label="ข้อความ" value={text} />
                <Row label="ขนาดฐาน" value={size?.label ?? "-"} />
                <Row label="สีฐาน" value={baseColor?.name ?? "-"} />
                <Row
                  label="ตัวห้อย"
                  value={pendant ? pendant.name : "ไม่มี"}
                />
              </dl>
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

      {/* footer nav + live price */}
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
                (step === 0 && !canLeaveText) ||
                (step === 1 && !canLeaveBaseColor) ||
                (step === 2 && !canLeaveLetters)
              }
              onClick={() => setStep((s) => s + 1)}
              className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-40"
            >
              ถัดไป
            </button>
          ) : (
            <button
              disabled={submitting}
              onClick={submit}
              className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-60"
            >
              {submitting ? "กำลังส่ง..." : "ยืนยันสั่ง"}
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
