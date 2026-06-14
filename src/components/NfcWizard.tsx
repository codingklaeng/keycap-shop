"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import { formatBaht } from "@/lib/price";
import { saveLastOrder } from "@/components/TrackOrderButton";
import { NfcPreview3D } from "@/components/NfcPreview3D";
import type { SocialPlatform } from "@/lib/types";

const ERROR_TH: Record<string, string> = {
  EMPTY_VALUE: "กรุณากรอกชื่อช่อง/ลิงก์",
  PLATFORM_INVALID: "แพลตฟอร์มไม่ถูกต้อง",
  PLATFORM_OUT: "แพลตฟอร์มนี้หมดสต็อกแล้ว",
};

// Resolve what the customer typed into a final URL + the value to send,
// with friendly validation. Mirrors the server's generation rules.
function resolve(
  p: SocialPlatform,
  raw: string
): { url: string; sendValue: string; error: string | null } {
  const v = raw.trim();
  if (!v) return { url: "", sendValue: "", error: null };

  // full link pasted -> use as-is (works for any platform)
  if (/^https?:\/\//i.test(v)) return { url: v, sendValue: v, error: null };

  const isUsernameField = /^https?:\/\//i.test(p.url_template);

  if (isUsernameField) {
    const h = v.replace(/^@+/, ""); // drop leading @
    if (/\s/.test(h)) {
      return {
        url: "",
        sendValue: h,
        error: "ชื่อช่องต้องไม่มีเว้นวรรค — ใช้ username (เช่น codingklaeng) ไม่ใช่ชื่อเพจ",
      };
    }
    if (!/^[A-Za-z0-9._-]+$/.test(h)) {
      return {
        url: "",
        sendValue: h,
        error: "ใช้ได้เฉพาะ A-Z 0-9 . _ -  (หรือวางลิงก์เต็ม https://...)",
      };
    }
    return { url: p.url_template.replace("{id}", h), sendValue: h, error: null };
  }

  // free-link platform (เว็บไซต์/ลิงก์อื่น): ensure it has a scheme
  if (/\s/.test(v)) {
    return { url: "", sendValue: v, error: "ลิงก์ต้องไม่มีเว้นวรรค" };
  }
  const withScheme = "https://" + v;
  return { url: withScheme, sendValue: withScheme, error: null };
}

export function NfcWizard({ platforms }: { platforms: SocialPlatform[] }) {
  const router = useRouter();
  const [platformId, setPlatformId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const platform = platforms.find((p) => p.id === platformId) ?? null;
  const price = platform ? Number(platform.price) : 0;
  const resolved = platform ? resolve(platform, value) : null;
  const canSubmit = !!resolved && resolved.url !== "" && !resolved.error;

  async function submit() {
    setError(null);
    if (!platform || !resolved || !canSubmit) return;
    setSubmitting(true);
    try {
      const sb = createBrowserClient();
      const { data, error: rpcError } = await sb.rpc("place_nfc_order", {
        p_platform_id: platform.id,
        p_social_value: resolved.sendValue,
        p_note: note.trim() || null,
        p_customer_name: customerName.trim() || null,
        p_customer_contact: customerContact.trim() || null,
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
        {/* live 3D preview: tag + phone tapping to open the app */}
        <div className="mx-auto max-w-lg px-4 pb-1">
          <NfcPreview3D
            name={platform?.name ?? null}
            icon={platform?.icon ?? null}
            imageUrl={platform?.image_url ?? null}
            brandColor={platform?.brand_color ?? null}
            value={value}
          />
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
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="text-2xl">{p.icon ?? "🔗"}</div>
                  )}
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
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={`w-full rounded-xl border bg-card px-4 py-3 outline-none focus:border-primary ${
                resolved?.error ? "border-red-400" : "border-border"
              }`}
            />
            <p className="mt-1 text-xs text-muted">
              💡 กรอก username/ID ก็ได้ หรือก๊อปลิงก์หน้าโปรไฟล์มาวางทั้งลิงก์
            </p>
            {resolved?.error && (
              <p className="mt-1 text-xs text-red-600">{resolved.error}</p>
            )}
            {resolved?.url && (
              <p className="mt-2 break-all rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">
                ✓ ลิงก์ที่จะเขียนลง NFC: {resolved.url}
              </p>
            )}
          </div>
        )}

        {platform && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block font-semibold">ชื่อเล่นผู้รับ</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="เช่น ฝน"
                className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-2 block font-semibold">ติดต่อ (ถ้ามี)</label>
              <input
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                placeholder="เบอร์ / LINE"
                className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-primary"
              />
            </div>
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
