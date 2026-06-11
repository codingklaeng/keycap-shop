"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import { formatBaht } from "@/lib/price";
import { ORDER_STATUS_LABEL, type OrderDetail, type OrderStatus as Status } from "@/lib/types";
import { saveLastOrder } from "@/components/TrackOrderButton";

const FLOW: Status[] = ["pending", "in_progress", "ready", "picked_up"];

const STATUS_STYLE: Record<Status, string> = {
  pending: "bg-gray-100 text-gray-700",
  in_progress: "bg-amber-100 text-amber-800",
  ready: "bg-green-100 text-green-800",
  picked_up: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-700",
};

export function OrderStatus({ id }: { id: string }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const sb = createBrowserClient();
    const { data } = await sb.rpc("get_order", { p_id: id });
    if (!data) {
      setNotFound(true);
    } else {
      setOrder(data as OrderDetail);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    saveLastOrder(id);
    load();

    const sb = createBrowserClient();
    const channel = sb
      .channel(`order-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${id}`,
        },
        () => load()
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [id, load]);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center text-muted">
        กำลังโหลด...
      </main>
    );
  }

  if (notFound || !order) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-muted">ไม่พบออเดอร์นี้</p>
        <Link href="/" className="mt-4 text-primary underline">
          กลับหน้าแรก
        </Link>
      </main>
    );
  }

  const ready = order.status === "ready";
  const currentIdx = FLOW.indexOf(order.status);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
      {/* queue + status */}
      <div
        className={`rounded-2xl border p-6 text-center ${
          ready ? "border-green-300 bg-green-50" : "border-border bg-card"
        }`}
      >
        <div className="text-sm text-muted">หมายเลขคิวของคุณ</div>
        <div className="my-1 text-5xl font-extrabold tracking-tight">
          {order.queue_number}
        </div>
        <span
          className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
            STATUS_STYLE[order.status]
          }`}
        >
          {ORDER_STATUS_LABEL[order.status]}
        </span>

        {ready && (
          <p className="mt-3 font-medium text-green-800">
            🎉 สินค้าพร้อมแล้ว! มารับได้ที่ร้านเลย
          </p>
        )}
        {order.status === "picked_up" && (
          <p className="mt-3 text-blue-800">รับสินค้าเรียบร้อยแล้ว ขอบคุณค่ะ</p>
        )}
        {order.status === "cancelled" && (
          <p className="mt-3 text-red-700">ออเดอร์นี้ถูกยกเลิก</p>
        )}
      </div>

      {/* progress steps */}
      {order.status !== "cancelled" && (
        <div className="mt-6 flex items-center justify-between">
          {FLOW.map((s, i) => {
            const done = i <= currentIdx;
            return (
              <div key={s} className="flex flex-1 flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    done
                      ? "bg-primary text-primary-foreground"
                      : "bg-border text-muted"
                  }`}
                >
                  {i + 1}
                </div>
                <span className="mt-1 text-center text-[11px] text-muted">
                  {ORDER_STATUS_LABEL[s]}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* details */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 text-center">
          <div className="inline-flex flex-wrap justify-center gap-1">
            {order.letters.map((l) => (
              <span
                key={l.position}
                className="flex h-9 w-9 items-center justify-center rounded-md text-base font-bold text-white shadow"
                style={{ background: l.color?.swatch ?? "#888" }}
              >
                {l.char}
              </span>
            ))}
          </div>
        </div>
        <dl className="space-y-1 text-sm">
          <Row label="ข้อความ" value={order.text} />
          <Row label="ขนาดฐาน" value={order.base_size?.label ?? "-"} />
          <Row label="สีฐาน" value={order.base_color?.name ?? "-"} />
          <Row label="ตัวห้อย" value={order.pendant?.name ?? "ไม่มี"} />
          {order.note && <Row label="หมายเหตุ" value={order.note} />}
        </dl>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="font-semibold">ราคารวม</span>
          <span className="text-lg font-bold">
            {formatBaht(Number(order.total_price))}
          </span>
        </div>
        <p className="mt-1 text-right text-xs text-muted">
          ชำระเงินตอนมารับสินค้า
        </p>
      </div>

      <Link
        href="/order/new"
        className="mt-6 block text-center text-sm text-primary underline"
      >
        สั่งเพิ่มอีกชิ้น
      </Link>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
