import { createBrowserClient } from "@/lib/supabase/client";
import type {
  BaseColor,
  BaseSize,
  BaseType,
  BaseVariant,
  Catalog,
  KeycapColor,
  KeycapStock,
  Pendant,
  SocialPlatform,
} from "@/lib/types";

export type NameplateConfig = {
  base_price: number;
  price_per_char: number;
  active: boolean;
};

export async function getNameplateConfig(): Promise<NameplateConfig | null> {
  const sb = createBrowserClient();
  const { data } = await sb
    .from("nameplate_config")
    .select("base_price,price_per_char,active")
    .eq("id", 1)
    .maybeSingle();
  return (data as NameplateConfig) ?? null;
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
  const [baseTypes, baseSizes, baseColors, baseVariants, keycapColors, keycapStock, pendants] =
    await Promise.all([
      sb.from("base_types").select("*").eq("active", true).order("sort_order"),
      sb.from("base_sizes").select("*").eq("active", true).order("sort_order"),
      sb.from("base_colors").select("*").eq("active", true).order("sort_order"),
      sb.from("base_variants").select("*").eq("active", true).gt("stock", 0).order("sort_order"),
      sb.from("keycap_colors").select("*").eq("active", true).order("sort_order"),
      sb.from("keycap_stock").select("*").gt("stock", 0),
      sb.from("pendants").select("*").eq("active", true).order("sort_order"),
    ]);

  return {
    baseTypes: (baseTypes.data ?? []) as BaseType[],
    baseSizes: (baseSizes.data ?? []) as BaseSize[],
    baseColors: (baseColors.data ?? []) as BaseColor[],
    baseVariants: (baseVariants.data ?? []) as BaseVariant[],
    keycapColors: (keycapColors.data ?? []) as KeycapColor[],
    keycapStock: (keycapStock.data ?? []) as KeycapStock[],
    pendants: (pendants.data ?? []) as Pendant[],
  };
}
