"use client";

import { useMemo, useState } from "react";

export type CharRow = {
  ch: string;
  d: number;
  w: number;
  m: number;
  total: number;
};

type Period = "d" | "w" | "m" | "total";
const PERIODS: { key: Period; label: string }[] = [
  { key: "d", label: "วันนี้" },
  { key: "w", label: "7 วัน" },
  { key: "m", label: "30 วัน" },
  { key: "total", label: "ทั้งหมด" },
];

export function LetterRankings({ rows }: { rows: CharRow[] }) {
  const [period, setPeriod] = useState<Period>("d");

  const ranked = useMemo(() => {
    return rows
      .map((r) => ({ ch: r.ch, count: Number(r[period]) }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [rows, period]);

  const max = ranked[0]?.count ?? 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-lg font-bold">อันดับตัวอักษรที่ใช้</h1>
      <p className="mb-4 text-sm text-muted">
        นับจากตัวอักษรในออเดอร์คีย์แคป (ไม่รวมที่ยกเลิก)
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              period === p.key
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {ranked.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-muted">
          ยังไม่มีข้อมูลในช่วงนี้
        </p>
      ) : (
        <ol className="space-y-2">
          {ranked.map((r, i) => (
            <li
              key={r.ch}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <span className="w-6 text-center text-sm font-bold text-muted">
                {i + 1}
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-foreground text-lg font-bold text-background">
                {r.ch === " " ? "␣" : r.ch}
              </span>
              <div className="flex-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-background">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${max ? (r.count / max) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <span className="w-12 text-right font-semibold">{r.count}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
