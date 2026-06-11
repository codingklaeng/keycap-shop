"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LAST_ORDER_KEY = "keycap_last_order";

export function saveLastOrder(id: string) {
  try {
    localStorage.setItem(LAST_ORDER_KEY, id);
  } catch {}
}

export function TrackOrderButton() {
  const [lastOrder, setLastOrder] = useState<string | null>(null);

  useEffect(() => {
    try {
      setLastOrder(localStorage.getItem(LAST_ORDER_KEY));
    } catch {}
  }, []);

  if (!lastOrder) return null;

  return (
    <Link
      href={`/order/${lastOrder}`}
      className="mt-3 block w-full rounded-xl border border-border bg-card px-6 py-3 font-medium text-foreground transition hover:bg-background"
    >
      ดูสถานะออเดอร์ล่าสุด
    </Link>
  );
}
