/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import { type ParseResult } from "../parse";
import { codepointToUtf16, sliceCp } from "../offsets";
import { beatSpliceRange, type BeatPos, type SpliceRange } from "../locate";
import { isPreviewable } from "../caretBeat";
import { type NoteValue } from "../durationValues";
import { formatBeat, formatEffects, parseBeatText, tokensOf, type ParsedBeat } from "./beatText";

/** One beat of a bar as the text has it. */
export interface BarBeat {
  pos: BeatPos;
  range: SpliceRange;
  /** The beat's source, exactly as written. */
  source: string;
  /** null when parseBeatText cannot read it. */
  beat: ParsedBeat | null;
}

/** Every beat of a bar, read from one parse; null for a bar that is not there. */
export function readBar(text: string, scoreNode: any, barIndex: number): BarBeat[] | null {
  const count: number | undefined = scoreNode?.bars?.[barIndex]?.beats?.length;
  if (count === undefined) return null;
  const out: BarBeat[] = [];
  for (let beatIndex = 0; beatIndex < count; beatIndex++) {
    const pos = { barIndex, beatIndex };
    const range = beatSpliceRange(text, scoreNode, pos);
    if (!range) return null;
    const source = sliceCp(text, range.cpStart, range.cpEnd);
    out.push({ pos, range, source, beat: parseBeatText(source) });
  }
  return out;
}

/**
 * Whether a note's effect block marks it a tie, `{t}` or a bare `-` among the
 * effects (`{-}`, `{- h}`). alphaTab makes such a note a tie destination that
 * sounds its origin's fret, and ignores the case of the property (`{T}`);
 * parseBeatText reads the note as a plain fret. Quoted strings and argument
 * lists are blanked out first: a `t` or `-` inside them is a chord name or a
 * text (`{ch "t"}`), not a tie, and a tie may carry an empty argument list or
 * follow another property's (`{t()}`, `{-()}`, `{b (0 4)-}`).
 */
export function isMarkedTie(effects: string): boolean {
  const bare = effects.replace(/"[^"]*"|'[^']*'/g, " ").replace(/\([^)]*\)/g, " ");
  return tokensOf(bare.toLowerCase()).includes("t") || /[{\s]-[\s}]/.test(bare);
}

/** An effect block's content as written, braces off and runs of space collapsed: what its tokens must add up to. */
const inner = (effects: string): string => effects.replace(/^\{|\}$/g, "").trim().replace(/\s+/g, " ");

/**
 * Whether tokensOf reads an effect block back as written, so a command may
 * rewrite it token by token. Not for a quoted argument (`{txt "a b"}`), an
 * upper-case property (`{PM}`) or anything else tokensOf would drop or split.
 */
export const readsBack = (effects: string): boolean => effects === "" || tokensOf(effects).join(" ") === inner(effects);

/**
 * What the commands would misread or mangle: a marked tie and a `{tu 3 2}`
 * ratio (alphaTab reads them differently from parseBeatText), and any effect
 * block tokensOf cannot read back as written — a quoted argument such as
 * `{ch "Am"}` or `{ch 'Am'}`, an unquoted one like `{ch Am}`, an upper-case
 * property name (`{TU 3 2}`; alphaTab ignores case, tokensOf sees `[a-z]+`).
 * Exported for repinAt, whose target beat may sit in a bar isEditableBar never
 * checked.
 */
