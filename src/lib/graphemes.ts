// Split a string into user-perceived characters (graphemes), so that
// multi-codepoint emoji count as a single keycap.
export function splitGraphemes(input: string): string[] {
  const trimmed = input;
  // Intl.Segmenter is available in modern browsers and Node 16+.
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new (Intl as unknown as {
      Segmenter: new (
        locale?: string,
        opts?: { granularity: "grapheme" }
      ) => { segment: (s: string) => Iterable<{ segment: string }> };
    }).Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(seg.segment(trimmed), (s) => s.segment);
  }
  return Array.from(trimmed);
}
