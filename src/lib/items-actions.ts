"use server";

import { randomUUID } from "crypto";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

async function guard() {
  if (!(await isAdmin())) throw new Error("unauthorized");
  return createAdminClient();
}

type BaseTypeInput = {
  id?: string;
  name: string;
  sort_order?: number;
  active?: boolean;
};

type BaseSizeInput = {
  id?: string;
  base_type_id: string;
  max_chars: number; // = จำนวนช่อง
  sort_order?: number;
  active?: boolean;
};

type BaseColorInput = {
  id?: string;
  name: string;
  swatch?: string | null;
  image_url?: string | null;
  sort_order?: number;
  active?: boolean;
};

type BaseVariantInput = {
  id?: string;
  base_size_id: string;
  base_color_id: string;
  price: number;
  stock: number;
  image_url?: string | null;
  sort_order?: number;
  active?: boolean;
};

type KeycapColorInput = {
  id?: string;
  name: string;
  key_color?: string;
  text_color?: string;
  image_url?: string | null;
  price: number;
  sort_order?: number;
  active?: boolean;
};

type SocialPlatformInput = {
  id?: string;
  name: string;
  url_template: string;
  hint?: string | null;
  icon?: string | null;
  image_url?: string | null;
  brand_color?: string | null;
  price: number;
  stock: number;
  sort_order?: number;
  active?: boolean;
};

type PendantInput = {
  id?: string;
  name: string;
  image_url?: string | null;
  price: number;
  stock: number;
  sort_order?: number;
  active?: boolean;
};

export async function saveBaseType(input: BaseTypeInput) {
  const sb = await guard();
  const { error } = await sb.from("base_types").upsert(input);
  if (error) throw new Error(error.message);
}

export async function saveBaseSize(input: BaseSizeInput) {
  const sb = await guard();
  const { error } = await sb.from("base_sizes").upsert(input);
  if (error) throw new Error(error.message);
}

export async function saveBaseColor(input: BaseColorInput) {
  const sb = await guard();
  const { error } = await sb.from("base_colors").upsert(input);
  if (error) throw new Error(error.message);
}

export async function saveBaseVariant(input: BaseVariantInput) {
  const sb = await guard();
  const { error } = await sb
    .from("base_variants")
    .upsert(input, { onConflict: "base_size_id,base_color_id" });
  if (error) throw new Error(error.message);
}

