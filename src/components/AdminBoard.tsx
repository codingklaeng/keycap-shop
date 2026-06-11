"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { updateOrderStatus } from "@/lib/admin-actions";
import { formatBaht } from "@/lib/price";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/types";

type BoardLetter = {
  position: number;
  char: string;
  keycap_colors: { name: string; swatch: string | null } | null;
};

type BoardOrder = {
  id: string;
  queue_number: string;
  status: OrderStatus;
  text: string;
  total_price: number;
  note: string | null;
  created_at: string;
  base_sizes: { label: string } | null;
  base_colors: { name: string; swatch: string | null } | null;
  pendants: { name: string } | null;
  order_letters: BoardLetter[];
};

const SELECT =
  "id,queue_number,status,text,total_price,note,created_at," +
  "base_sizes(label),base_colors(name,swatch),pendants(name)," +
  "order_letters(position,char,keycap_colors(name,swatch))";

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
    const sb = createBrowserClient();
    const { data } = await sb
      .from("orders")
      .select(SELECT)
      .eq("queue_date", today)
      .order("created_at", { ascending: true });
    setOrders((data ?? []) as unknown as BoardOrder[]);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    load();
    const sb = createBrowserClient();
    const channel = sb
      .channel("admin-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => load()
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [load]);

  async function changeStatus(id: string, to: OrderStatus) {
    setBusy(id);
    // optimistic
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
            onCancel={(id) => changeStatus(id, "cancelled")}
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
          {ORDER_STATUS_LABEL[order.status]}
        </span>
      </div>

      {/* letters with colors for assembly */}
      <div className="mt-3 flex flex-wrap gap-1">
        {letters.map((l) => (
          <span
            key={l.position}
            className="flex h-9 w-9 items-center justify-center rounded-md text-base font-bold text-white shadow"
            style={{ background: l.keycap_colors?.swatch ?? "#888" }}
            title={l.keycap_colors?.name ?? ""}
          >
            {l.char}
          </span>
        ))}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <Info label="ฐาน" value={order.base_sizes?.label ?? "-"} />
        <Info label="สีฐาน" value={order.base_colors?.name ?? "-"} />
        <Info label="ตัวห้อย" value={order.pendants?.name ?? "ไม่มี"} />
        <Info label="ราคา" value={formatBaht(Number(order.total_price))} />
      </dl>
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
