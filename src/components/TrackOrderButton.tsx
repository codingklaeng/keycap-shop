"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LAST_ORDER_KEY = "keycap_last_order";
const HISTORY_KEY = "keycap_orders";
const MAX_HISTORY = 40;

// Save an order id locally so the customer can find it again later — keeps a
// full history (most-recent first), not just the latest one.
export function saveLastOrder(id: string) {
  try {
    localStorage.setItem(LAST_ORDER_KEY, id);
    const list = readHistory();
    const next = [id, ...list.filter((x) => x !== id)].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {}
}

// All saved order ids for this device (newest first), merging the legacy
// single-last-order key for users who ordered before history existed.
export function readHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const last = localStorage.getItem(LAST_ORDER_KEY);
    if (last && !list.includes(last)) return [last, ...list];
    return list;
  } catch {
    return [];
  }
}

export function TrackOrderButton() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(readHistory().length);
  }, []);

  if (count === 0) return null;

  return (
    <Link
      href="/my-orders"
      className="mt-3 block w-full rounded-xl border border-border bg-card px-6 py-3 font-medium text-foreground transition hover:bg-background"
    >
      ดูออเดอร์ของฉัน{count > 1 ? ` (${count})` : ""}
    </Link>
  );
}
