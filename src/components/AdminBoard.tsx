"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  updateOrderStatus,
  cancelOrder,
  getTodayOrders,
} from "@/lib/admin-actions";
import { formatBaht } from "@/lib/price";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/types";
import { CopyButton } from "@/components/CopyButton";
import { announceQueue, primeAudio } from "@/lib/announce";
import { VoiceSettingsPanel } from "@/components/VoiceSettingsPanel";
import { DownloadStlButton } from "@/components/DownloadStlButton";
import type { NameplateSpec } from "@/lib/nameplate";

type BoardLetter = {
  position: number;
  char: string;
  keycap_colors: { name: string; key_color: string; text_color: string } | null;
};

type BoardNfc = {
  social_value: string;
  social_url: string;
  social_platforms: { name: string; icon: string | null; image_url: string | null } | null;
};

type BoardOrder = {
  id: string;
  queue_number: string;
  queue_date: string;
  status: OrderStatus;
  text: string;
  total_price: number;
  note: string | null;
  created_at: string;
  product_type: "keycap" | "nfc" | "nameplate";
  layout: "horizontal" | "vertical" | null;
  customer_name: string | null;
  customer_contact: string | null;
  base_sizes: { max_chars: number; base_types: { name: string } | null } | null;
  base_colors: { name: string; swatch: string | null } | null;
  pendants: { name: string } | null;
  order_letters: BoardLetter[];
  order_nfc: BoardNfc | BoardNfc[] | null;
  order_nameplate: BoardNameplate | BoardNameplate[] | null;
};

type BoardNameplate = { text: string; spec: NameplateSpec };

function nameplateOf(o: BoardOrder): BoardNameplate | null {
  const n = o.order_nameplate;
  if (!n) return null;
  return Array.isArray(n) ? n[0] ?? null : n;
}

function ringLabel(r?: string) {
  return r === "left" ? "ซ้าย" : r === "right" ? "ขวา" : r === "top" ? "บน" : "ไม่มี";
}

function baseLabel(o: BoardOrder): string {
  const s = o.base_sizes;
  if (!s) return "-";
  return `${s.base_types ? s.base_types.name + " · " : ""}${s.max_chars} ช่อง`;
}

function nfcOf(o: BoardOrder): BoardNfc | null {
  const n = o.order_nfc;
  if (!n) return null;
  return Array.isArray(n) ? (n[0] ?? null) : n;
}

// status -> next action button
const NEXT_ACTION: Partial<
  Record<OrderStatus, { to: OrderStatus; label: string }>
> = {
  pending: { to: "in_progress", label: "เริ่มทำ" },
  in_progress: { to: "ready", label: "ทำเสร็จ · แจ้งลูกค้า" },
  ready: { to: "picked_up", label: "ลูกค้ารับแล้ว" },
};

const COLUMN_STATUSES: OrderStatus[] = ["pending", "in_progress", "ready"];