export function misreads(beat: ParsedBeat): boolean {
  return [beat.effects, ...beat.notes.map((note) => note.effects)].some(
    (effects) =>
      isMarkedTie(effects) ||
      tokensOf(effects).some((token) => /^tu\s+\d+\s+\d+/.test(token)) ||
      /["']/.test(effects) ||
      !readsBack(effects),
  );
}

/**
 * Whether a command may rewrite this bar: one track, staff and voice (the
 * editor writes nothing else); as many beats in the text as in alphaTab's
 * model (`*4` and `\voice` break that); and every beat one parseBeatText reads
 * the way alphaTab does, with effect blocks tokensOf reads back as written
 * (not `:8 3.6`, `x.6`, `{tu 3 2}`, `{t}`, `{-}` or `{ch Am}`).
 */
export function isEditableBar(text: string, parsed: ParseResult, barIndex: number): boolean {
  if (!parsed.ok || !parsed.scoreNode || !isPreviewable(parsed.score, barIndex)) return false;
  const beats = readBar(text, parsed.scoreNode, barIndex);
  const model: any[] = parsed.score.tracks[0].staves[0].bars[barIndex].voices[0].beats;
  return !!beats && beats.length === model.length && beats.every((b) => b.beat !== null && !misreads(b.beat));
}

/** Replace beats `first`..`last` (inclusive) of one bar with `beats` — none deletes them. */
export interface BeatSplice {
  barIndex: number;
  first: number;
  last: number;
  beats: string[];
}

/**
 * A replacement of an inclusive codepoint range of a text. `to` one below
 * `from` replaces nothing: the text is inserted at `from`.
 */
export interface TextSplice {
  from: number;
  to: number;
  text: string;
}

/**
 * Apply splices worked out against one text, in one pass. Null when two
 * overlap, or when one ends more than one before it starts — neither a range
 * nor an insertion. An insertion at the very start of a replaced range lands
 * before the replacement.
 */
export function applySplices(text: string, splices: TextSplice[]): string | null {
  if (splices.some((s) => s.to < s.from - 1)) return null;
  const sorted = [...splices].sort((a, b) => a.from - b.from || a.to - b.to);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].from <= sorted[i - 1].to) return null;
  }
  const index = (cp: number) => codepointToUtf16(text, cp);
  let out = "";
  let cursor = 0;
  for (const s of sorted) {
    out += text.slice(cursor, index(s.from)) + s.text;
    cursor = index(s.to + 1);
  }
  return out + text.slice(cursor);
}

/**
 * The text splices for beat splices worked out against one parse. A deletion
 * takes one separator with it — the one before the next beat in the bar, or
 * failing that the one after the previous beat — like deleteBeat; replacement
 * beats are joined by single spaces. Null when a splice names a beat that is
 * not there or would empty its bar. A bar line butted against the last beat
 * (`5.6|`) stays: beatSpliceRange leaves it out of the beat's range.
 */
export function beatSplices(text: string, scoreNode: any, splices: BeatSplice[]): TextSplice[] | null {
  const out: TextSplice[] = [];
  for (const s of splices) {
    const count: number = scoreNode?.bars?.[s.barIndex]?.beats?.length ?? 0;
    if (s.first < 0 || s.last < s.first || s.last >= count) return null;
    const at = (beatIndex: number) => beatSpliceRange(text, scoreNode, { barIndex: s.barIndex, beatIndex })!;
    if (s.beats.length > 0) {
      out.push({ from: at(s.first).cpStart, to: at(s.last).cpEnd, text: s.beats.join(" ") });
    } else if (s.last + 1 < count) {
      out.push({ from: at(s.first).cpStart, to: at(s.last + 1).cpStart - 1, text: "" });
    } else if (s.first > 0) {
      out.push({ from: at(s.first - 1).cpEnd + 1, to: at(s.last).cpEnd, text: "" });
    } else {
      return null;
    }
  }
  return out;
}

/**
 * Apply beat splices worked out against one parse (beatSplices), in one pass.
 * Null when a splice names a beat that is not there, would empty its bar, or
 * overlaps another.
 */
export function spliceBeats(text: string, scoreNode: any, splices: BeatSplice[]): string | null {
  const ranges = beatSplices(text, scoreNode, splices);
  return ranges && applySplices(text, ranges);
}

/** Single-beat rewrites gathered before splicing, keyed by editKey. */
export type EditSet = Map<string, { pos: BeatPos; beat: ParsedBeat }>;

export const editKey = (pos: BeatPos): string => `${pos.barIndex}:${pos.beatIndex}`;

export const splicesOf = (edits: EditSet): BeatSplice[] =>
  [...edits.values()].map(({ pos, beat }) => ({
    barIndex: pos.barIndex,
    first: pos.beatIndex,
    last: pos.beatIndex,
    beats: [formatBeat(beat)],
  }));

/**
 * Rests for these values, written after a beat whose duration is `inForce`:
 * a plain rest of the duration in force is bare and inherits it; a dotted or
 * tuplet rest always carries its duration — `r.8{tu 3}`, as toggleTuplet
 * writes its notes.
 */
export function formatRests(values: NoteValue[], inForce: number): string[] {
  let current = inForce;
  return values.map((value) => {
    const marks = [
      ...(value.dots === 1 ? ["d"] : value.dots === 2 ? ["dd"] : []),
      ...(value.tuplet !== null ? [`tu ${value.tuplet}`] : []),
    ];
    const suffix = marks.length > 0 || value.duration !== current ? `.${value.duration}` : "";
    current = value.duration;
    return `r${suffix}${formatEffects(marks)}`;
  });
}

