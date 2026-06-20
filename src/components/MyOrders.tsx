"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import { readHistory } from "@/components/TrackOrderButton";
import { OrderSummaryList, type OrderSummary } from "@/components/OrderList";

// Lists every order saved on this device (live status from the server).
export function MyOrders() {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);

  useEffect(() => {
    const ids = readHistory();
    if (ids.length === 0) {
      setOrders([]);
      return;
    }
    (async () => {
      try {
        const sb = createBrowserClient();
        const { data } = await sb.rpc("get_orders_summary", { p_ids: ids });
        setOrders((data as OrderSummary[]) ?? []);
      } catch {
        setOrders([]);
      }
    })();
  }, []);

  if (orders === null) {
    return <p className="py-8 text-center text-muted">กำลังโหลด...</p>;
  }

  return (
    <div className="space-y-4">
      {orders.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-muted">
          ไม่พบออเดอร์ในเครื่องนี้
        </p>
      ) : (
        <OrderSummaryList orders={orders} />
      )}

      <Link
        href="/track"
        className="block text-center text-sm text-primary underline"
      >
        เปลี่ยนเครื่อง / ไม่เจอออเดอร์? ค้นด้วยเบอร์โทร
      </Link>
    </div>
  );
}
