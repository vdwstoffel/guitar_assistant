// The last text converted, and its codepoint → UTF-16 table (null when it has
// no astral characters, so the two indexes coincide). Commands convert many
// offsets of one text — a range command reads every beat of a 300-bar tab —
// and walking from the start for each was quadratic.
let lastText: string | null = null;
let lastTable: number[] | null = null;

function tableFor(text: string): number[] | null {
  if (text !== lastText) {
    lastText = text;
    lastTable = null;
    if (/[\uD800-\uDFFF]/.test(text)) {
      const table: number[] = [];
      for (let i = 0; i < text.length; i += text.codePointAt(i)! > 0xffff ? 2 : 1) table.push(i);
      table.push(text.length);
      lastTable = table;
    }
  }
  return lastTable;
}

/**
 * alphaTab AST nodes carry 0-based CODEPOINT offsets, but JS strings are
 * indexed in UTF-16 code units. They agree on BMP-only text and diverge by
 * one per astral character (emoji, musical symbols). Everything that turns
 * an AST offset into a string index must go through here.
 */
export function codepointToUtf16(text: string, cpIndex: number): number {
  if (cpIndex <= 0) return 0;
  const table = tableFor(text);
  if (!table) return Math.min(cpIndex, text.length);
  return table[Math.min(cpIndex, table.length - 1)];
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