/**
 * How many bars apart alphaTab 1.8.1 binds notes: a tie to its origin at most
 * this many bars back, a hammer-on or slide to its target at most this many
 * bars on (`Note._maxOffsetForSameLineSearch`, alphaTab.core.mjs:6581, pinned
 * in alphaTabInternals.test.ts). The tie and legato walks stop here: beyond it
 * nothing can bind across the beats a command silences, so nothing there needs
 * rewriting, or can stop the command. (In 1.8.1 a hammer-on or slide reaches
 * less far still — no further than the next bar's first beat, since later bars
 * are not yet chained when a note is finished — so this bound is the safe one.)
 */
export const BINDING_REACH_BARS = 3;

/** The beat after `pos` in reading order, across bar lines and past empty bars; null at the end. */
export function nextBeatPos(scoreNode: any, pos: BeatPos): BeatPos | null {
  const bars: any[] = scoreNode?.bars ?? [];
  if (pos.beatIndex + 1 < (bars[pos.barIndex]?.beats?.length ?? 0)) {
    return { barIndex: pos.barIndex, beatIndex: pos.beatIndex + 1 };
  }
  for (let barIndex = pos.barIndex + 1; barIndex < bars.length; barIndex++) {
    if ((bars[barIndex]?.beats?.length ?? 0) > 0) return { barIndex, beatIndex: 0 };
  }
  return null;
}

/** The beat before `pos` in reading order, across bar lines and past empty bars; null at the start. */
export function prevBeatPos(scoreNode: any, pos: BeatPos): BeatPos | null {
  const bars: any[] = scoreNode?.bars ?? [];
  if (pos.beatIndex > 0) return { barIndex: pos.barIndex, beatIndex: pos.beatIndex - 1 };
  for (let barIndex = pos.barIndex - 1; barIndex >= 0; barIndex--) {
    const count: number = bars[barIndex]?.beats?.length ?? 0;
    if (count > 0) return { barIndex, beatIndex: count - 1 };
  }
  return null;
}

/**
 * The codepoint offset of the score's structural `.` — the first one before
 * bar 0's first beat that is not inside a directive (`\tempo 90.5`, a quoted
 * title) or a comment — or null when the document has none.
 */
export function headerDot(text: string, scoreNode: any): number | null {
  const bar0 = scoreNode?.bars?.[0];
  if (!bar0) return null;
  const limit: number = bar0.beats?.[0]?.start?.offset ?? bar0.end?.offset + 1;
  const directives: Array<[number, number]> = (bar0.metaData ?? []).map((m: any) => [m.start.offset, m.end.offset]);
  const cps = Array.from(sliceCp(text, 0, limit - 1));
  for (let i = 0; i < cps.length; i++) {
    const inside = directives.find(([from, to]) => i >= from && i <= to);
    if (inside) {
      i = inside[1];
    } else if (cps[i] === "/" && cps[i + 1] === "/") {
      while (i < cps.length && cps[i] !== "\n") i++;
    } else if (cps[i] === "/" && cps[i + 1] === "*") {
      i += 2;
      while (i < cps.length && !(cps[i] === "*" && cps[i + 1] === "/")) i++;
      i++;
    } else if (cps[i] === ".") {
      return i;
    }
  }
  return null;
}

/**
 * Whether a bar carries a directive of its own — a repeat sign, a tempo or
 * time-signature change, a section name, anything written in the bar rather
 * than in the score's header (before the structural `.`).
 */
export function hasBarDirectives(text: string, scoreNode: any, barIndex: number): boolean {
  const metaData: any[] = scoreNode?.bars?.[barIndex]?.metaData ?? [];
  if (barIndex > 0) return metaData.length > 0;
  const dot = headerDot(text, scoreNode);
  return metaData.some((m) => dot === null || m.start.offset > dot);
}

/**
 * New bars — one string of beats each — before bar `beforeBar`, as one
 * splice. They go in front of that bar's directives, so its `\ro`, `\ts` or
 * `\section` stays on it. Before bar 0, whose node also holds the header,
 * they go on a line of their own right after the structural `.` (at the bar's
 * start only when there is none), so a `\ts` written after the `.` stays with
 * the bar too. `beforeBar` equal to the bar count appends — with a space
 * after, when a comment is written straight after the last beat or bar line
 * (`r// end`), so it is not butted against the new bars. Null for no bars, a
 * bar that is not there, or a last bar with no beats to append after.
 */
