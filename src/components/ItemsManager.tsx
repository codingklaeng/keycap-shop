"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUpload } from "@/components/ImageUpload";
import {
  saveBaseType,
  saveBaseSize,
  saveBaseColor,
  saveBaseVariant,
  saveKeycapColor,
  savePendant,
  saveSocialPlatform,
  deleteItem,
  setKeycapStock,
  addKeycapChars,
  removeKeycapChar,
} from "@/lib/items-actions";
import type {
  BaseColor,
  BaseSize,
  BaseType,
  BaseVariant,
  KeycapColor,
  KeycapStock,
  Pendant,
  SocialPlatform,
} from "@/lib/types";

type Tab =
  | "types"
  | "sizes"
  | "baseColors"
  | "variants"
  | "keycaps"
  | "pendants"
  | "nfc";
const TABS: { key: Tab; label: string }[] = [
  { key: "types", label: "แบบฐาน" },
  { key: "sizes", label: "ขนาดฐาน" },
  { key: "baseColors", label: "สีฐาน" },
  { key: "variants", label: "จับคู่ฐาน+สี (ราคา/สต็อก)" },
  { key: "keycaps", label: "สีตัวอักษร + สต็อก" },
  { key: "pendants", label: "ตัวห้อย" },
  { key: "nfc", label: "NFC (social)" },
];

export function ItemsManager(props: {
  baseTypes: BaseType[];
  baseSizes: BaseSize[];
  baseColors: BaseColor[];
  baseVariants: BaseVariant[];
  keycapColors: KeycapColor[];
  keycapStock: KeycapStock[];
  pendants: Pendant[];
  platforms: SocialPlatform[];
}) {
  const [tab, setTab] = useState<Tab>("types");
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

      {tab === "types" && <TypesTab types={props.baseTypes} onDone={refresh} />}
      {tab === "sizes" && (
        <SizesTab sizes={props.baseSizes} types={props.baseTypes} onDone={refresh} />
      )}
      {tab === "baseColors" && (
        <BaseColorsTab colors={props.baseColors} onDone={refresh} />
      )}
      {tab === "variants" && (
        <VariantsTab
          variants={props.baseVariants}
          sizes={props.baseSizes}
          colors={props.baseColors}
          types={props.baseTypes}
          onDone={refresh}
        />
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
      {tab === "nfc" && (
        <PlatformsTab platforms={props.platforms} onDone={refresh} />
      )}
    </div>
  );
}

/* ---------- NFC social platforms ---------- */

function PlatformsTab({
  platforms,
  onDone,
}: {
  platforms: SocialPlatform[];
  onDone: () => void;
}) {
  async function save(fd: FormData, id?: string) {
    await saveSocialPlatform({
      id,
      name: String(fd.get("name")),
      url_template: String(fd.get("url_template")),
      hint: str(fd, "hint"),
      icon: str(fd, "icon"),
      price: num(fd, "price"),
      stock: num(fd, "stock"),
      sort_order: num(fd, "sort_order"),
      active: fd.get("active") === "on",
    });
    onDone();
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        ใช้ <code>{"{id}"}</code> ใน URL template แทนชื่อช่อง เช่น{" "}
        <code>https://facebook.com/{"{id}"}</code> — ลูกค้ากรอกชื่อช่อง ระบบจะแทนให้
      </p>
      <Card>
        <p className="mb-2 font-semibold">เพิ่มแพลตฟอร์มใหม่</p>
        <form action={(fd) => save(fd)} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <input name="icon" placeholder="ไอคอน (อิโมจิ)" className={inp} />
          <input name="name" placeholder="ชื่อ เช่น Facebook" required className={inp} />
          <input name="url_template" placeholder="https://facebook.com/{id}" required className={`${inp} sm:col-span-2`} />
          <input name="hint" placeholder="คำใบ้ช่องกรอก" className={inp} />
          <input name="price" type="number" placeholder="ราคา" defaultValue={0} className={inp} />
          <input name="stock" type="number" placeholder="สต็อก" defaultValue={0} className={inp} />
          <input type="hidden" name="sort_order" value={platforms.length + 1} />
          <input type="hidden" name="active" value="on" />
          <button className={btnAdd}>เพิ่ม</button>
        </form>
      </Card>
      {platforms.map((p) => (
        <Card key={p.id}>
          <form action={(fd) => save(fd, p.id)} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <input name="icon" defaultValue={p.icon ?? ""} placeholder="ไอคอน" className={inp} />
            <input name="name" defaultValue={p.name} className={inp} />
            <input name="url_template" defaultValue={p.url_template} className={`${inp} sm:col-span-2`} />
            <input name="hint" defaultValue={p.hint ?? ""} placeholder="คำใบ้" className={inp} />
            <input name="price" type="number" defaultValue={p.price} className={inp} />
            <input name="stock" type="number" defaultValue={p.stock} className={inp} />
            <input type="hidden" name="sort_order" defaultValue={p.sort_order} />
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" name="active" defaultChecked={p.active} /> เปิดขาย
            </label>
            <div className="flex gap-2">
              <button className={btnSave}>บันทึก</button>
              <DeleteBtn onClick={async () => { await deleteItem("social_platforms", p.id); onDone(); }} />
            </div>
          </form>
        </Card>
      ))}
    </div>
  );
}

/* ---------- shared ---------- */

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card p-4">{children}</div>;
}
function num(fd: FormData, k: string) {
  return Number(fd.get(k) ?? 0);
}
function str(fd: FormData, k: string) {
  const v = fd.get(k);
  return v == null || v === "" ? null : String(v);
}
function sizeName(s: BaseSize, types: BaseType[]) {
  const t = types.find((x) => x.id === s.base_type_id);
  return `${t ? t.name + " · " : ""}${s.max_chars} ช่อง`;
}

