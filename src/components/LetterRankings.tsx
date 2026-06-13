"use client";

import { useState } from "react";

type ColorStat = { name: string; key: string; text: string; count: number };
export type CharStat = { ch: string; total: number; colors: ColorStat[] };
export type LenStat = { len: number; orders: number; colors: ColorStat[] };
export type Stats = { chars: CharStat[]; lengths: LenStat[] };

type Period = "d" | "w" | "m" | "all";
const PERIODS: { key: Period; label: string }[] = [
  { key: "d", label: "วันนี้" },
  { key: "w", label: "7 วัน" },
  { key: "m", label: "30 วัน" },
  { key: "all", label: "ทั้งหมด" },
];

export function LetterRankings({
  data,
}: {
  data: Record<Period, Stats>;
}) {
  const [period, setPeriod] = useState<Period>("d");
  const stats = data[period];
  const chars = stats.chars ?? [];
  const lengths = stats.lengths ?? [];
  const maxChar = chars[0]?.total ?? 0;
  const maxLen = lengths[0]?.orders ?? 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-lg font-bold">อันดับการใช้งาน</h1>
      <p className="mb-4 text-sm text-muted">
        นับจากออเดอร์คีย์แคป (ไม่รวมที่ยกเลิก)
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
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

      {/* characters */}
      <h2 className="mb-2 font-semibold">ตัวอักษรยอดนิยม</h2>
      {chars.length === 0 ? (
        <Empty />
      ) : (
        <ol className="space-y-2">
          {chars.map((c, i) => (
            <li
              key={c.ch}
              className="rounded-xl border border-border bg-card p-3"
            >
              <div className="flex items-center gap-3">
                <span className="w-5 text-center text-sm font-bold text-muted">
                  {i + 1}
                </span>
                <Cap ch={c.ch} color={c.colors[0]} />
                <div className="flex-1">
                  <Bar value={c.total} max={maxChar} />
                </div>
                <span className="w-10 text-right font-semibold">{c.total}</span>
              </div>
              {/* color breakdown */}
              <div className="mt-2 flex flex-wrap gap-2 pl-8">
                {c.colors.map((col, j) => (
                  <span key={j} className="flex items-center gap-1">
                    <Cap ch={c.ch} color={col} small />
                    <span className="text-xs text-muted">×{col.count}</span>
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* lengths */}
      <h2 className="mb-2 mt-7 font-semibold">ความยาวยอดนิยม</h2>
      {lengths.length === 0 ? (
        <Empty />
      ) : (
        <ol className="space-y-2">
          {lengths.map((l, i) => (
            <li
              key={l.len}
              className="rounded-xl border border-border bg-card p-3"
            >
              <div className="flex items-center gap-3">
                <span className="w-5 text-center text-sm font-bold text-muted">
                  {i + 1}
                </span>
                <span className="flex h-9 min-w-9 items-center justify-center rounded-md bg-foreground px-2 text-sm font-bold text-background">
                  {l.len} ตัว
                </span>
                <div className="flex-1">
                  <Bar value={l.orders} max={maxLen} />
                </div>
                <span className="w-16 text-right font-semibold">
                  {l.orders} ออเดอร์
                </span>
              </div>
              {/* color breakdown for this length */}
              <div className="mt-2 flex flex-wrap gap-2 pl-8">
                {l.colors.map((col, j) => (
                  <span
                    key={j}
                    className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5"
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: col.key }}
                    />
                    <span className="text-xs text-muted">
                      {col.name} ×{col.count}
                    </span>
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Cap({
  ch,
  color,
  small,
}: {
  ch: string;
  color?: ColorStat;
  small?: boolean;
}) {
  const size = small ? "h-6 w-6 text-xs" : "h-9 w-9 text-base";
  return (
    <span
      className={`flex items-center justify-center rounded-md font-bold ${size}`}
      style={{
        background: color?.key ?? "#374151",
        color: color?.text ?? "#fff",
      }}
    >
      {ch === " " ? "␣" : ch}
    </span>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-background">
      <div
        className="h-2 rounded-full bg-primary"
        style={{ width: `${max ? (value / max) * 100 : 0}%` }}
      />
    </div>
  );
}

function Empty() {
  return (
    <p className="rounded-xl border border-border bg-card p-6 text-center text-muted">
      ยังไม่มีข้อมูลในช่วงนี้
    </p>
  );
}
