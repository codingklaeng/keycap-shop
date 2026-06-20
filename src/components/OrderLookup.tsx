"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { OrderSummaryList, type OrderSummary } from "@/components/OrderList";

// Customer self-service: find orders by the phone/LINE they gave at checkout —
// works even on a new device or after clearing the browser.
export function OrderLookup() {
  const [contact, setContact] = useState("");
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function search() {
    const q = contact.trim();
    if (q.length < 4) return;
    setLoading(true);
    try {
      const sb = createBrowserClient();
      const { data } = await sb.rpc("find_orders_by_contact", { p_contact: q });
      setOrders((data as OrderSummary[]) ?? []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          inputMode="tel"
          placeholder="เบอร์โทร / LINE ที่ให้ไว้ตอนสั่ง"
          className="flex-1 rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-primary"
        />
        <button
          onClick={search}
          disabled={loading || contact.trim().length < 4}
          className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-40"
        >
          {loading ? "..." : "ค้นหา"}
        </button>
      </div>

      {orders !== null &&
        (orders.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-muted">
            ไม่พบออเดอร์ที่ใช้เบอร์/ไลน์นี้
            <br />
            <span className="text-xs">ลองพิมพ์ให้ตรงกับที่กรอกตอนสั่ง</span>
          </p>
        ) : (
          <OrderSummaryList orders={orders} />
        ))}
    </div>
  );
}
