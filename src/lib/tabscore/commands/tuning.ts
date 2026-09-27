/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import { parseTex } from "../parse";
import { sliceCp, spliceCp } from "../offsets";
import { countBars, countBeats, type Caret } from "../locate";
import { commitEdit, type CommandResult } from "../apply";

/**
 * A tuning the editor offers, written low-to-high the way a guitarist names
 * one ("Drop D" is D-A-D-G-B-E) but stored high-to-low, which is the order
 * AlphaTex's `\tuning` directive takes and the order alphaTab stores on the
 * staff.
 *
 * Six strings only. The caret's string number is clamped to 1-6 throughout
 * (see locate.ts `clampCaret`) and ScoreCanvas divides the staff's height by
 * a fixed six to turn a click's y into a string, so a 7- or 8-string tuning
 * would render but could not be edited. Adding those means changing the
 * caret model, not this list.
 */
export interface TuningPreset {
  /** Stable id, used as the select's value. */
  id: string;
  /** What a guitarist calls it. */
  label: string;
  /** AlphaTex note names, HIGH string first, e.g. ["e4","b3",...]. */
  notes: string[];
}

/**
 * Taken from alphaTab 1.8.1's own `Tuning.getPresetsFor(6)` table, restricted
 * to the ones a guitarist actually reaches for. Each was round-tripped
 * through `AlphaTexImporter` and matched back with `Tuning.findTuning`, so
 * alphaTab names the staff exactly as the label below says.
 */
export const TUNING_PRESETS: TuningPreset[] = [
  { id: "standard", label: "Standard", notes: ["e4", "b3", "g3", "d3", "a2", "e2"] },
  { id: "half-down", label: "½ step down", notes: ["eb4", "bb3", "gb3", "db3", "ab2", "eb2"] },
  { id: "full-down", label: "1 step down", notes: ["d4", "a3", "f3", "c3", "g2", "d2"] },
  { id: "drop-d", label: "Drop D", notes: ["e4", "b3", "g3", "d3", "a2", "d2"] },
  { id: "double-drop-d", label: "Double drop D", notes: ["d4", "b3", "g3", "d3", "a2", "d2"] },
  { id: "drop-c", label: "Drop C", notes: ["d4", "a3", "f3", "c3", "g2", "c2"] },
  { id: "open-d", label: "Open D", notes: ["d4", "a3", "f#3", "d3", "a2", "d2"] },
  { id: "open-g", label: "Open G", notes: ["d4", "b3", "g3", "d3", "g2", "d2"] },
  { id: "open-e", label: "Open E", notes: ["e4", "b3", "g#3", "e3", "b2", "e2"] },
  { id: "open-c", label: "Open C", notes: ["e4", "c4", "g3", "c3", "g2", "c2"] },
  { id: "dadgad", label: "DADGAD", notes: ["d4", "a3", "g3", "d3", "a2", "d2"] },
];

export const STANDARD_TUNING_ID = "standard";

/** The directive as it is written into the document. */
export function tuningDirective(preset: TuningPreset): string {
  return `\\tuning ${preset.notes.join(" ")}`;
}

function findTuningDirective(
  text: string,
  scoreNode: any,
): { cpStart: number; cpEnd: number; notes: string[] } | null {
  const metaData: any[] = scoreNode?.bars?.[0]?.metaData ?? [];
  for (const node of metaData) {
    if (!node?.tag?.start || !node?.arguments?.start || !node?.arguments?.end) continue;
    const tag = sliceCp(text, node.tag.start.offset, node.tag.end.offset);
    if (!/\\\s*tuning\b/.test(tag)) continue;

    // Like `\tempo`, the argument node's end offset is inclusive and runs to
    // the following newline; splicing it verbatim would swallow the
    // separator and join this directive to the next one.
    const cpStart = node.tag.start.offset;
    let cpEnd = node.arguments.end.offset;
    while (cpEnd > cpStart && /\s/.test(sliceCp(text, cpEnd, cpEnd))) cpEnd--;

    const notes = sliceCp(text, node.arguments.start.offset, cpEnd).trim().split(/\s+/);
    return { cpStart, cpEnd, notes };
  }
  return null;
}

/**
 * Which preset the document is in, by id, or null for a tuning the list does
 * not name (including a hand-written one in the source pane) — the caller
 * shows that as "Custom" rather than pretending it is standard.
 *
 * A document with no `\tuning` directive at all is standard: that is what
 * alphaTab defaults a guitar staff to.
 */
export function readTuningId(text: string, scoreNode?: any): string | null {
  const node = scoreNode ?? (() => {
    const parsed = parseTex(text);
    return parsed.ok ? parsed.scoreNode : null;
  })();
  if (!node) return null;

  const found = findTuningDirective(text, node);
  if (!found) return STANDARD_TUNING_ID;

  const written = found.notes.map((n) => n.toLowerCase()).join(" ");
  return TUNING_PRESETS.find((p) => p.notes.join(" ") === written)?.id ?? null;
}

/**
 * Rewrite the document's tuning, inserting the directive when it has none.
 *
 * The directive is always written, even for standard tuning: one code path,
 * and the source pane then states the tuning outright instead of leaving the
 * reader to know what alphaTab defaults to. Metadata directives are
 * order-independent, so a new one goes at the very top — verified against
 * alphaTab 1.8.1 with `\tuning` before and after `\title` and `\tempo`, and
 * in a document with no metadata block or `.` separator at all.
 */
export function setTuning(
  text: string,
  presetId: string,
  caret: Caret = { barIndex: 0, beatIndex: 0, string: 6 },
): CommandResult | null {
  const preset = TUNING_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;

  const { scoreNode, ok } = parseTex(text);
  if (!ok || !scoreNode) return null;

  const found = findTuningDirective(text, scoreNode);
  const directive = tuningDirective(preset);
  const nextText = found
    ? spliceCp(text, found.cpStart, found.cpEnd, directive)
    : `${directive}\n${text}`;

  // Tuning is metadata: bar and beat counts must come out unchanged, and the
  // caller's caret should survive rather than jumping to the first beat.
  return commitEdit(nextText, caret, {
    bars: countBars(scoreNode),
    beats: countBeats(scoreNode),
  });
}
