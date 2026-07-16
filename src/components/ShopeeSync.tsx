"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { forceResync, markAllDone, markItemDone, saveShopeeMap } from "@/lib/shopee-actions";
import type { ShopeeItemMap, ShopeeSource, ShopeeStockQueue } from "@/lib/types";

export type SyncItem = {
  source_table: ShopeeSource;
  source_id: string;
  label: string;
  stock: number;
  active: boolean;
};

const keyOf = (t: string, id: string) => `${t}:${id}`;

export function ShopeeSync({
  pending,
  history,
  maps,
  items,
}: {
  pending: ShopeeStockQueue[];
  history: ShopeeStockQueue[];
  maps: ShopeeItemMap[];
  items: SyncItem[];
}) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const [tab, setTab] = useState<"pending" | "mapping" | "history">("pending");

  const itemBy = useMemo(
    () => new Map(items.map((i) => [keyOf(i.source_table, i.source_id), i])),
    [items],
  );
  const mapBy = useMemo(
    () => new Map(maps.map((m) => [keyOf(m.source_table, m.source_id), m])),
    [maps],
  );

  // Collapse repeated pending changes to one card per item (newest wins), so the
  // admin sets each Shopee listing once, to its current value.
  const groups = useMemo(() => {
    const seen = new Map<string, { row: ShopeeStockQueue }>();
    for (const row of pending) {
      const k = keyOf(row.source_table, row.source_id);
      if (!seen.has(k)) seen.set(k, { row }); // pending is ordered newest-first
    }
    return [...seen.values()].map((g) => g.row);
  }, [pending]);

  // At-a-glance counts.
  const syncingCount = useMemo(() => maps.filter((m) => m.active).length, [maps]);
  const unmappedCount = useMemo(
    () =>
      items.filter((it) => {
        const m = mapBy.get(keyOf(it.source_table, it.source_id));
        return !m || !m.active;
      }).length,
    [items, mapBy],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <p className="mb-4 text-sm text-muted">
        เมื่อสต็อกใน keycap-shop เปลี่ยน ระบบจะสร้าง “งานค้าง” ให้ไปตั้งเลขเดียวกันบน
        Shopee ด้วยมือ แล้วกดว่าเสร็จ — keycap-shop คือแหล่งสต็อกจริงเสมอ
      </p>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="งานค้าง" value={groups.length} tone={groups.length > 0 ? "warn" : "muted"} />
        <Stat label="ซิงก์อยู่" value={syncingCount} tone="muted" />
        <Stat
          label="ยังไม่ผูก"
          value={unmappedCount}
          tone={unmappedCount > 0 ? "warn" : "muted"}
          onClick={() => setTab("mapping")}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <TabBtn active={tab === "pending"} onClick={() => setTab("pending")}>
          งานค้าง {groups.length > 0 ? `(${groups.length})` : ""}
        </TabBtn>
        <TabBtn active={tab === "mapping"} onClick={() => setTab("mapping")}>
          ผูก listing
        </TabBtn>
        <TabBtn active={tab === "history"} onClick={() => setTab("history")}>
          ประวัติ
        </TabBtn>
      </div>

      {tab === "pending" && (
        <PendingTab groups={groups} itemBy={itemBy} mapBy={mapBy} onDone={refresh} />
      )}
      {tab === "mapping" && <MappingTab items={items} mapBy={mapBy} onDone={refresh} />}
      {tab === "history" && <HistoryTab rows={history} itemBy={itemBy} />}
    </div>
  );
}

/* ---------------- Pending queue ---------------- */

