import { createBrowserClient } from "@/lib/supabase/client";
import type {
  BaseColor,
  BaseSize,
  Catalog,
  KeycapColor,
  KeycapStock,
  Pendant,
} from "@/lib/types";

// Read the active catalog for the customer ordering wizard.
// Uses the public key; RLS allows read of all rows so we filter active here.
export async function getActiveCatalog(): Promise<Catalog> {
  const sb = createBrowserClient();
  const [baseSizes, baseColors, keycapColors, keycapStock, pendants] =
    await Promise.all([
      sb.from("base_sizes").select("*").eq("active", true).order("sort_order"),
      sb.from("base_colors").select("*").eq("active", true).order("sort_order"),
      sb.from("keycap_colors").select("*").eq("active", true).order("sort_order"),
      sb.from("keycap_stock").select("*").gt("stock", 0),
      sb.from("pendants").select("*").eq("active", true).order("sort_order"),
    ]);

  return {
    baseSizes: (baseSizes.data ?? []) as BaseSize[],
    baseColors: (baseColors.data ?? []) as BaseColor[],
    keycapColors: (keycapColors.data ?? []) as KeycapColor[],
    keycapStock: (keycapStock.data ?? []) as KeycapStock[],
    pendants: (pendants.data ?? []) as Pendant[],
  };
}
