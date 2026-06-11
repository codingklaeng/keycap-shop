"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUpload } from "@/components/ImageUpload";
import {
  saveBaseSize,
  saveBaseColor,
  saveKeycapColor,
  savePendant,
  deleteItem,
  setKeycapStock,
  addKeycapChars,
  removeKeycapChar,
} from "@/lib/items-actions";
import type {
  BaseColor,
  BaseSize,
  KeycapColor,
  KeycapStock,
  Pendant,
} from "@/lib/types";

type Tab = "sizes" | "baseColors" | "keycaps" | "pendants";
const TABS: { key: Tab; label: string }[] = [
  { key: "sizes", label: "ขนาดฐาน" },
  { key: "baseColors", label: "สีฐาน" },
  { key: "keycaps", label: "สีตัวอักษร + สต็อก" },
  { key: "pendants", label: "ตัวห้อย" },
];

export function ItemsManager(props: {
  baseSizes: BaseSize[];
  baseColors: BaseColor[];
  keycapColors: KeycapColor[];
  keycapStock: KeycapStock[];
  pendants: Pendant[];
}) {
  const [tab, setTab] = useState<Tab>("sizes");
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "sizes" && <SizesTab sizes={props.baseSizes} onDone={refresh} />}
      {tab === "baseColors" && (
        <BaseColorsTab colors={props.baseColors} onDone={refresh} />
      )}
      {tab === "keycaps" && (
        <KeycapsTab
          colors={props.keycapColors}
          stock={props.keycapStock}
          onDone={refresh}
        />
      )}
      {tab === "pendants" && (
        <PendantsTab pendants={props.pendants} onDone={refresh} />
      )}
    </div>
  );
}

/* ---------- shared bits ---------- */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">{children}</div>
  );
}

function num(fd: FormData, k: string) {
  return Number(fd.get(k) ?? 0);
}
function str(fd: FormData, k: string) {
  const v = fd.get(k);
  return v == null || v === "" ? null : String(v);
}

/* ---------- Base sizes ---------- */