export function insertBars(text: string, scoreNode: any, beforeBar: number, bars: string[]): TextSplice | null {
  const nodes: any[] = scoreNode?.bars ?? [];
  if (bars.length === 0 || beforeBar < 0 || beforeBar > nodes.length) return null;
  const joined = bars.join(" | ");
  if (beforeBar === nodes.length) {
    const append = (at: number, lead: string): TextSplice => {
      const next = sliceCp(text, at, at);
      return { from: at, to: at - 1, text: `${lead}${joined}${next === "" || /\s/.test(next) ? "" : " "}` };
    };
    const last = nodes[nodes.length - 1];
    if (last?.pipe) return append(last.pipe.start.offset + 1, " ");
    const lastBeat = last?.beats?.length
      ? beatSpliceRange(text, scoreNode, { barIndex: nodes.length - 1, beatIndex: last.beats.length - 1 })
      : null;
    return lastBeat && append(lastBeat.cpEnd + 1, " | ");
  }
  if (beforeBar === 0) {
    const dot = headerDot(text, scoreNode);
    if (dot !== null) return { from: dot + 1, to: dot, text: `\n${joined} |` };
  }
  const at: number = nodes[beforeBar].start.offset;
  return { from: at, to: at - 1, text: `${joined} | ` };
}

/**
 * Splices that give bars `fromBar` onwards new beats — one string of beats
 * per bar — each replacing a bar's beats from its first to its last, so the
 * bar's directives stay where they were; bars past the end of the score are
 * appended. Null when `fromBar` is not a bar of the score (or the next one, to
 * append from), or when a bar to replace has no beats.
 */
export function replaceBars(text: string, scoreNode: any, fromBar: number, bars: string[]): TextSplice[] | null {
  const count: number = scoreNode?.bars?.length ?? 0;
  if (fromBar < 0 || fromBar > count) return null;
  const out: TextSplice[] = [];
  for (let k = 0; k < bars.length; k++) {
    const barIndex = fromBar + k;
    if (barIndex >= count) {
      const appended = insertBars(text, scoreNode, count, bars.slice(k));
      if (!appended) return null;
      out.push(appended);
      break;
    }
    const beats: number = scoreNode.bars[barIndex].beats?.length ?? 0;
    if (beats === 0) return null;
    const first = beatSpliceRange(text, scoreNode, { barIndex, beatIndex: 0 })!;
    const last = beatSpliceRange(text, scoreNode, { barIndex, beatIndex: beats - 1 })!;
    out.push({ from: first.cpStart, to: last.cpEnd, text: bars[k] });
  }
  return out;
}

/**
 * The splice that removes bars `fromBar`..`toBar`, with one separator, at bar
 * level: from the first removed bar's start (bar 0's first beat, below the
 * header) to the next bar's start, or — when the last bar goes — from the end
 * of the bar before. As when deleteBar removes a bar, the next bar's own
 * directives stay on it. A removed bar's own would not stay: deleteBar leaves
 * them for the bar that follows, here they go with the bar (bar 0's, written
 * below the `.`, stay and land on the next) — so the caller refuses bars that
 * carry any (hasBarDirectives). Null when every bar would go, or a neighbour
 * has no beats to measure from.
 */
export function removeBars(text: string, scoreNode: any, fromBar: number, toBar: number): TextSplice | null {
  const nodes: any[] = scoreNode?.bars ?? [];
  if (fromBar < 0 || toBar < fromBar || toBar >= nodes.length || (fromBar === 0 && toBar === nodes.length - 1)) {
    return null;
  }
  if (toBar < nodes.length - 1) {
    const from: number | undefined = fromBar === 0 ? nodes[0].beats?.[0]?.start?.offset : nodes[fromBar].start.offset;
    return from === undefined ? null : { from, to: nodes[toBar + 1].start.offset - 1, text: "" };
  }
  const prevBeats: number = nodes[fromBar - 1].beats?.length ?? 0;
  const lastBeats: number = nodes[toBar].beats?.length ?? 0;
  if (prevBeats === 0 || lastBeats === 0) return null;
  const prev = beatSpliceRange(text, scoreNode, { barIndex: fromBar - 1, beatIndex: prevBeats - 1 })!;
  const last = beatSpliceRange(text, scoreNode, { barIndex: toBar, beatIndex: lastBeats - 1 })!;
  return { from: prev.cpEnd + 1, to: last.cpEnd, text: "" };
}