export function AdminBoard({ today }: { today: string }) {
  const [orders, setOrders] = useState<BoardOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const announced = useRef<Set<string>>(new Set());
  const seeded = useRef(false);

  useEffect(() => {
    try {
      setSoundOn(localStorage.getItem("keycap_sound") === "1");
    } catch {}
  }, []);

  const load = useCallback(async () => {
    try {
      const data = (await getTodayOrders(today)) as unknown as BoardOrder[];
      setOrders(data);
      // voice-announce orders that became 'ready' (skip the initial seed so
      // already-ready orders don't all shout when the page opens)
      for (const o of data) {
        if (o.status === "ready" && !announced.current.has(o.id)) {
          announced.current.add(o.id);
          if (seeded.current && soundOn) {
            announceQueue(o.queue_number, o.customer_name);
          }
        }
      }
      seeded.current = true;
    } catch {
      // ignore transient errors; next poll retries
    } finally {
      setLoading(false);
    }
  }, [today, soundOn]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // near-realtime via polling
    return () => clearInterval(t);
  }, [load]);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    try {
      localStorage.setItem("keycap_sound", next ? "1" : "0");
    } catch {}
    if (next) primeAudio(); // unlock audio on this gesture + confirm aloud
  }

  async function changeStatus(id: string, to: OrderStatus) {
    setBusy(id);
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: to } : o))
    );
    if (to === "ready") {
      const o = orders.find((x) => x.id === id);
      announced.current.add(id);
      if (soundOn) announceQueue(o?.queue_number ?? "", o?.customer_name ?? null);
    }
    try {
      await updateOrderStatus(id, to);
    } catch {
      load();
    } finally {
      setBusy(null);
    }
  }

  async function cancel(id: string) {
    setBusy(id);
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "cancelled" } : o))
    );
    try {
      await cancelOrder(id);
    } catch {
      load();
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <p className="p-8 text-center text-muted">กำลังโหลด...</p>;
  }

  const active = orders.filter((o) => COLUMN_STATUSES.includes(o.status));
  const done = orders.filter(
    (o) => o.status === "picked_up" || o.status === "cancelled"
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold">คิววันนี้</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">
            ทั้งหมด {orders.length} · รอทำ {active.length}
          </span>
          <button
            onClick={toggleSound}
            title="เสียงเรียกคิว"
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              soundOn
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted"
            }`}
          >
            {soundOn ? "🔊 เสียงเปิด" : "🔇 เสียงปิด"}
          </button>
          <button
            onClick={() => setShowVoice((v) => !v)}
            title="ตั้งค่าเสียง"
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted"
          >
            ⚙️
          </button>
        </div>
      </div>

      {showVoice && <VoiceSettingsPanel onClose={() => setShowVoice(false)} />}

      {active.length === 0 && (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-muted">
          ยังไม่มีออเดอร์ที่ต้องทำ
        </p>
      )}

      <div className="space-y-3">
        {active.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            today={today}
            busy={busy === o.id}
            onAdvance={changeStatus}
            onCancel={(id) => cancel(id)}
            onAnnounce={() => announceQueue(o.queue_number, o.customer_name)}
          />
        ))}
      </div>

      {done.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-muted">
            ออเดอร์ที่เสร็จ/ยกเลิกแล้ว ({done.length})
          </summary>
          <div className="mt-3 space-y-2">
            {done.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2 text-sm"
              >
                <span className="font-semibold">{o.queue_number}</span>
                <span className="text-muted">{o.text}</span>
                <span>{ORDER_STATUS_LABEL[o.status]}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function OrderCard({
  order,
  today,
  busy,
  onAdvance,
  onCancel,
  onAnnounce,
}: {
  order: BoardOrder;
  today: string;
  busy: boolean;
  onAdvance: (id: string, to: OrderStatus) => void;
  onCancel: (id: string) => void;
  onAnnounce: () => void;
}) {
  const next = NEXT_ACTION[order.status];
  const letters = [...order.order_letters].sort(
    (a, b) => a.position - b.position
  );
  const isNfc = order.product_type === "nfc";
  const isNameplate = order.product_type === "nameplate";
  const nfc = nfcOf(order);
  const np = nameplateOf(order);
  const isOld = order.queue_date !== today;

  return (
    <div
      className={`rounded-xl border bg-card p-4 ${
        isOld ? "border-amber-400" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-extrabold">{order.queue_number}</div>
          <div className="text-xs text-muted">
            {new Date(order.created_at).toLocaleTimeString("th-TH", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full bg-background px-3 py-1 text-xs font-medium">
            {isNfc ? "📱 NFC · " : isNameplate ? "🔤 ป้ายชื่อ · " : ""}
            {ORDER_STATUS_LABEL[order.status]}
          </span>
          {isOld && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              ⚠ ค้างรับจาก {order.queue_date}
            </span>
          )}
        </div>
      </div>

      {/* customer */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-medium">
          👤 {order.customer_name || "—"}
        </span>
        {order.customer_contact && (
          <a
            href={`tel:${order.customer_contact}`}
            className="text-primary underline"
          >
            📞 {order.customer_contact}
          </a>
        )}
      </div>

      {isNameplate ? (
        /* Nameplate: show text + download the STL to 3D-print */
        <div className="mt-3 space-y-2">
          <div className="text-lg font-bold" style={{ fontFamily: np?.spec.font }}>
            {np?.text ?? order.text}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <Info label="ฟอนต์" value={String(np?.spec.font ?? "-")} />
            <Info label="ขนาด" value={`${np?.spec.size ?? "-"} มม.`} />
            <Info label="ห่วง" value={ringLabel(np?.spec.ring)} />
            <Info label="ราคา" value={formatBaht(Number(order.total_price))} />
          </dl>
          {np && (
            <DownloadStlButton
              spec={np.spec}
              filename={`${order.queue_number}-${np.text}.stl`}
            />
          )}
        </div>
      ) : isNfc ? (
        /* NFC: show platform + handle + generated url to write to the tag */
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 font-medium">
            {nfc?.social_platforms?.image_url ? (
              <img
                src={nfc.social_platforms.image_url}
                alt=""
                className="h-6 w-6 rounded object-cover"
              />
            ) : (
              <span className="text-lg">{nfc?.social_platforms?.icon ?? "🔗"}</span>
            )}
            {nfc?.social_platforms?.name ?? "-"}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <Info label="ราคา" value={formatBaht(Number(order.total_price))} />
            <Info label="ช่อง/ID" value={nfc?.social_value ?? order.text} />
          </dl>
          <div className="flex items-center gap-2 rounded-lg bg-background px-3 py-2">
            <code className="flex-1 break-all text-xs">{nfc?.social_url}</code>
            {nfc?.social_url && <CopyButton text={nfc.social_url} label="คัดลอก URL" />}
          </div>
        </div>
      ) : (
        <>
          {/* letters with colors for assembly, in the chosen orientation */}
          <div
            className={`mt-3 flex flex-wrap gap-1 ${
              order.layout === "vertical" ? "flex-col items-start" : ""
            }`}
          >
            {letters.map((l) => (
              <span
                key={l.position}
                className="flex h-9 w-9 items-center justify-center rounded-md text-base font-bold shadow"
                style={{
                  background: l.keycap_colors?.key_color ?? "#888",
                  color: l.keycap_colors?.text_color ?? "#fff",
                }}
                title={l.keycap_colors?.name ?? ""}
              >
                {l.char}
              </span>
            ))}
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <Info label="ฐาน" value={baseLabel(order)} />
            <Info
              label="แนววาง"
              value={order.layout === "vertical" ? "แนวตั้ง" : "แนวนอน"}
            />
            <Info label="สีฐาน" value={order.base_colors?.name ?? "-"} />
            <Info label="ตัวห้อย" value={order.pendants?.name ?? "ไม่มี"} />
            <Info label="ราคา" value={formatBaht(Number(order.total_price))} />
          </dl>
        </>
      )}
      {order.note && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          📝 {order.note}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {next && (
          <button
            disabled={busy}
            onClick={() => onAdvance(order.id, next.to)}
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {next.label}
          </button>
        )}
        {order.status === "ready" && (
          <button
            onClick={onAnnounce}
            title="เรียกคิวด้วยเสียงอีกครั้ง"
            className="rounded-xl border border-primary px-4 py-2.5 text-sm font-medium text-primary"
          >
            📢 เรียกซ้ำ
          </button>
        )}
        {order.status !== "ready" && (
          <button
            disabled={busy}
            onClick={() => {
              if (confirm("ยกเลิกออเดอร์นี้?")) onCancel(order.id);
            }}
            className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted disabled:opacity-50"
          >
            ยกเลิก
          </button>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
