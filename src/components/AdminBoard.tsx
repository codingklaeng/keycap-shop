"use client";

import { useCallback, useEffect, useState } from "react";
import {
  updateOrderStatus,
  cancelOrder,
  getTodayOrders,
} from "@/lib/admin-actions";
import { formatBaht } from "@/lib/price";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/types";
import { CopyButton } from "@/components/CopyButton";

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
  status: OrderStatus;
  text: string;
  total_price: number;
  note: string | null;
  created_at: string;
  product_type: "keycap" | "nfc";
  layout: "horizontal" | "vertical" | null;
  base_sizes: { max_chars: number; base_types: { name: string } | null } | null;
  base_colors: { name: string; swatch: string | null } | null;
  pendants: { name: string } | null;
  order_letters: BoardLetter[];
  order_nfc: BoardNfc | BoardNfc[] | null;
};

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

  const load = useCallback(async () => {
    try {
      const data = await getTodayOrders(today);
      setOrders(data as unknown as BoardOrder[]);
    } catch {
      // ignore transient errors; next poll retries
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // near-realtime via polling
    return () => clearInterval(t);
  }, [load]);

  async function changeStatus(id: string, to: OrderStatus) {
    setBusy(id);
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: to } : o))
    );
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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">คิววันนี้</h1>
        <span className="text-sm text-muted">
          ทั้งหมด {orders.length} · รอทำ {active.length}
        </span>
      </div>

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
            busy={busy === o.id}
            onAdvance={changeStatus}
            onCancel={(id) => cancel(id)}
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
  busy,
  onAdvance,
  onCancel,
}: {
  order: BoardOrder;
  busy: boolean;
  onAdvance: (id: string, to: OrderStatus) => void;
  onCancel: (id: string) => void;
}) {
  const next = NEXT_ACTION[order.status];
  const letters = [...order.order_letters].sort(
    (a, b) => a.position - b.position
  );
  const isNfc = order.product_type === "nfc";
  const nfc = nfcOf(order);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
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
        <span className="rounded-full bg-background px-3 py-1 text-xs font-medium">
          {isNfc ? "📱 NFC · " : ""}
          {ORDER_STATUS_LABEL[order.status]}
        </span>
      </div>

      {isNfc ? (
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