function SizesTab({ sizes, onDone }: { sizes: BaseSize[]; onDone: () => void }) {
  async function save(fd: FormData, id?: string) {
    await saveBaseSize({
      id,
      label: String(fd.get("label")),
      max_chars: num(fd, "max_chars"),
      price: num(fd, "price"),
      sort_order: num(fd, "sort_order"),
      active: fd.get("active") === "on",
    });
    onDone();
  }
  return (
    <div className="space-y-3">
      <Card>
        <p className="mb-2 font-semibold">เพิ่มขนาดใหม่</p>
        <form
          action={(fd) => save(fd)}
          className="grid grid-cols-2 gap-2 sm:grid-cols-5"
        >
          <input name="label" placeholder="ชื่อขนาด" required className={inp} />
          <input name="max_chars" type="number" min={1} placeholder="สูงสุด" required className={inp} />
          <input name="price" type="number" min={0} placeholder="ราคา" required className={inp} />
          <input name="sort_order" type="number" placeholder="ลำดับ" defaultValue={sizes.length + 1} className={inp} />
          <input type="hidden" name="active" value="on" />
          <button className={btnAdd}>เพิ่ม</button>
        </form>
      </Card>
      {sizes.map((s) => (
        <Card key={s.id}>
          <form
            action={(fd) => save(fd, s.id)}
            className="grid grid-cols-2 items-center gap-2 sm:grid-cols-6"
          >
            <input name="label" defaultValue={s.label} className={inp} />
            <input name="max_chars" type="number" defaultValue={s.max_chars} className={inp} />
            <input name="price" type="number" defaultValue={s.price} className={inp} />
            <input name="sort_order" type="number" defaultValue={s.sort_order} className={inp} />
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" name="active" defaultChecked={s.active} /> เปิดขาย
            </label>
            <div className="flex gap-2">
              <button className={btnSave}>บันทึก</button>
              <DeleteBtn onClick={async () => { await deleteItem("base_sizes", s.id); onDone(); }} />
            </div>
          </form>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Base colors ---------- */

function BaseColorsTab({ colors, onDone }: { colors: BaseColor[]; onDone: () => void }) {
  async function save(fd: FormData, id?: string) {
    await saveBaseColor({
      id,
      name: String(fd.get("name")),
      swatch: str(fd, "swatch"),
      image_url: str(fd, "image_url"),
      price_modifier: num(fd, "price_modifier"),
      stock: num(fd, "stock"),
      sort_order: num(fd, "sort_order"),
      active: fd.get("active") === "on",
    });
    onDone();
  }
  return (
    <div className="space-y-3">
      <Card>
        <p className="mb-2 font-semibold">เพิ่มสีฐานใหม่</p>
        <form action={(fd) => save(fd)} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input name="name" placeholder="ชื่อสี" required className={inp} />
          <input name="swatch" type="color" defaultValue="#cccccc" className="h-10 w-full rounded-lg border border-border" />
          <input name="price_modifier" type="number" placeholder="บวกราคา" defaultValue={0} className={inp} />
          <input name="stock" type="number" placeholder="สต็อก" defaultValue={0} className={inp} />
          <ImageUpload folder="base" />
          <input type="hidden" name="sort_order" value={colors.length + 1} />
          <input type="hidden" name="active" value="on" />
          <button className={btnAdd}>เพิ่ม</button>
        </form>
      </Card>
      {colors.map((c) => (
        <Card key={c.id}>
          <form action={(fd) => save(fd, c.id)} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-4">
            <input name="name" defaultValue={c.name} className={inp} />
            <input name="swatch" type="color" defaultValue={c.swatch ?? "#cccccc"} className="h-10 w-full rounded-lg border border-border" />
            <input name="price_modifier" type="number" defaultValue={c.price_modifier} className={inp} />
            <input name="stock" type="number" defaultValue={c.stock} className={inp} />
            <ImageUpload folder="base" initialUrl={c.image_url} />
            <input type="hidden" name="sort_order" defaultValue={c.sort_order} />
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" name="active" defaultChecked={c.active} /> เปิดขาย
            </label>
            <div className="flex gap-2">
              <button className={btnSave}>บันทึก</button>
              <DeleteBtn onClick={async () => { await deleteItem("base_colors", c.id); onDone(); }} />
            </div>
          </form>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Pendants ---------- */

function PendantsTab({ pendants, onDone }: { pendants: Pendant[]; onDone: () => void }) {
  async function save(fd: FormData, id?: string) {
    await savePendant({
      id,
      name: String(fd.get("name")),
      image_url: str(fd, "image_url"),
      price: num(fd, "price"),
      stock: num(fd, "stock"),
      sort_order: num(fd, "sort_order"),
      active: fd.get("active") === "on",
    });
    onDone();
  }
  return (
    <div className="space-y-3">
      <Card>
        <p className="mb-2 font-semibold">เพิ่มตัวห้อยใหม่</p>
        <form action={(fd) => save(fd)} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input name="name" placeholder="ชื่อ" required className={inp} />
          <input name="price" type="number" placeholder="ราคา" defaultValue={0} className={inp} />
          <input name="stock" type="number" placeholder="สต็อก" defaultValue={0} className={inp} />
          <ImageUpload folder="pendant" />
          <input type="hidden" name="sort_order" value={pendants.length + 1} />
          <input type="hidden" name="active" value="on" />
          <button className={btnAdd}>เพิ่ม</button>
        </form>
      </Card>
      {pendants.map((p) => (
        <Card key={p.id}>
          <form action={(fd) => save(fd, p.id)} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-4">
            <input name="name" defaultValue={p.name} className={inp} />
            <input name="price" type="number" defaultValue={p.price} className={inp} />
            <input name="stock" type="number" defaultValue={p.stock} className={inp} />
            <ImageUpload folder="pendant" initialUrl={p.image_url} />
            <input type="hidden" name="sort_order" defaultValue={p.sort_order} />
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" name="active" defaultChecked={p.active} /> เปิดขาย
            </label>
            <div className="flex gap-2">
              <button className={btnSave}>บันทึก</button>
              <DeleteBtn onClick={async () => { await deleteItem("pendants", p.id); onDone(); }} />
            </div>
          </form>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Keycap colors + stock matrix ---------- */

function KeycapsTab({
  colors,
  stock,
  onDone,
}: {
  colors: KeycapColor[];
  stock: KeycapStock[];
  onDone: () => void;
}) {
  const chars = Array.from(new Set(stock.map((s) => s.char))).sort();
  const stockMap = new Map(stock.map((s) => [`${s.char}|${s.color_id}`, s.stock]));
  const [newChars, setNewChars] = useState("");

  async function saveColor(fd: FormData, id?: string) {
    await saveKeycapColor({
      id,
      name: String(fd.get("name")),
      swatch: str(fd, "swatch"),
      price: num(fd, "price"),
      sort_order: num(fd, "sort_order"),
      active: fd.get("active") === "on",
    });
    onDone();
  }

  async function addChars() {
    const list = Array.from(
      new Set(
        newChars
          .toUpperCase()
          .split("")
          .map((c) => c.trim())
          .filter(Boolean)
      )
    );
    if (list.length === 0) return;
    await addKeycapChars(list);
    setNewChars("");
    onDone();
  }

  return (
    <div className="space-y-6">
      {/* colors */}
      <div className="space-y-3">
        <h2 className="font-semibold">สีของตัวอักษร</h2>
        <Card>
          <form action={(fd) => saveColor(fd)} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input name="name" placeholder="ชื่อสี" required className={inp} />
            <input name="swatch" type="color" defaultValue="#ef4444" className="h-10 w-full rounded-lg border border-border" />
            <input name="price" type="number" placeholder="บวกราคา/ตัว" defaultValue={0} className={inp} />
            <input type="hidden" name="sort_order" value={colors.length + 1} />
            <input type="hidden" name="active" value="on" />
            <button className={btnAdd}>เพิ่มสี</button>
          </form>
        </Card>
        {colors.map((c) => (
          <Card key={c.id}>
            <form action={(fd) => saveColor(fd, c.id)} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-5">
              <input name="name" defaultValue={c.name} className={inp} />
              <input name="swatch" type="color" defaultValue={c.swatch ?? "#ef4444"} className="h-10 w-full rounded-lg border border-border" />
              <input name="price" type="number" defaultValue={c.price} className={inp} />
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="active" defaultChecked={c.active} /> เปิด
              </label>
              <input type="hidden" name="sort_order" defaultValue={c.sort_order} />
              <div className="flex gap-2">
                <button className={btnSave}>บันทึก</button>
                <DeleteBtn onClick={async () => { await deleteItem("keycap_colors", c.id); onDone(); }} />
              </div>
            </form>
          </Card>
        ))}
      </div>

      {/* stock matrix */}
      <div className="space-y-3">
        <h2 className="font-semibold">สต็อกแยกตัวอักษร × สี</h2>
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={newChars}
              onChange={(e) => setNewChars(e.target.value)}
              placeholder="พิมพ์ตัวอักษรที่จะเพิ่ม เช่น ABC123"
              className={inp}
            />
            <button onClick={addChars} className={btnAdd}>
              เพิ่มตัวอักษร
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">
            เพิ่มแล้วช่องสต็อกจะเริ่มที่ 0 — แก้ตัวเลขในตารางแล้วระบบบันทึกอัตโนมัติเมื่อออกจากช่อง
          </p>
        </Card>

        {chars.length === 0 ? (
          <p className="text-sm text-muted">ยังไม่มีตัวอักษร เพิ่มด้านบนก่อน</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-background p-2 text-left">ตัว</th>
                  {colors.map((c) => (
                    <th key={c.id} className="p-2">
                      <span
                        className="inline-block h-4 w-4 rounded-full align-middle"
                        style={{ background: c.swatch ?? "#ccc" }}
                      />
                      <div className="text-[10px] text-muted">{c.name}</div>
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {chars.map((ch) => (
                  <tr key={ch} className="border-t border-border">
                    <td className="sticky left-0 bg-card p-2 font-bold">{ch}</td>
                    {colors.map((c) => (
                      <td key={c.id} className="p-1">
                        <StockCell
                          char={ch}
                          colorId={c.id}
                          initial={stockMap.get(`${ch}|${c.id}`) ?? 0}
                        />
                      </td>
                    ))}
                    <td className="p-1">
                      <button
                        onClick={async () => {
                          if (confirm(`ลบตัวอักษร "${ch}" ทุกสี?`)) {
                            await removeKeycapChar(ch);
                            onDone();
                          }
                        }}
                        className="text-xs text-red-500"
                      >
                        ลบแถว
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StockCell({
  char,
  colorId,
  initial,
}: {
  char: string;
  colorId: string;
  initial: number;
}) {
  const [val, setVal] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function persist(v: number) {
    if (timer.current) clearTimeout(timer.current);
    setState("saving");
    timer.current = setTimeout(async () => {
      try {
        await setKeycapStock(char, colorId, v);
        setState("saved");
      } catch {
        setState("idle");
        alert("บันทึกสต็อกไม่สำเร็จ");
      }
    }, 500);
  }

  return (
    <input
      type="number"
      min={0}
      value={val}
      onChange={(e) => {
        const v = Math.max(0, Math.floor(Number(e.target.value) || 0));
        setVal(v);
        if (v !== initial) persist(v);
      }}
      className={`w-16 rounded-md border px-2 py-1 text-center bg-background ${
        state === "saving"
          ? "border-primary"
          : state === "saved"
            ? "border-green-400"
            : "border-border"
      }`}
    />
  );
}

/* ---------- tiny ui ---------- */

const inp =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
const btnAdd =
  "rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground";
const btnSave =
  "rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary";

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm("ลบรายการนี้?")) onClick();
      }}
      className="rounded-lg border border-border px-3 py-2 text-sm text-red-500"
    >
      ลบ
    </button>
  );
}
