import { createBrowserClient } from "@/lib/supabase/client";
import type {
  BaseColor,
  BaseSize,
  BaseType,
  BaseVariant,
  Catalog,
  KeycapColor,
  KeycapStock,
  NameplateColor,
  Pendant,
  SocialPlatform,
} from "@/lib/types";

export type NameplateConfig = {
  base_price: number;
  price_per_char: number;
  price_per_size_mm: number;
  price_per_mm_thick: number;
  stroke_surcharge: number;
  stroke_price_per_width_char: number;
  edge_surcharge_per_char: number;
  icon_surcharge_small: number;
  icon_surcharge_large: number;
  min_deposit_percent: number;
  active: boolean;
};

export async function getNameplateConfig(): Promise<NameplateConfig | null> {
  const sb = createBrowserClient();
  const { data } = await sb
    .from("nameplate_config")
    .select(
      "base_price,price_per_char,price_per_size_mm,price_per_mm_thick,stroke_surcharge,stroke_price_per_width_char,edge_surcharge_per_char,icon_surcharge_small,icon_surcharge_large,min_deposit_percent,active"
    )
    .eq("id", 1)
    .maybeSingle();
  return (data as NameplateConfig) ?? null;
}

// The filament colors the shop currently offers for 3D nameplates (active only).
export async function getNameplateColors(): Promise<NameplateColor[]> {
  const sb = createBrowserClient();
  const { data } = await sb
    .from("nameplate_colors")
    .select("id,name,swatch,sort_order,active")
    .eq("active", true)
    .order("sort_order");
  return (data ?? []) as NameplateColor[];
}

// Active social platforms for the NFC keychain ordering page (in stock).
export async function getActivePlatforms(): Promise<SocialPlatform[]> {
  const sb = createBrowserClient();
  const { data } = await sb
    .from("social_platforms")
    .select("*")
    .eq("active", true)
    .gt("stock", 0)
    .order("sort_order");
  return (data ?? []) as SocialPlatform[];
}

// Read the active catalog for the customer ordering wizard.
// Uses the public key; RLS allows read of all rows so we filter active here.
export async function getActiveCatalog(): Promise<Catalog> {
  const sb = createBrowserClient();
  const [baseTypes, baseSizes, baseColors, baseVariants, keycapColors, keycapStock, pendants, keycapCfg] =
    await Promise.all([
      sb.from("base_types").select("*").eq("active", true).order("sort_order"),
      sb.from("base_sizes").select("*").eq("active", true).order("sort_order"),
      sb.from("base_colors").select("*").eq("active", true).order("sort_order"),
      sb.from("base_variants").select("*").eq("active", true).gt("stock", 0).order("sort_order"),
      sb.from("keycap_colors").select("*").eq("active", true).order("sort_order"),
      sb.from("keycap_stock").select("*").gt("stock", 0),
      sb.from("pendants").select("*").eq("active", true).order("sort_order"),
      sb.from("keycap_config").select("addon_price").eq("id", 1).maybeSingle(),
    ]);

  return {
    baseTypes: (baseTypes.data ?? []) as BaseType[],
    baseSizes: (baseSizes.data ?? []) as BaseSize[],
    baseColors: (baseColors.data ?? []) as BaseColor[],
    baseVariants: (baseVariants.data ?? []) as BaseVariant[],
    keycapColors: (keycapColors.data ?? []) as KeycapColor[],
    keycapStock: (keycapStock.data ?? []) as KeycapStock[],
    pendants: (pendants.data ?? []) as Pendant[],
    addonPrice: Number((keycapCfg.data as { addon_price?: number } | null)?.addon_price ?? 0),
  };
}

export type KeycapConfig = { addon_price: number };

export async function getKeycapConfig(): Promise<KeycapConfig> {
  const sb = createBrowserClient();
  const { data } = await sb
    .from("keycap_config")
    .select("addon_price")
    .eq("id", 1)
    .maybeSingle();
  return { addon_price: Number((data as KeycapConfig | null)?.addon_price ?? 0) };
}