// Create base_variants for every size of a base type at once: price scales with
// the size's slot count, stock is the same starter value, and any size that
// already has a variant for this color is skipped.
export async function addVariantsBatch(input: {
  base_type_id: string;
  base_color_id: string;
  price_first: number; // price for a 1-slot size
  price_per_extra: number; // added per extra slot
  stock: number;
}): Promise<{ added: number; skipped: number }> {
  const sb = await guard();
  const { data: sizes } = await sb
    .from("base_sizes")
    .select("id,max_chars")
    .eq("base_type_id", input.base_type_id);
  if (!sizes || sizes.length === 0) return { added: 0, skipped: 0 };

  const { data: existing } = await sb
    .from("base_variants")
    .select("base_size_id")
    .eq("base_color_id", input.base_color_id);
  const have = new Set((existing ?? []).map((e) => e.base_size_id));

  const missing = sizes.filter((s) => !have.has(s.id));
  const rows = missing.map((s) => ({
    base_size_id: s.id,
    base_color_id: input.base_color_id,
    price:
      Number(input.price_first) +
      Math.max(0, Number(s.max_chars) - 1) * Number(input.price_per_extra),
    stock: Math.max(0, Math.floor(input.stock)),
    sort_order: Number(s.max_chars),
    active: true,
  }));
  if (rows.length > 0) {
    const { error } = await sb
      .from("base_variants")
      .upsert(rows, { onConflict: "base_size_id,base_color_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  return { added: rows.length, skipped: sizes.length - rows.length };
}

export async function saveKeycapColor(input: KeycapColorInput) {
  const sb = await guard();
  // Insert returns the new row so we can backfill stock rows for every char.
  const { data, error } = await sb
    .from("keycap_colors")
    .upsert(input)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // ensure a stock row exists for this color for every existing char
  if (data?.id) {
    const { data: chars } = await sb
      .from("keycap_stock")
      .select("char")
      .order("char");
    const distinct = Array.from(new Set((chars ?? []).map((c) => c.char)));
    if (distinct.length > 0) {
      await sb
        .from("keycap_stock")
        .upsert(
          distinct.map((ch) => ({ char: ch, color_id: data.id, stock: 0 })),
          { onConflict: "char,color_id", ignoreDuplicates: true }
        );
    }
  }
}

export async function savePendant(input: PendantInput) {
  const sb = await guard();
  const { error } = await sb.from("pendants").upsert(input);
  if (error) throw new Error(error.message);
}

export async function saveSocialPlatform(input: SocialPlatformInput) {
  const sb = await guard();
  const { error } = await sb.from("social_platforms").upsert(input);
  if (error) throw new Error(error.message);
}

export async function saveKeycapConfig(input: { addon_price: number }) {
  const sb = await guard();
  const { error } = await sb
    .from("keycap_config")
    .update(input)
    .eq("id", 1);
  if (error) throw new Error(error.message);
}

export async function saveNameplateColor(input: {
  id?: string;
  name: string;
  swatch: string;
  sort_order?: number;
  active?: boolean;
}) {
  const sb = await guard();
  const { error } = await sb.from("nameplate_colors").upsert(input);
  if (error) throw new Error(error.message);
}

export async function saveNameplateConfig(input: {
  base_price: number;
  price_per_char: number;
  price_per_size_mm: number;
  price_per_mm_thick: number;
  stroke_surcharge: number;
  icon_surcharge: number;
  min_deposit_percent: number;
  active: boolean;
}) {
  const sb = await guard();
  const { error } = await sb
    .from("nameplate_config")
    .update(input)
    .eq("id", 1);
  if (error) throw new Error(error.message);
}

export async function deleteItem(
  table:
    | "base_types"
    | "base_sizes"
    | "base_colors"
    | "base_variants"
    | "keycap_colors"
    | "pendants"
    | "social_platforms"
    | "nameplate_colors",
  id: string
) {
  const sb = await guard();
  const { error } = await sb.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setKeycapStock(
  char: string,
  colorId: string,
  stock: number
) {
  const sb = await guard();
  const { error } = await sb
    .from("keycap_stock")
    .upsert(
      { char, color_id: colorId, stock: Math.max(0, Math.floor(stock)) },
      { onConflict: "char,color_id" }
    );
  if (error) throw new Error(error.message);
}

// Bulk upsert keycap stock (used by the Excel/CSV import). Creates rows for new
// characters too. Each row is (char, color_id, stock).
export async function bulkSetKeycapStock(
  rows: { char: string; color_id: string; stock: number }[]
) {
  const sb = await guard();
  const clean = rows
    .filter((r) => r.char && r.color_id)
    .map((r) => ({
      char: r.char,
      color_id: r.color_id,
      stock: Math.max(0, Math.floor(Number(r.stock) || 0)),
    }));
  if (clean.length === 0) return { saved: 0 };
  const { error } = await sb
    .from("keycap_stock")
    .upsert(clean, { onConflict: "char,color_id" });
  if (error) throw new Error(error.message);
  return { saved: clean.length };
}

// Add one or more characters: creates a stock row (default 0) for each keycap color.
export async function addKeycapChars(chars: string[]) {
  const sb = await guard();
  const { data: colors } = await sb.from("keycap_colors").select("id");
  const colorIds = (colors ?? []).map((c) => c.id);
  const rows = chars.flatMap((ch) =>
    colorIds.map((cid) => ({ char: ch, color_id: cid, stock: 0 }))
  );
  if (rows.length === 0) return;
  const { error } = await sb
    .from("keycap_stock")
    .upsert(rows, { onConflict: "char,color_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function removeKeycapChar(char: string) {
  const sb = await guard();
  const { error } = await sb.from("keycap_stock").delete().eq("char", char);
  if (error) throw new Error(error.message);
}

// Upload an image to the public 'images' bucket; returns its public URL.
export async function uploadImage(formData: FormData): Promise<string> {
  const sb = await guard();
  const file = formData.get("file") as File | null;
  const folder = String(formData.get("folder") ?? "misc");
  if (!file) throw new Error("no file");
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${folder}/${randomUUID()}.${ext}`;
  const { error } = await sb.storage
    .from("images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  const { data } = sb.storage.from("images").getPublicUrl(path);
  return data.publicUrl;
}
