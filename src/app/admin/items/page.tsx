import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/AdminNav";
import { ItemsManager } from "@/components/ItemsManager";
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
import type { NameplateConfig as NameplateConfigRow } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const sb = createAdminClient();
  const [types, sizes, baseColors, variants, keycapColors, stock, pendants, platforms, npCfg] =
    await Promise.all([
      sb.from("base_types").select("*").order("sort_order"),
      sb.from("base_sizes").select("*").order("sort_order"),
      sb.from("base_colors").select("*").order("sort_order"),
      sb.from("base_variants").select("*").order("sort_order"),
      sb.from("keycap_colors").select("*").order("sort_order"),
      sb.from("keycap_stock").select("*"),
      sb.from("pendants").select("*").order("sort_order"),
      sb.from("social_platforms").select("*").order("sort_order"),
      sb.from("nameplate_config").select("base_price,price_per_char,price_per_size_mm,price_per_mm_thick,stroke_surcharge,icon_surcharge,active").eq("id", 1).maybeSingle(),
    ]);

  return (
    <div className="flex-1">
      <AdminNav active="items" />
      <ItemsManager
        baseTypes={(types.data ?? []) as BaseType[]}
        baseSizes={(sizes.data ?? []) as BaseSize[]}
        baseColors={(baseColors.data ?? []) as BaseColor[]}
        baseVariants={(variants.data ?? []) as BaseVariant[]}
        keycapColors={(keycapColors.data ?? []) as KeycapColor[]}
        keycapStock={(stock.data ?? []) as KeycapStock[]}
        pendants={(pendants.data ?? []) as Pendant[]}
        platforms={(platforms.data ?? []) as SocialPlatform[]}
        nameplateConfig={
          (npCfg.data as NameplateConfigRow) ?? {
            base_price: 80,
            price_per_char: 25,
            price_per_size_mm: 1.5,
            price_per_mm_thick: 5,
            stroke_surcharge: 30,
            icon_surcharge: 20,
            active: true,
          }
        }
      />
    </div>
  );
}
