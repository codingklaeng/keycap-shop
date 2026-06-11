"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import { formatBaht } from "@/lib/price";
import { saveLastOrder } from "@/components/TrackOrderButton";
import type { SocialPlatform } from "@/lib/types";

const ERROR_TH: Record<string, string> = {
  EMPTY_VALUE: "กรุณากรอกชื่อช่อง/ลิงก์",
  PLATFORM_INVALID: "แพลตฟอร์มไม่ถูกต้อง",
  PLATFORM_OUT: "แพลตฟอร์มนี้หมดสต็อกแล้ว",
};

// preview the generated url the same way the server does
function previewUrl(p: SocialPlatform, value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return p.url_template.replace("{id}", v.replace(/^@/, ""));
}

export function NfcWizard({ platforms }: { platforms: SocialPlatform[] }) {
  const router = useRouter();
  const [platformId, setPlatformId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const platform = platforms.find((p) => p.id === platformId) ?? null;
  const price = platform ? Number(platform.price) : 0;
  const canSubmit = !!platform && value.trim().length > 0;

  async function submit() {
    setError(null);
    if (!platform) return;
    setSubmitting(true);
    try {
      const sb = createBrowserClient();
      const { data, error: rpcError } = await sb.rpc("place_nfc_order", {
        p_platform_id: platform.id,
        p_social_value: value.trim(),
        p_note: note.trim() || null,
      });
      if (rpcError) {
        setError(ERROR_TH[rpcError.message] ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
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
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm text-muted">
            ← ออก
          </Link>
          <div className="text-sm font-medium">พวงกุญแจ NFC</div>
          <div className="w-10" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 pb-28 space-y-6">
        <div>
          <label className="mb-2 block font-semibold">เลือกแพลตฟอร์ม</label>
          <div className="grid grid-cols-2 gap-3">
            {platforms.map((p) => {
              const selected = p.id === platformId;
              return (
                <button
                  key={p.id}
                  onClick={() => setPlatformId(p.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary"
                  }`}
                >
                  <div className="text-2xl">{p.icon ?? "🔗"}</div>
                  <div className="mt-1 font-medium">{p.name}</div>
                  <div className="text-sm font-semibold text-primary">
                    {formatBaht(p.price)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {platform && (
          <div>
            <label className="mb-2 block font-semibold">
              ชื่อช่อง / ID ของ {platform.name}
            </label>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={platform.hint ?? "username หรือวางลิงก์เต็ม"}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-primary"
            />
            {value.trim() && (
              <p className="mt-2 break-all text-xs text-muted">
                ลิงก์ที่จะเขียนลง NFC: {previewUrl(platform, value)}
              </p>
            )}
          </div>
        )}

        {platform && (
          <div>
            <label className="mb-2 block font-semibold">
              หมายเหตุถึงร้าน (ถ้ามี)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-primary"
            />
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t border-border bg-card">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <div className="text-xs text-muted">ราคารวม</div>
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