/* ---------- Base types ---------- */

function TypesTab({ types, onDone }: { types: BaseType[]; onDone: () => void }) {
  async function save(fd: FormData, id?: string) {
    await saveBaseType({
      id,
      name: String(fd.get("name")),
      sort_order: num(fd, "sort_order"),
      active: fd.get("active") === "on",
    });
    onDone();
  }
  return (
    <div className="space-y-3">
      <Card>
        <p className="mb-2 font-semibold">เพิ่มแบบใหม่</p>
        <form action={(fd) => save(fd)} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <input name="name" placeholder="เช่น หัวแมว" required className={inp} />
          <input name="sort_order" type="number" placeholder="ลำดับ" defaultValue={types.length + 1} className={inp} />
          <input type="hidden" name="active" value="on" />
          <button className={btnAdd}>เพิ่ม</button>
        </form>
      </Card>
      {types.map((t) => (
        <Card key={t.id}>
          <form action={(fd) => save(fd, t.id)} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-4">
            <input name="name" defaultValue={t.name} className={inp} />
            <input name="sort_order" type="number" defaultValue={t.sort_order} className={inp} />
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" name="active" defaultChecked={t.active} /> เปิดใช้
            </label>
            <div className="flex gap-2">
              <button className={btnSave}>บันทึก</button>
              <DeleteBtn onClick={async () => { await deleteItem("base_types", t.id); onDone(); }} />
            </div>
          </form>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Base sizes (type + slots) ---------- */

function SizesTab({
  sizes,
  types,
  onDone,
}: {
  sizes: BaseSize[];
  types: BaseType[];
  onDone: () => void;
}) {
  async function save(fd: FormData, id?: string) {
    await saveBaseSize({
      id,
      base_type_id: String(fd.get("base_type_id")),
      max_chars: num(fd, "max_chars"),
      sort_order: num(fd, "sort_order"),
      active: fd.get("active") === "on",
    });
    onDone();
  }
  return (
    <div className="space-y-3">
      {types.length === 0 ? (
        <p className="text-sm text-muted">เพิ่ม &quot;แบบฐาน&quot; ก่อนในแท็บแรก</p>
      ) : (
        <Card>
          <p className="mb-2 font-semibold">เพิ่มขนาดใหม่</p>
          <form action={(fd) => save(fd)} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <select name="base_type_id" required className={inp}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <input name="max_chars" type="number" min={1} max={20} placeholder="จำนวนช่อง" required className={inp} />
            <input name="sort_order" type="number" placeholder="ลำดับ" defaultValue={sizes.length + 1} className={inp} />
            <input type="hidden" name="active" value="on" />
            <button className={btnAdd}>เพิ่ม</button>
          </form>
        </Card>
      )}
      {sizes.map((s) => (
        <Card key={s.id}>
          <form action={(fd) => save(fd, s.id)} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-5">
            <select name="base_type_id" defaultValue={s.base_type_id ?? ""} className={inp}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <input name="max_chars" type="number" min={1} max={20} defaultValue={s.max_chars} className={inp} />
            <input name="sort_order" type="number" defaultValue={s.sort_order} className={inp} />
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" name="active" defaultChecked={s.active} /> เปิด
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

/* ---------- Base colors (name/swatch/image only) ---------- */

function BaseColorsTab({ colors, onDone }: { colors: BaseColor[]; onDone: () => void }) {
  async function save(fd: FormData, id?: string) {
    await saveBaseColor({
      id,
      name: String(fd.get("name")),
      swatch: str(fd, "swatch"),
      image_url: str(fd, "image_url"),
      sort_order: num(fd, "sort_order"),
      active: fd.get("active") === "on",
    });
    onDone();
  }
  return (
    <div className="space-y-3">
      <Card>
        <p className="mb-2 font-semibold">เพิ่มสีฐานใหม่</p>
        <form action={(fd) => save(fd)} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <input name="name" placeholder="ชื่อสี" required className={inp} />
          <input name="swatch" type="color" defaultValue="#cccccc" className="h-10 w-full rounded-lg border border-border" />
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
            <ImageUpload folder="base" initialUrl={c.image_url} />
            <input type="hidden" name="sort_order" defaultValue={c.sort_order} />
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" name="active" defaultChecked={c.active} /> เปิด
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

/* ---------- Variants: pair size × color, set price/stock/image ---------- */

function VariantsTab({
  variants,
  sizes,
  colors,
  types,
  onDone,
}: {
  variants: BaseVariant[];
  sizes: BaseSize[];
  colors: BaseColor[];
  types: BaseType[];
  onDone: () => void;
}) {
  async function save(fd: FormData, id?: string) {
    await saveBaseVariant({
      id,
      base_size_id: String(fd.get("base_size_id")),
      base_color_id: String(fd.get("base_color_id")),
      price: num(fd, "price"),
      stock: num(fd, "stock"),
      image_url: str(fd, "image_url"),
      sort_order: num(fd, "sort_order"),
      active: fd.get("active") === "on",
    });
    onDone();
  }
  const colorName = (id: string) => colors.find((c) => c.id === id)?.name ?? "-";
  const sizeText = (id: string) => {
    const s = sizes.find((x) => x.id === id);
    return s ? sizeName(s, types) : "-";
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        จับคู่ขนาดฐานกับสี แล้วกำหนดราคา + จำนวน + รูป — นี่คือสินค้าที่ลูกค้าเลือกได้จริง
      </p>
      {sizes.length === 0 || colors.length === 0 ? (
        <p className="text-sm text-muted">ต้องมีขนาดฐานและสีฐานอย่างน้อยอย่างละ 1 ก่อน</p>
      ) : (
        <Card>
          <p className="mb-2 font-semibold">เพิ่มการจับคู่ใหม่</p>
          <form action={(fd) => save(fd)} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <select name="base_size_id" required className={inp}>
              {sizes.map((s) => (
                <option key={s.id} value={s.id}>{sizeName(s, types)}</option>
              ))}
            </select>
            <select name="base_color_id" required className={inp}>
              {colors.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input name="price" type="number" min={0} placeholder="ราคา" required className={inp} />
            <input name="stock" type="number" min={0} placeholder="จำนวน" required className={inp} />
            <ImageUpload folder="variant" />
            <input type="hidden" name="sort_order" value={variants.length + 1} />
            <input type="hidden" name="active" value="on" />
            <button className={btnAdd}>เพิ่ม</button>
          </form>
        </Card>
      )}
      {variants.map((v) => (
        <Card key={v.id}>
          <div className="mb-2 text-sm font-semibold">
            {sizeText(v.base_size_id)} × {colorName(v.base_color_id)}
          </div>
          <form action={(fd) => save(fd, v.id)} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-4">
            <input type="hidden" name="base_size_id" value={v.base_size_id} />
            <input type="hidden" name="base_color_id" value={v.base_color_id} />
            <label className="text-sm">ราคา
              <input name="price" type="number" defaultValue={v.price} className={`${inp} w-full`} />
            </label>
            <label className="text-sm">จำนวน
              <input name="stock" type="number" defaultValue={v.stock} className={`${inp} w-full`} />
            </label>
            <ImageUpload folder="variant" initialUrl={v.image_url} />
            <input type="hidden" name="sort_order" defaultValue={v.sort_order} />
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" name="active" defaultChecked={v.active} /> เปิดขาย
            </label>
            <div className="flex gap-2">
              <button className={btnSave}>บันทึก</button>
              <DeleteBtn onClick={async () => { await deleteItem("base_variants", v.id); onDone(); }} />
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
      key_color: String(fd.get("key_color")),
      text_color: String(fd.get("text_color")),
      price: num(fd, "price"),
      sort_order: num(fd, "sort_order"),
      active: fd.get("active") === "on",
    });
    onDone();
  }

  async function addChars() {
    const list = Array.from(
      new Set(newChars.toUpperCase().split("").map((c) => c.trim()).filter(Boolean))
    );
    if (list.length === 0) return;
    await addKeycapChars(list);
    setNewChars("");
    onDone();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="font-semibold">สีของตัวอักษร</h2>
        <Card>
          <form action={(fd) => saveColor(fd)} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <input name="name" placeholder="ชื่อสี" required className={inp} />
            <label className="text-xs text-muted">สีแป้น
              <input name="key_color" type="color" defaultValue="#ef4444" className="h-9 w-full rounded-lg border border-border" />
            </label>
            <label className="text-xs text-muted">สีตัวหนังสือ
              <input name="text_color" type="color" defaultValue="#ffffff" className="h-9 w-full rounded-lg border border-border" />
            </label>
            <input name="price" type="number" placeholder="บวกราคา/ตัว" defaultValue={0} className={inp} />
            <input type="hidden" name="sort_order" value={colors.length + 1} />
            <input type="hidden" name="active" value="on" />
            <button className={btnAdd}>เพิ่มสี</button>
          </form>
        </Card>
        {colors.map((c) => (
          <Card key={c.id}>
            <form action={(fd) => saveColor(fd, c.id)} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-6">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted">ตัวอย่าง</span>
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-md text-sm font-bold"
                  style={{ background: c.key_color, color: c.text_color }}
                >
                  A
                </span>
              </div>
              <input name="name" defaultValue={c.name} className={inp} />
              <label className="text-xs text-muted">สีแป้น
                <input name="key_color" type="color" defaultValue={c.key_color} className="h-9 w-full rounded-lg border border-border" />
              </label>
              <label className="text-xs text-muted">สีตัวหนังสือ
                <input name="text_color" type="color" defaultValue={c.text_color} className="h-9 w-full rounded-lg border border-border" />
              </label>
              <input name="price" type="number" defaultValue={c.price} className={inp} />
              <input type="hidden" name="sort_order" defaultValue={c.sort_order} />
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="active" defaultChecked={c.active} /> เปิด
              </label>
              <div className="flex gap-2">
                <button className={btnSave}>บันทึก</button>
                <DeleteBtn onClick={async () => { await deleteItem("keycap_colors", c.id); onDone(); }} />
              </div>
            </form>
          </Card>
        ))}
      </div>

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
            <button onClick={addChars} className={btnAdd}>เพิ่มตัวอักษร</button>
          </div>
          <p className="mt-1 text-xs text-muted">
            เพิ่มแล้วช่องสต็อกจะเริ่มที่ 0 — แก้ตัวเลขในตารางแล้วระบบบันทึกอัตโนมัติ
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
                        className="mx-auto flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ background: c.key_color, color: c.text_color }}
                      >
                        A
                      </span>
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
                        <StockCell char={ch} colorId={c.id} initial={stockMap.get(`${ch}|${c.id}`) ?? 0} />
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
        state === "saving" ? "border-primary" : state === "saved" ? "border-green-400" : "border-border"
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
