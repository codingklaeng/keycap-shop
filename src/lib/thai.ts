// Thai combining-mark handling for keycaps.
//
// Each grapheme cluster (one keycap / one slot) is split into:
//   - base: the full-size glyph (consonant or same-level vowel เ แ โ ำ า …)
//   - upper: above marks/vowels combined (ิ ี ึ ื ั ็ ์ ํ ่ ้ ๊ ๋ …)  → one add-on
//   - lower: below vowels (ุ ู ฺ)                                       → one add-on
// Only the base consumes a base-plate slot; upper/lower are glued-on add-on
// pieces that are counted/priced separately (and cheaper).

const UPPER = new Set([
  "ั", // ั
  "ิ", // ิ
  "ี", // ี
  "ึ", // ึ
  "ื", // ื
  "็", // ็
  "่", // ่
  "้", // ้
  "๊", // ๊
  "๋", // ๋
  "์", // ์
  "ํ", // ํ
  "๎", // ๎
]);

const LOWER = new Set([
  "ุ", // ุ
  "ู", // ู
  "ฺ", // ฺ
]);

export type CharLevel = "base" | "upper" | "lower";

export function levelOf(ch: string): CharLevel {
  if (UPPER.has(ch)) return "upper";
  if (LOWER.has(ch)) return "lower";
  return "base";
}

export type Unit = {
  /** the whole grapheme as typed (for display / rendering) */
  char: string;
  /** base glyph (consonant / same-level vowel) */
  base: string;
  /** combined above marks, or "" */
  upper: string;
  /** below vowels, or "" */
  lower: string;
};

// Split one grapheme cluster into base + upper + lower.
export function decomposeCluster(cluster: string): Unit {
  let base = "";
  let upper = "";
  let lower = "";
  for (const ch of cluster) {
    const lv = levelOf(ch);
    if (lv === "upper") upper += ch;
    else if (lv === "lower") lower += ch;
    else base += ch;
  }
  // a stray mark with no base (rare) — treat it as its own base so it still prints
  if (base === "") base = cluster;
  return { char: cluster, base, upper, lower };
}

// How many add-on pieces a unit has (0–2): one for any upper, one for any lower.
export function addonCount(u: Unit): number {
  return (u.upper ? 1 : 0) + (u.lower ? 1 : 0);
}

// Every individual physical piece a unit needs in a given (any) color — used for
// stock availability: the base letter plus each single mark.
export function unitPieceChars(u: Unit): string[] {
  const out = [u.base];
  for (const ch of u.upper) out.push(ch);
  for (const ch of u.lower) out.push(ch);
  return out;
}
