import { parseTex } from "../parse";
import { sliceCp, spliceCp } from "../offsets";
import { beatSpliceRange, countBars, countBeats, type Caret } from "../locate";
import { commitEdit, type CommandResult } from "../apply";

/**
 * A tie, in place of a fret: AlphaTex writes a tied note as `-.<string>`,
 * which sounds the previous note on that string again without re-picking it.
 * Verified against alphaTab 1.8.1 — the importer sets `isTieDestination` and
 * resolves the fret from the origin, including across a barline. With no
 * previous note on that string it silently becomes an open string, which is
 * why `toggleTie` refuses rather than writing one (see tie.ts).
 */
export const TIE = "-";

/** One note within a beat: fret on a string, or a tie to the previous one. */
export interface ParsedNote {
  fret: number | typeof TIE;
  string: number;
  /** Note effect block including braces, e.g. "{h}"; "" when absent. */
  effects: string;
}

export interface ParsedBeat {
  notes: ParsedNote[];
  /** Trailing duration suffix including the dot, e.g. ".8"; "" when inherited. */
  durationSuffix: string;
  /** Beat effect block including braces, e.g. "{d}"; "" when absent. */
  effects: string;
}

/**
 * Parse a beat's source text. Accepts `r.8`, `3.6.8`, `(3.6 5.5).8`, and the
 * same three without a duration suffix.
 *
 * Note-level effects (e.g. `{h}`) sit immediately after a note's own
 * `fret.string`, BEFORE any duration suffix; beat-level effects (e.g. `{d}`)
 * sit at the very end, AFTER it. A note with no explicit duration suffix
 * (very common — most beats inherit it) puts its own effect block last in
 * the beat's text, so a brace block can only be identified as the BEAT's
 * once any note-level ones have already been claimed by their note in
 * left-to-right order — mirroring how the real alphaTex grammar attaches
 * each brace block to whichever element (note or beat) precedes it, rather
 * than by "whichever brace is last in the string". Each branch below
 * matches note-effects, duration, and beat-effects as three ordered groups
 * in one pass instead of stripping a trailing brace up front, so a
 * duration-less note's own effects are never misread as the beat's.
 */
function toFret(raw: string): number | typeof TIE {
  return raw === TIE ? TIE : Number(raw);
}

export function parseBeatText(src: string): ParsedBeat | null {
  const text = src.trim();

  // The chord wrapper's own closing paren is matched greedily (not
  // `[^)]*`) so a note's own bend argument list — which is itself
  // parenthesised, e.g. "(3.6{b (0 4)} 5.5)" — doesn't get mistaken for the
  // chord's closing paren; greedy backtracking finds the true (rightmost)
  // one first.
  const chord = /^\((.*)\)(\.\d+)?(\{[^}]*\})?$/.exec(text);
  if (chord) {
    const notes: ParsedNote[] = [];
    // Match note tokens directly rather than splitting on whitespace first: a
    // note's own effect block can itself contain a space (e.g. "5.5{b (0 4)}"
    // for a bend), which a blind `split(/\s+/)` would tear in half.
    const tokens = chord[1].trim().match(/[^\s{]+(?:\{[^}]*\})?/g) ?? [];
    for (const token of tokens) {
      const m = /^(\d+|-)\.(\d+)(\{[^}]*\})?$/.exec(token);
      if (!m) return null;
      notes.push({ fret: toFret(m[1]), string: Number(m[2]), effects: m[3] ?? "" });
    }
    return { notes, durationSuffix: chord[2] ?? "", effects: chord[3] ?? "" };
  }

  const rest = /^r(\.\d+)?(\{[^}]*\})?$/.exec(text);
  if (rest) return { notes: [], durationSuffix: rest[1] ?? "", effects: rest[2] ?? "" };

  const single = /^(\d+|-)\.(\d+)(\{[^}]*\})?(\.\d+)?(\{[^}]*\})?$/.exec(text);
  if (single) {
    return {
      notes: [{ fret: toFret(single[1]), string: Number(single[2]), effects: single[3] ?? "" }],
      durationSuffix: single[4] ?? "",
      effects: single[5] ?? "",
    };
  }

  return null;
}

/**
 * Split an effects block's inner content into individual tokens, e.g.
 * `"{pm h}"` -> `["pm", "h"]`, `"{b (0 4)}"` -> `["b (0 4)"]`. A token's own
 * argument list stays attached to it rather than being torn off as a
 * separate "token": parenthesised argument lists (`"b (0 4)"`, for bends)
 * and bare trailing numbers alike (`"ah 12"`, the fret-offset argument the
 * harmonic family — `ah`/`th`/`ph`/`sh`/`fh` — takes), so editing one
 * unrelated token in the same block never truncates another's arguments.
 * Shared by any command (`duration.ts`, `technique.ts`) that inspects or
 * rewrites a beat- or note-level effects string one token at a time.
 */
export function tokensOf(effects: string): string[] {
  const inner = effects.replace(/^\{|\}$/g, "").trim();
  if (!inner) return [];
  return inner.match(/[a-z]+(?:\s*\([^)]*\)|\s+\d+)*/g) ?? [];
}

/** Inverse of `tokensOf`: `[]` -> `""`, otherwise `"{" + tokens.join(" ") + "}"`. */
export function formatEffects(tokens: string[]): string {
  return tokens.length ? `{${tokens.join(" ")}}` : "";
}

export function formatBeat(beat: ParsedBeat): string {
  if (beat.notes.length === 0) return `r${beat.durationSuffix}${beat.effects}`;
  const sorted = [...beat.notes].sort((a, b) => b.string - a.string);
  if (sorted.length === 1) {
    const n = sorted[0];
    return `${n.fret}.${n.string}${n.effects}${beat.durationSuffix}${beat.effects}`;
  }
  const inner = sorted.map((n) => `${n.fret}.${n.string}${n.effects}`).join(" ");
  return `(${inner})${beat.durationSuffix}${beat.effects}`;
}

/** Rewrite the beat at the caret via `mutate`, then commit under the guard. */
export function editBeat(
  text: string,
  caret: Caret,
  mutate: (beat: ParsedBeat, caret: Caret) => ParsedBeat | null,
): CommandResult | null {
  const { scoreNode, ok } = parseTex(text);
  if (!ok || !scoreNode) return null;

  const range = beatSpliceRange(text, scoreNode, caret);
  if (!range) return null;

  const parsed = parseBeatText(sliceCp(text, range.cpStart, range.cpEnd));
  if (!parsed) return null;

  const next = mutate(parsed, caret);
  if (!next) return null;

  const nextText = spliceCp(text, range.cpStart, range.cpEnd, formatBeat(next));
  return commitEdit(nextText, caret, {
    bars: countBars(scoreNode),
    beats: countBeats(scoreNode),
  });
}
