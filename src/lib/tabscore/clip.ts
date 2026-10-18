/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import { parseTex } from "./parse";
import { normalizeNewlines, sliceCp } from "./offsets";
import { beatSpliceRange, type BeatPos } from "./locate";
import { beatLength } from "./barFill";
import { cmp, type Fraction } from "./fraction";
import { durationAt } from "./repin";
import { isWholeBars, positionsIn, stillValid, type Range, type RangeSize } from "./selection";
import {
  formatBeat,
  formatEffects,
  liftLengthMarkers,
  parseBeatText,
  tokensOf,
  TIE,
  type ParsedBeat,
  type ParsedNote,
} from "./commands/beatText";
import { isEditableBar } from "./commands/barEdit";
import { withoutLegato } from "./commands/rest";
import { tieOrigin } from "./commands/tie";

/**
 * A passage of tab on its way through the clipboard. Its text carries
 * everything a paste needs, so the same text pastes the same way in any tab,
 * after a reload and from the Source pane: every beat's length (the first
 * beat's duration written out), no directives, ties and legato that only
 * bind inside it, and — for whole bars — a trailing ` |`, which alphaTab
 * ignores but which says "these are bars".
 */
export interface ParsedClip extends RangeSize {
  /** The clipboard text: bars joined by " | "; whole bars end with " |". */
  text: string;
  /** Each bar's beats, normalised, as a paste writes them. */
  beatsByBar: string[][];
  /** Each beat's length in whole notes, read from the normalised text. */
  lengthsByBar: Fraction[][];
  /** Every string a note of the clip is on. */
  strings: number[];
  /** The duration in force after the clip's last beat. */
  lastBase: number;
}

/** Copy's answer: the clip, or the bar it cannot copy. */
export type CopyOutcome = { kind: "copied"; clip: ParsedClip } | { kind: "refused"; barIndex: number };

/**
 * The first beat of a clip, given as its text, with its duration written
 * out: `.base` when it has no suffix of its own, whatever it would inherit —
 * unlike repinAt, which writes only when the inherited value differs. A clip
 * that starts bare would otherwise take whatever base is in force where it
 * lands. Null for a beat parseBeatText cannot read.
 */
export function pinFirstBeat(beatText: string, base: number): string | null {
  const beat = parseBeatText(beatText);
  if (!beat) return null;
  return beat.durationSuffix ? beatText : formatBeat({ ...liftLengthMarkers(beat), durationSuffix: `.${base}` });
}

/** What normalising a range made of it: its bars, or the bar it could not make stand alone. */
type Normalised = { bars: string[][] } | { refusedBar: number };

/**
 * The beats of `range` as clip text, bar by bar, from one parse: each as
 * written, except that a beat whose inherited duration differs from the one
 * before it in the clip gets it written out (no bar the commands read reaches
 * that: a beat inherits its predecessor's duration unless a `:8` precedes it,
 * which isEditableBar refuses); a leading tie — no earlier note on its string
 * in the clip — becomes the fret it sounds (the fret of its origin, as far
 * back as alphaTab binds one, else the open string alphaTab plays); and the
 * hammer-on or slide on each string's last note is dropped, since what it
 * bound to is not in the clip. The first beat is left for pinFirstBeat.
 *
 * Refused, naming the bar, for a beat that cannot be read and for a leading
 * tie whose origin cannot be named: tieOrigin's walk back met a beat the
 * commands cannot read, which might hold the note the tie sounds, or a note
 * marked as a tie. Writing an older fret, or the open string, would paste a
 * different note. The bar named is the tie's.
 */
function normalisedBars(text: string, scoreNode: any, range: Range): Normalised {
  const beats: Array<{ pos: BeatPos; source: string; beat: ParsedBeat; changed: boolean }> = [];
  for (const pos of positionsIn(scoreNode, range)) {
    const r = beatSpliceRange(text, scoreNode, pos);
    const source = r ? sliceCp(text, r.cpStart, r.cpEnd) : "";
    const beat = parseBeatText(source);
    if (!beat) return { refusedBar: pos.barIndex };
    beats.push({ pos, source, beat, changed: false });
  }
  const edit = (b: (typeof beats)[number], next: ParsedBeat) => {
    b.beat = next;
    b.changed = true;
  };
  for (let i = 1; i < beats.length; i++) {
    const base = durationAt(scoreNode, beats[i].pos);
    if (!beats[i].beat.durationSuffix && base !== durationAt(scoreNode, beats[i - 1].pos)) {
      edit(beats[i], { ...liftLengthMarkers(beats[i].beat), durationSuffix: `.${base}` });
    }
  }
  const tieSeen = new Set<number>();
  for (const b of beats) {
    const notes: ParsedNote[] = [];
    for (const note of b.beat.notes) {
      const leading = !tieSeen.has(note.string);
      tieSeen.add(note.string);
      if (!leading || note.fret !== TIE) {
        notes.push(note);
        continue;
      }
      const origin = tieOrigin(text, scoreNode, { ...b.pos, string: note.string });
      if (origin.kind === "blocked") return { refusedBar: b.pos.barIndex };
      notes.push({ ...note, fret: origin.kind === "fret" ? origin.fret : 0 });
    }
    if (notes.some((note, i) => note !== b.beat.notes[i])) edit(b, { ...b.beat, notes });
  }
  const legatoSeen = new Set<number>();
  for (let i = beats.length - 1; i >= 0; i--) {
    const b = beats[i];
    const notes = b.beat.notes.map((note) => {
      const last = !legatoSeen.has(note.string);
      legatoSeen.add(note.string);
      if (!last) return note;
      const tokens = tokensOf(note.effects);
      const kept = withoutLegato(tokens);
      return kept.length < tokens.length ? { ...note, effects: formatEffects(kept) } : note;
    });
    if (notes.some((note, i) => note !== b.beat.notes[i])) edit(b, { ...b.beat, notes });
  }
  const bars: string[][] = [];
  for (const b of beats) {
    const k = b.pos.barIndex - range.from.barIndex;
    (bars[k] ??= []).push(b.changed ? formatBeat(b.beat) : b.source);
  }
  return { bars };
}

