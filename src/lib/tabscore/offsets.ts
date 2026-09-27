/**
 * alphaTab AST nodes carry 0-based CODEPOINT offsets, but JS strings are
 * indexed in UTF-16 code units. They agree on BMP-only text and diverge by
 * one per astral character (emoji, musical symbols). Everything that turns
 * an AST offset into a string index must go through here.
 */
export function codepointToUtf16(text: string, cpIndex: number): number {
  if (cpIndex <= 0) return 0;
  let cp = 0;
  for (let i = 0; i < text.length; ) {
    if (cp === cpIndex) return i;
    const code = text.codePointAt(i)!;
    i += code > 0xffff ? 2 : 1;
    cp++;
  }
  return text.length;
}

/** Slice by inclusive codepoint bounds. */
export function sliceCp(text: string, cpStart: number, cpEndInclusive: number): string {
  const a = codepointToUtf16(text, cpStart);
  const b = codepointToUtf16(text, cpEndInclusive + 1);
  return text.slice(a, b);
}

/** Replace an inclusive codepoint range, leaving everything else untouched. */
export function spliceCp(
  text: string,
  cpStart: number,
  cpEndInclusive: number,
  replacement: string,
): string {
  const a = codepointToUtf16(text, cpStart);
  const b = codepointToUtf16(text, cpEndInclusive + 1);
  return text.slice(0, a) + replacement + text.slice(b);
}

/** alphaTex offsets assume LF; normalise before parsing so they stay aligned. */
export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}
