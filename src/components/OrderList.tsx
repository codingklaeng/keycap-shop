"use client";

import Link from "next/link";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/types";

export type OrderSummary = {
  id: string;
  queue_number: string;
  queue_date: string;
  status: OrderStatus;
  product_type: "keycap" | "nfc" | "nameplate";
  text: string;
  created_at: string;
};

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: "bg-gray-100 text-gray-700",
  in_progress: "bg-amber-100 text-amber-800",
  ready: "bg-green-100 text-green-800",
  picked_up: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-700",
};

function productLabel(t: OrderSummary["product_type"]): string {
  if (t === "nfc") return "📱 NFC";
  if (t === "nameplate") return "🔤 ป้ายชื่อ 3D";
  return "⌨️ คีย์แคป";
}

export function OrderSummaryItem({ order }: { order: OrderSummary }) {
  return (
    <Link
      href={`/order/${order.id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition hover:border-primary"
    >
      <span className="text-xl font-extrabold tabular-nums">{order.queue_number}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{order.text || "—"}</span>
        <span className="block text-xs text-muted">
          {productLabel(order.product_type)} ·{" "}
          {new Date(order.created_at).toLocaleDateString("th-TH", {
            day: "numeric",
            month: "short",
          })}
        </span>
      </span>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[order.status]}`}
      >
        {ORDER_STATUS_LABEL[order.status]}
      </span>
    </Link>
  );
}

export function OrderSummaryList({ orders }: { orders: OrderSummary[] }) {
  return (
    <div className="space-y-2">
      {orders.map((o) => (
        <OrderSummaryItem key={o.id} order={o} />
      ))}
    </div>
  );
}
