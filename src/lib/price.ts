import type { BaseVariant, KeycapColor, LetterChoice, Pendant } from "@/lib/types";

export function calcPrice(args: {
  variant: BaseVariant | null;
  letters: LetterChoice[];
  keycapColors: KeycapColor[];
  pendant: Pendant | null;
  /** flat price per Thai add-on piece (upper/lower vowel or tone) */
  addonPrice?: number;
  /** total number of add-on pieces across all units */
  addonCount?: number;
}): number {
  const { variant, letters, keycapColors, pendant } = args;
  let total = 0;
  if (variant) total += Number(variant.price);
  const colorPrice = new Map(keycapColors.map((c) => [c.id, Number(c.price)]));
  for (const l of letters) {
    if (l.keycap_color_id) total += colorPrice.get(l.keycap_color_id) ?? 0;
  }
  total += Number(args.addonPrice ?? 0) * Number(args.addonCount ?? 0);
  if (pendant) total += Number(pendant.price);
  return total;
}

export function formatBaht(n: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}
