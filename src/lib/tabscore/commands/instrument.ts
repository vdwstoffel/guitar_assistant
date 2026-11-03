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
 * A guitar the editor offers: which General MIDI instrument the tab is
 * played with. The notes and the staff are the same for every one; only the
 * sound changes, and only within whichever sound bank is loaded (see
 * src/lib/soundBank.ts — the bank is the sample set, this picks the guitar
 * out of it).
 *
 * Guitars only. Bass and 7-string are a different number of strings, which
 * the caret model cannot edit yet (see tuning.ts).
 */
export interface GuitarPreset {
  /** Stable id, used as the select's value. */
  id: string;
  /** What a guitarist calls it. */
  label: string;
  /** Zero-based General MIDI program, the number `\instrument` takes. */
  program: number;
}

/** Programs from alphaTab 1.8.1's own `GeneralMidi` name table. */
export const GUITAR_PRESETS: GuitarPreset[] = [
  { id: "nylon", label: "Nylon acoustic", program: 24 },
  { id: "steel", label: "Steel acoustic", program: 25 },
  { id: "jazz", label: "Jazz electric", program: 26 },
  { id: "clean", label: "Clean electric", program: 27 },
  { id: "muted", label: "Muted electric", program: 28 },
  { id: "overdrive", label: "Overdrive", program: 29 },
  { id: "distortion", label: "Distortion", program: 30 },
];

/** What alphaTab plays a tab with no `\instrument` directive as. */
export const DEFAULT_GUITAR_ID = "steel";

/**
 * Written as a number, not alphaTab's name (`distortionguitar`): the tabs
 * already saved, and the ones alphatexSerializer.ts generates, all use the
 * number, so one document never mixes the two styles.
 */
export function instrumentDirective(preset: GuitarPreset): string {
  return `\\instrument ${preset.program}`;
}

function findInstrumentDirective(
  text: string,
  scoreNode: any,
): { cpStart: number; cpEnd: number } | null {
  const metaData: any[] = scoreNode?.bars?.[0]?.metaData ?? [];
  for (const node of metaData) {
    if (!node?.tag?.start || !node?.arguments?.start || !node?.arguments?.end) continue;
    const tag = sliceCp(text, node.tag.start.offset, node.tag.end.offset);
    if (!/\\\s*instrument\b/.test(tag)) continue;

    // Same inclusive-and-runs-to-the-newline argument range as `\tuning`;
    // trimmed so the splice keeps the separator before the next directive.
    const cpStart = node.tag.start.offset;
    let cpEnd = node.arguments.end.offset;
    while (cpEnd > cpStart && /\s/.test(sliceCp(text, cpEnd, cpEnd))) cpEnd--;
    return { cpStart, cpEnd };
  }
  return null;
}

/**
 * Which guitar the document plays as, by id, or null for an instrument the
 * list does not name (a piano written in the source pane, say) — the caller
 * shows that as "Other".
 *
 * Read off the imported score rather than the directive's text, so alphaTab's
 * names (`\instrument distortionguitar`) and a missing directive (alphaTab's
 * default, steel acoustic) both resolve exactly as playback will hear them.
 */
export function readGuitarId(text: string, score?: any): string | null {
  const resolved = score ?? (() => {
    const parsed = parseTex(text);
    return parsed.ok ? parsed.score : null;
  })();
  const program = resolved?.tracks?.[0]?.playbackInfo?.program;
  if (typeof program !== "number") return null;
  return GUITAR_PRESETS.find((p) => p.program === program)?.id ?? null;
}

/**
 * Rewrite the document's instrument, inserting the directive when it has
 * none. Like `setTuning`, it is always written — even for the default — so
 * the source pane states the guitar outright.
 */
export function setGuitar(
  text: string,
  presetId: string,
  caret: Caret = { barIndex: 0, beatIndex: 0, string: 6 },
): CommandResult | null {
  const preset = GUITAR_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;

  const { scoreNode, ok } = parseTex(text);
  if (!ok || !scoreNode) return null;

  const found = findInstrumentDirective(text, scoreNode);
  const directive = instrumentDirective(preset);
  const nextText = found
    ? spliceCp(text, found.cpStart, found.cpEnd, directive)
    : `${directive}\n${text}`;

  // Metadata only: bar and beat counts must come out unchanged, and the
  // caret stays where the user left it.
  return commitEdit(nextText, caret, {
    bars: countBars(scoreNode),
    beats: countBeats(scoreNode),
  });
}