/**
 * The clip for `range` — what Ctrl+C writes. Refused, naming the bar, when a
 * bar of the range is one the commands cannot read (barEdit.ts's
 * isEditableBar) or has no beats, when the text does not parse, or when a
 * leading tie's origin cannot be named (normalisedBars) — the bar with the tie.
 * Refused too, naming the range's first bar, when a beat would come out of
 * the clip at another length than it has here.
 */
export function copyRange(text: string, range: Range): CopyOutcome {
  const refused = (barIndex: number): CopyOutcome => ({ kind: "refused", barIndex });
  const parsed = parseTex(text);
  if (!parsed.ok || !parsed.scoreNode || !stillValid(parsed.scoreNode, range)) return refused(range.from.barIndex);
  for (let barIndex = range.from.barIndex; barIndex <= range.to.barIndex; barIndex++) {
    const empty = (parsed.scoreNode.bars[barIndex]?.beats?.length ?? 0) === 0;
    if (empty || !isEditableBar(text, parsed, barIndex)) return refused(barIndex);
  }
  const result = normalisedBars(text, parsed.scoreNode, range);
  if ("refusedBar" in result) return refused(result.refusedBar);
  const { bars } = result;
  const first = pinFirstBeat(bars[0][0], durationAt(parsed.scoreNode, range.from));
  if (!first) return refused(range.from.barIndex);
  bars[0][0] = first;
  const body = bars.map((bar) => bar.join(" ")).join(" | ");
  // The copy is read back as a paste reads clipboard text, so the clip the
  // editor holds is the one its text gives anywhere: copy and paste normalise
  // and measure it the same way, and can never disagree about what it holds.
  const clip = readClip(isWholeBars(parsed.scoreNode, range) ? `${body} |` : body);
  if (!clip) return refused(range.from.barIndex);
  // Only what a beat's text says travels with it. A length set elsewhere — a
  // sticky `:8{tu 3}` before the bar makes the bare beats after it triplets —
  // would come out plain: refuse rather than change a length.
  const model: any[] = parsed.score.tracks[0].staves[0].bars;
  const here = positionsIn(parsed.scoreNode, range).map((p) => beatLength(model[p.barIndex].voices[0].beats[p.beatIndex]));
  const there = clip.lengthsByBar.flat();
  const same = there.length === here.length && there.every((length, i) => cmp(length, here[i]) === 0);
  return same ? { kind: "copied", clip } : refused(range.from.barIndex);
}

/**
 * Read pasted text as a clip, or null when it is not a passage of tab. Line
 * ends are normalised first (`\r\n` and `\r` become `\n`, as the parser reads
 * them), so a Windows clipboard's CRLF cannot shift the offsets the beats are
 * cut from. A trailing `|` marks whole bars. What is left must parse as
 * AlphaTex with at least one bar, no empty bar and no directives, as one
 * track, staff and voice, every beat one the commands read (isEditableBar). It
 * is then normalised exactly like a copy, against itself: the first beat
 * pinned with the base a standalone parse gives it (`.4` when bare), leading
 * ties made the frets they sound within the clip, legato dropped from each
 * string's last note. Every length comes from the normalised text.
 */
export function readClip(raw: string): ParsedClip | null {
  const trimmed = normalizeNewlines(raw).trim();
  const wholeBars = trimmed.endsWith("|");
  const body = (wholeBars ? trimmed.slice(0, -1) : trimmed).trim();
  if (!body) return null;
  const parsed = parseTex(body);
  const { scoreNode } = parsed;
  if (!parsed.ok || !scoreNode) return null;
  const count: number = scoreNode.bars?.length ?? 0;
  if (count === 0) return null;
  for (let barIndex = 0; barIndex < count; barIndex++) {
    const bar = scoreNode.bars[barIndex];
    const signs = bar.metaData?.length ?? 0;
    if (signs > 0 || (bar.beats?.length ?? 0) === 0 || !isEditableBar(body, parsed, barIndex)) return null;
  }
  const lastBar = scoreNode.bars[count - 1].beats.length - 1;
  const all: Range = { from: { barIndex: 0, beatIndex: 0 }, to: { barIndex: count - 1, beatIndex: lastBar } };
  const result = normalisedBars(body, scoreNode, all);
  if ("refusedBar" in result) return null;
  const beatsByBar = result.bars;
  const first = pinFirstBeat(beatsByBar[0][0], durationAt(scoreNode, all.from));
  if (!first) return null;
  beatsByBar[0][0] = first;

  const normalised = beatsByBar.map((bar) => bar.join(" ")).join(" | ");
  const check = parseTex(normalised);
  if (!check.ok || !check.score || check.scoreNode?.bars?.length !== count) return null;
  const lengthsByBar: Fraction[][] = check.score.tracks[0].staves[0].bars.map((bar: any) =>
    bar.voices[0].beats.map(beatLength),
  );
  const strings = new Set<number>();
  for (const bar of beatsByBar) for (const beat of bar) for (const note of parseBeatText(beat)!.notes) strings.add(note.string);
  return {
    text: wholeBars ? `${normalised} |` : normalised,
    wholeBars,
    bars: count,
    beats: beatsByBar.reduce((n, bar) => n + bar.length, 0),
    beatsByBar,
    lengthsByBar,
    strings: [...strings],
    lastBase: durationAt(check.scoreNode, all.to),
  };
}
