import type { BaseColor, BaseSize, KeycapColor, LetterChoice, Pendant } from "@/lib/types";

export function calcPrice(args: {
  size: BaseSize | null;
  baseColor: BaseColor | null;
  letters: LetterChoice[];
  keycapColors: KeycapColor[];
  pendant: Pendant | null;
}): number {
  const { size, baseColor, letters, keycapColors, pendant } = args;
  let total = 0;
  if (size) total += Number(size.price);
  if (baseColor) total += Number(baseColor.price_modifier);
  const colorPrice = new Map(keycapColors.map((c) => [c.id, Number(c.price)]));
  for (const l of letters) {
    if (l.keycap_color_id) total += colorPrice.get(l.keycap_color_id) ?? 0;
  }
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
