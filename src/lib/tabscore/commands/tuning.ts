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
 * Six strings for a guitar tab, four for a bass tab. The editor takes the
 * caret's string range from the tab's own string count (locate.ts
 * `stringCount`): `clampCaret`, the arrow keys and ScoreCanvas's
 * click-to-string mapping all follow it. So a list for another count — 7 or
 * 8 strings — would also edit; there just is none, and `tuningPresetsFor`
 * offers such a tab the guitar list, where its tuning shows as "Custom".
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
  { id: "c-sharp-standard", label: "C♯ standard", notes: ["db4", "ab3", "e3", "b2", "gb2", "db2"] },
  { id: "c-standard", label: "C standard", notes: ["c4", "g3", "eb3", "bb2", "f2", "c2"] },
  { id: "drop-d", label: "Drop D", notes: ["e4", "b3", "g3", "d3", "a2", "d2"] },
  { id: "drop-c-sharp", label: "Drop C♯", notes: ["eb4", "bb3", "gb3", "db3", "ab2", "db2"] },
  { id: "double-drop-d", label: "Double drop D", notes: ["d4", "b3", "g3", "d3", "a2", "d2"] },
  { id: "drop-c", label: "Drop C", notes: ["d4", "a3", "f3", "c3", "g2", "c2"] },
  { id: "open-d", label: "Open D", notes: ["d4", "a3", "f#3", "d3", "a2", "d2"] },
  { id: "open-g", label: "Open G", notes: ["d4", "b3", "g3", "d3", "g2", "d2"] },
  { id: "open-e", label: "Open E", notes: ["e4", "b3", "g#3", "e3", "b2", "e2"] },
  { id: "open-c", label: "Open C", notes: ["e4", "c4", "g3", "c3", "g2", "c2"] },
  { id: "dadgad", label: "DADGAD", notes: ["d4", "a3", "g3", "d3", "a2", "d2"] },
];

/**
 * Four-string bass, one per tuning the writing session offers (see
 * songwriting/tunings.ts `SESSION_TUNING_IDS`): each is the matching guitar
 * tuning's four lowest strings an octave down, under the same label, and its
 * id is the guitar's prefixed with `bass-` (songwriting/bassTunings.ts maps
 * one to the other). Flats, like the guitar list. Each was round-tripped
 * through `AlphaTexImporter`; alphaTab 1.8.1's own `Tuning.getPresetsFor(4)`
 * table names five of them (Standard, ½ and 1 step down, C standard as
 * "Tune down 2 step", Drop D) and has no entry for C♯ standard, Drop C♯ or
 * Drop C, which import all the same.
 */
export const BASS_TUNING_PRESETS: TuningPreset[] = [
  { id: "bass-standard", label: "Standard", notes: ["g2", "d2", "a1", "e1"] },
  { id: "bass-half-down", label: "½ step down", notes: ["gb2", "db2", "ab1", "eb1"] },
  { id: "bass-full-down", label: "1 step down", notes: ["f2", "c2", "g1", "d1"] },
  { id: "bass-c-sharp-standard", label: "C♯ standard", notes: ["e2", "b1", "gb1", "db1"] },
  { id: "bass-c-standard", label: "C standard", notes: ["eb2", "bb1", "f1", "c1"] },
  { id: "bass-drop-d", label: "Drop D", notes: ["g2", "d2", "a1", "d1"] },
  { id: "bass-drop-c-sharp", label: "Drop C♯", notes: ["gb2", "db2", "ab1", "db1"] },
  { id: "bass-drop-c", label: "Drop C", notes: ["f2", "c2", "g1", "c1"] },
];

export const STANDARD_TUNING_ID = "standard";

const ALL_PRESETS: TuningPreset[] = [...TUNING_PRESETS, ...BASS_TUNING_PRESETS];

/** The preset with this id, guitar or bass. */
export function findTuningPreset(id: string | null): TuningPreset | undefined {
  return ALL_PRESETS.find((p) => p.id === id);
}

/** The list the tuning control offers a tab with this many strings: bass for four, guitar otherwise. */
export function tuningPresetsFor(strings: number): TuningPreset[] {
  return strings === 4 ? BASS_TUNING_PRESETS : TUNING_PRESETS;
}

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
  return ALL_PRESETS.find((p) => p.notes.join(" ") === written)?.id ?? null;
}

/**
 * Rewrite the document's tuning, inserting the directive when it has none.
 * Guitar or bass: a preset with a different string count than the tab's is
 * written as asked, and refused (null) only when the result does not import —
 * a bass tuning on a guitar tab with notes on strings 5 or 6.
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
  const preset = findTuningPreset(presetId);
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