function PendingTab({
  groups,
  itemBy,
  mapBy,
  onDone,
}: {
  groups: ShopeeStockQueue[];
  itemBy: Map<string, SyncItem>;
  mapBy: Map<string, ShopeeItemMap>;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();

  if (groups.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">ไม่มีงานค้าง — สต็อกตรงกับ Shopee แล้ว 🎉</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => {
            await markAllDone();
            onDone();
          })}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted disabled:opacity-50"
        >
          ทำเสร็จทั้งหมด
        </button>
      </div>

      {groups.map((row) => {
        const k = keyOf(row.source_table, row.source_id);
        const item = itemBy.get(k);
        const map = mapBy.get(k);
        const unmapped = !map || !map.active || !map.shopee_label;
        return (
          <Card key={k}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{item?.label ?? k}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span>
                    ตั้งสต็อกบน Shopee ={" "}
                    <span className="font-semibold text-foreground">
                      {row.old_stock != null ? `${row.old_stock} → ${row.new_stock}` : row.new_stock}
                    </span>
                    {row.new_stock === 0 && " (สินค้าหมด)"}
                  </span>
                  <CopyBtn value={row.new_stock} />
                </p>
                {unmapped ? (
                  <p className="mt-1 text-xs text-red-500">
                    ยังไม่ได้ผูก listing — ไปแท็บ “ผูก listing” ก่อน
                  </p>
                ) : (
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="truncate">listing: {map!.shopee_label}</span>
                    {map!.shopee_url && (
                      <a
                        href={map!.shopee_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 font-medium text-primary underline"
                      >
                        เปิด Shopee ↗
                      </a>
                    )}
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => {
                  await markItemDone(row.source_table, row.source_id);
                  onDone();
                })}
                className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                ทำแล้ว
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ---------------- Mapping ---------------- */

function MappingTab({
  items,
  mapBy,
  onDone,
}: {
  items: SyncItem[];
  mapBy: Map<string, ShopeeItemMap>;
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [unmappedOnly, setUnmappedOnly] = useState(false);

  const q = query.trim().toLowerCase();
  const isUnsynced = (it: SyncItem) => {
    const m = mapBy.get(keyOf(it.source_table, it.source_id));
    return !m || !m.active || !m.shopee_label;
  };
  const match = (it: SyncItem) =>
    (!q || it.label.toLowerCase().includes(q)) && (!unmappedOnly || isUnsynced(it));

  const bases = items.filter((i) => i.source_table === "base_variants" && match(i));
  const nfc = items.filter((i) => i.source_table === "social_platforms" && match(i));
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        ใส่ชื่อ listing + ตัวเลือก (variation) บน Shopee ให้ตรงกับสินค้าแต่ละชิ้น ปิด “ซิงก์”
        ถ้าไม่ต้องการให้ชิ้นนั้นขึ้นงานค้าง
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาสินค้า…"
          className={`${inp} min-w-[180px] flex-1`}
        />
        <label className="flex items-center gap-1 text-sm text-muted">
          <input
            type="checkbox"
            checked={unmappedOnly}
            onChange={(e) => setUnmappedOnly(e.target.checked)}
          />{" "}
          เฉพาะที่ยังไม่ผูก
        </label>
      </div>
      <Section title="พวงกุญแจคีย์แคป (ฐาน)">
        {bases.map((it) => (
          <MapRow key={keyOf(it.source_table, it.source_id)} item={it} map={mapBy.get(keyOf(it.source_table, it.source_id))} onDone={onDone} />
        ))}
        {bases.length === 0 && <p className="text-sm text-muted">ไม่พบรายการ</p>}
      </Section>
      <Section title="NFC keychain">
        {nfc.map((it) => (
          <MapRow key={keyOf(it.source_table, it.source_id)} item={it} map={mapBy.get(keyOf(it.source_table, it.source_id))} onDone={onDone} />
        ))}
        {nfc.length === 0 && <p className="text-sm text-muted">ไม่พบรายการ</p>}
      </Section>
    </div>
  );
}

function MapRow({
  item,
  map,
  onDone,
}: {
  item: SyncItem;
  map: ShopeeItemMap | undefined;
  onDone: () => void;
}) {
  const [saving, start] = useTransition();
  return (
    <Card>
      <form
        action={(fd) =>
          start(async () => {
            await saveShopeeMap({
              source_table: item.source_table,
              source_id: item.source_id,
              shopee_label: String(fd.get("shopee_label") ?? "").trim() || null,
              shopee_url: String(fd.get("shopee_url") ?? "").trim() || null,
              active: fd.get("active") === "on",
            });
            onDone();
          })
        }
        className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1.2fr_1.3fr_1.3fr_auto_auto]"
      >
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{item.label}</span>
            {!map || !map.shopee_label ? (
              <span className="shrink-0 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                ยังไม่ผูก
              </span>
            ) : !map.active ? (
              <span className="shrink-0 rounded border border-border px-1 text-[10px] font-medium text-muted">
                ปิดซิงก์
              </span>
            ) : null}
          </p>
          <p className="text-xs text-muted">สต็อกตอนนี้: {item.stock}</p>
          {map && map.active && map.shopee_label && (
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                start(async () => {
                  await forceResync(item.source_table, item.source_id);
                  onDone();
                })
              }
              className="mt-1 text-xs text-primary underline disabled:opacity-50"
            >
              ↻ ตั้ง Shopee ใหม่ให้ตรงตอนนี้
            </button>
          )}
        </div>
        <input
          name="shopee_label"
          defaultValue={map?.shopee_label ?? ""}
          placeholder="ชื่อ listing / variation"
          className={inp}
        />
        <input
          name="shopee_url"
          type="url"
          defaultValue={map?.shopee_url ?? ""}
          placeholder="ลิงก์ Shopee (https://…)"
          className={inp}
        />
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" name="active" defaultChecked={map?.active ?? true} /> ซิงก์
        </label>
        <button disabled={saving} className={btnSave}>
          บันทึก
        </button>
      </form>
    </Card>
  );
}

/* ---------------- history ---------------- */

function HistoryTab({
  rows,
  itemBy,
}: {
  rows: ShopeeStockQueue[];
  itemBy: Map<string, SyncItem>;
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">ยังไม่มีประวัติการซิงก์</p>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">รายการที่ทำเสร็จล่าสุด (สูงสุด 50)</p>
      {rows.map((row) => {
        const item = itemBy.get(keyOf(row.source_table, row.source_id));
        return (
          <Card key={row.id}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{item?.label ?? row.source_table}</span>
              <span className="shrink-0 text-muted">
                ตั้งเป็น{" "}
                <span className="font-semibold text-foreground">
                  {row.old_stock != null ? `${row.old_stock} → ${row.new_stock}` : row.new_stock}
                </span>
                {row.done_at && <span className="ml-2 text-xs">{formatWhen(row.done_at)}</span>}
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/* ---------------- shared ---------------- */

function Stat({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone: "warn" | "muted";
  onClick?: () => void;
}) {
  const valueCls =
    tone === "warn" && value > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground";
  const base = "rounded-xl border border-border bg-card p-3 text-center";
  const inner = (
    <>
      <div className={`text-xl font-semibold ${valueCls}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={`${base} hover:border-primary`}>
      {inner}
    </button>
  ) : (
    <div className={base}>{inner}</div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
        active ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted">{title}</h2>
      {children}
    </div>
  );
}

function CopyBtn({ value }: { value: number }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(String(value));
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          // clipboard unavailable (e.g. non-secure context) — ignore
        }
      }}
      className="shrink-0 rounded border border-border px-1.5 py-0.5 text-xs text-muted hover:text-foreground"
    >
      {done ? "คัดลอกแล้ว ✓" : "คัดลอกเลข"}
    </button>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card p-4">{children}</div>;
}

const inp =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
const btnSave =
  "rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary disabled:opacity-50";
