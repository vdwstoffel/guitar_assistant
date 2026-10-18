/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import { parseTex } from "../parse";
import { beatSpliceRange, countBars, countBeats, type BeatPos, type Caret } from "../locate";
import { commitEdit, refuse, type EditOutcome } from "../apply";
import { beatLength } from "../barFill";
import { isPreviewable } from "../caretBeat";
import { add, cmp, sub, ZERO, type Fraction } from "../fraction";
import { fill, lengthOf, valueOf, valueOfBeat, type NoteValue } from "../durationValues";
import { durationAt } from "../repin";
import type { ParsedClip } from "../clip";
import type { Range } from "../selection";
import {
  beatSplices, formatRests, insertBars, isEditableBar, nextBeatPos, prevBeatPos, readBar, replaceBars, type TextSplice,
} from "./barEdit";
import { isTapped, parseBeatText, type ParsedBeat } from "./beatText";
import { allStrings, applyChange, bindableStrings, isOnePart, type Change } from "./rangeEdit";

/** The music a paste wrote, from its first beat: what is selected afterwards. */
function pastedRange(start: BeatPos, clip: ParsedClip): Range {
  const last = clip.beatsByBar.length - 1;
  const to =
    last === 0
      ? { barIndex: start.barIndex, beatIndex: start.beatIndex + clip.beatsByBar[0].length - 1 }
      : { barIndex: start.barIndex + last, beatIndex: clip.beatsByBar[last].length - 1 };
  return { from: { barIndex: start.barIndex, beatIndex: start.beatIndex }, to };
}

/**
 * Whether the beats written from `start` — bar by bar, the first bar's from
 * start's beat, the others' from their first — have the lengths they were
 * written with. Their text cannot say every length: a sticky `:8{tu 3}`
 * earlier in the tab makes every later beat a triplet, whatever its own suffix.
 */
function keepsLengths(text: string, start: BeatPos, written: Fraction[][]): boolean {
  const { ok, score } = parseTex(text);
  const bars: any[] = (ok && score?.tracks?.[0]?.staves?.[0]?.bars) || [];
  return written.every((lengths, k) => {
    const beats: any[] = bars[start.barIndex + k]?.voices?.[0]?.beats ?? [];
    const from = k === 0 ? start.beatIndex : 0;
    return lengths.every((length, i) => !!beats[from + i] && cmp(beatLength(beats[from + i]), length) === 0);
  });
}

/** The clip's beats, read back from their text: readClip has read each one. */
const clipBeats = (clip: ParsedClip): ParsedBeat[] => clip.beatsByBar.flat().map((beat) => parseBeatText(beat)!);

/**
 * The strings, besides those a paste writes notes on or takes notes from,
 * whose legato it could re-bind (Change.legatoStrings, Change.hammerStrings).
 * `beats` are the beats it writes and the ones it takes out. alphaTab 1.8.1
 * binds a hammer-on to a left-hand tap on another string, so with a tap among
 * them an earlier hammer-on on any string can end up on another note: on
 * every string the hammer-on goes, while a slide, which binds on its own
 * string only, stays. And the beat a paste sets second, behind a new first
 * beat of a bar (`displaced`): the bar before bound to it, and no longer
 * does, on the strings it could bind (bindableStrings).
 *
 * A clip that `repeats` the beats right before it — duplicate's copy — has
 * no tap rule: those beats bound every hammer-on before them, or let it pass,
 * and their copy, behind them, does the same.
 */
function bindingsOf(
  score: any,
  beats: ParsedBeat[],
  displaced?: ParsedBeat,
  repeats = false,
): Pick<Change, "legatoStrings" | "hammerStrings"> {
  const pushed = displaced ? bindableStrings(displaced, score) : { legato: [], hammer: [] };
  const tapped = !repeats && beats.some(isTapped);
  return { legatoStrings: pushed.legato, hammerStrings: tapped ? allStrings(score) : pushed.hammer };
}

/**
 * Make the change, commit it, and select what was pasted, with the caret on
 * its first beat. Refused, naming the bar the paste starts in, when an edge
 * rule or the commit refuses, or when a beat written (`written`: the clip's
 * lengths, and any rests after them) would not come out at its length.
 */
function finish(
  text: string,
  scoreNode: any,
  change: Change,
  caret: Caret,
  start: BeatPos,
  clip: ParsedClip,
  expected: { bars: number; beats: number },
  written: Fraction[][] = clip.lengthsByBar,
): EditOutcome {
  const next = applyChange(text, scoreNode, change);
  const result = next && commitEdit(next, { ...caret, barIndex: start.barIndex, beatIndex: start.beatIndex }, expected);
  return result && keepsLengths(result.text, start, written)
    ? { kind: "ok", result, selection: pastedRange(start, clip) }
    : refuse(start.barIndex);
}

/**
 * The clip's bars as new bars before bar `beforeBar` — appended when it is
 * the bar count. Every string's edges are cleaned: alphaTab resolves a tie
 * only three bars back, so new bars can strand one on any string. Refused in
 * a tab of more than one track, staff or voice, whose others the new bars
 * would put out of step — saying so (`severalTracks`). A refusal names the
 * caret's bar, which for duplicate is a bar it copies, not the one the copy
 * would go in front of.
 */
export function insertClipBars(text: string, caret: Caret, beforeBar: number, clip: ParsedClip): EditOutcome {
  const parsed = parseTex(text);
  const { scoreNode, score } = parsed;
  if (!parsed.ok || !scoreNode) return refuse(caret.barIndex);
  if (!isPreviewable(score, Math.min(beforeBar, countBars(scoreNode) - 1))) {
    return refuse(caret.barIndex, isOnePart(score) ? undefined : "severalTracks");
  }
  const splice = insertBars(text, scoreNode, beforeBar, clip.beatsByBar.map((bar) => bar.join(" ")));
  if (!splice) return refuse(caret.barIndex);
  const after = nextBeatPos(scoreNode, { barIndex: beforeBar, beatIndex: -1 });
  const added = clip.beatsByBar.length;
  const change: Change = {
    splices: [splice],
    strings: allStrings(score),
    gap: { bar: beforeBar, before: prevBeatPos(scoreNode, { barIndex: beforeBar, beatIndex: 0 }), after },
    follower: after && { pos: { ...after, barIndex: after.barIndex + added }, duration: durationAt(scoreNode, after) },
  };
  const outcome = finish(text, scoreNode, change, caret, { barIndex: beforeBar, beatIndex: 0 }, clip, {
    bars: countBars(scoreNode) + added,
    beats: countBeats(scoreNode) + clip.beats,
  });
  return outcome.kind === "refused" ? refuse(caret.barIndex) : outcome;
}

/**
 * A clip of one bar's beats inside a bar: before the beat at `at`, or after
 * it. The bar grows (feature 2 colours it if it no longer adds up). Put in
 * front of a bar's first beat, the clip's first beat is the one alphaTab
 * 1.8.1 binds the bar before to: legato there on a string that beat, or the
 * one it displaces, can bind is dropped. A clip holding a left-hand tap drops
 * an earlier hammer-on on any string (bindingsOf) — unless, put `after` the
 * beats it is a copy of, it `repeats` them (duplicate).
 */
export function insertClipBeats(
  text: string,
  caret: Caret,
  at: BeatPos,
  after: boolean,
  clip: ParsedClip,
  { repeats = false }: { repeats?: boolean } = {},
): EditOutcome {
  if (clip.beatsByBar.length !== 1) return refuse(at.barIndex, "crossesBarLine");
  const parsed = parseTex(text);
  const { scoreNode, score } = parsed;
  if (!parsed.ok || !scoreNode || !isEditableBar(text, parsed, at.barIndex)) return refuse(at.barIndex);
  const range = beatSpliceRange(text, scoreNode, at);
  if (!range) return refuse(at.barIndex);
  const beats = clip.beatsByBar[0].join(" ");
  const splice: TextSplice = after
    ? { from: range.cpEnd + 1, to: range.cpEnd, text: ` ${beats}` }
    : { from: range.cpStart, to: range.cpStart - 1, text: `${beats} ` };
  const follower = after ? nextBeatPos(scoreNode, at) : { barIndex: at.barIndex, beatIndex: at.beatIndex };
  const moved =
    follower &&
    (follower.barIndex === at.barIndex ? { ...follower, beatIndex: follower.beatIndex + clip.beats } : follower);
  const displaced = !after && at.beatIndex === 0 ? readBar(text, scoreNode, at.barIndex)![0].beat! : undefined;
  const change: Change = {
    splices: [splice],
    strings: clip.strings,
    ...bindingsOf(score, clipBeats(clip), displaced, repeats && after),
    gap: { bar: at.barIndex, before: after ? at : prevBeatPos(scoreNode, at), after: follower },
    follower: moved && { pos: moved, duration: durationAt(scoreNode, follower!) },
  };
  const start = { barIndex: at.barIndex, beatIndex: at.beatIndex + (after ? 1 : 0) };
  return finish(text, scoreNode, change, caret, start, clip, {
    bars: countBars(scoreNode),
    beats: countBeats(scoreNode) + clip.beats,
  });
}

/**
 * Whole bars over the caret's bar and the ones after it, one for one; past the
 * end they are appended. A left-hand tap in the bars written, or in those
 * written over, drops an earlier hammer-on on any string (bindingsOf).
 * Refused in a tab of more than one track, staff or voice, saying so, as
 * insertClipBars is.
 */
function overwriteBars(text: string, caret: Caret, clip: ParsedClip): EditOutcome {
  const parsed = parseTex(text);
  const { scoreNode, score } = parsed;
  if (!parsed.ok || !scoreNode) return refuse(caret.barIndex);
  if (!isOnePart(score)) return refuse(caret.barIndex, "severalTracks");
  const count = countBars(scoreNode);
  const first = caret.barIndex;
  const lastReplaced = Math.min(first + clip.bars, count) - 1;
  const removed: number[] = [];
  const replaced: ParsedBeat[] = [];
  let replacedBeats = 0;
  for (let barIndex = first; barIndex <= lastReplaced; barIndex++) {
    if (!isEditableBar(text, parsed, barIndex)) return refuse(barIndex);
    for (const b of readBar(text, scoreNode, barIndex)!) {
      removed.push(...b.beat!.notes.map((note) => note.string));
      replaced.push(b.beat!);
      replacedBeats++;
    }
  }
  const splices = replaceBars(text, scoreNode, first, clip.beatsByBar.map((bar) => bar.join(" ")));
  if (!splices) return refuse(first);
  const appends = first + clip.bars > count;
  const after = nextBeatPos(scoreNode, { barIndex: lastReplaced + 1, beatIndex: -1 });
  const change: Change = {
    splices,
    strings: appends ? allStrings(score) : [...clip.strings, ...removed],
    ...bindingsOf(score, [...clipBeats(clip), ...replaced]),
    // The bars replaced: the walk back reaches from the first, the walk on from the last.
    gap: { bar: first, lastBar: lastReplaced, before: prevBeatPos(scoreNode, { barIndex: first, beatIndex: 0 }), after },
    follower: after && { pos: after, duration: durationAt(scoreNode, after) },
  };
  return finish(text, scoreNode, change, caret, { barIndex: first, beatIndex: 0 }, clip, {
    bars: Math.max(count, first + clip.bars),
    beats: countBeats(scoreNode) - replacedBeats + clip.beats,
  });
}

/** The rest values for what is left of a beat the clip only partly covers, or null when no rest says it. */
function remainderRests(remainder: Fraction, covered: any, unit: number): NoteValue[] | null {
  const own = valueOfBeat(covered);
  const single = valueOf(remainder, own.tuplet);
  if (single) return [single];
  // A tuplet beat's group is finished with its own value without the dots: a dotted triplet beat's value is as long as
  // its undotted base duration (a dotted triplet quarter lasts a plain quarter), longer than anything left of it, and
  // `fill` would find no rests. Controller ruling G03: the spec says `tuplet: that beat's value`, which refuses a dotted
  // tuplet beat; the two differ for no other beat.
  return fill(remainder, { unit, tuplet: own.tuplet !== null ? { ...own, dots: 0 } : null });
}

/**
 * One bar's beats over the same amount of time from the caret's beat: the
 * beats the clip covers go, a beat it only partly covers leaves the rest of
 * its length as rests, and the bar keeps its length. Refused when the clip is
 * longer than the time left in the bar, or when no rest can say a remainder.
 * A clip of no length (grace notes only) covers nothing: it goes in before
 * the caret's beat. A left-hand tap in the clip, or in the beats it covers,
 * drops an earlier hammer-on on any string (bindingsOf).
 */
function overwriteBeats(text: string, caret: Caret, clip: ParsedClip): EditOutcome {
  const parsed = parseTex(text);
  const { scoreNode, score } = parsed;
  const b = caret.barIndex;
  const j = caret.beatIndex;
  if (!parsed.ok || !scoreNode || !isEditableBar(text, parsed, b)) return refuse(b);
  const model: any[] = score.tracks[0].staves[0].bars[b].voices[0].beats;
  if (j >= model.length) return refuse(b);
  const lengths: Fraction[] = model.map(beatLength);
  const wanted = clip.lengthsByBar[0].reduce(add, ZERO);
  if (cmp(wanted, lengths.slice(j).reduce(add, ZERO)) > 0) return refuse(b, "doesNotFit");

  let time = ZERO;
  let last = j - 1;
  let remainder = ZERO;
  for (let i = j; i < model.length && cmp(time, wanted) < 0; i++) {
    const end = add(time, lengths[i]);
    last = i;
    if (cmp(end, wanted) > 0) remainder = sub(end, wanted);
    time = end;
  }
  const values = cmp(remainder, ZERO) > 0 ? remainderRests(remainder, model[last], score.masterBars[b].timeSignatureDenominator) : [];
  if (!values) return refuse(b, "remainderInexpressible");
  const rests = formatRests(values, clip.lastBase);

  const bar = readBar(text, scoreNode, b)!;
  let splices: TextSplice[] | null;
  if (last >= j) {
    splices = beatSplices(text, scoreNode, [{ barIndex: b, first: j, last, beats: [...clip.beatsByBar[0], ...rests] }]);
  } else {
    const at = bar[j].range.cpStart;
    splices = [{ from: at, to: at - 1, text: `${clip.beatsByBar[0].join(" ")} ` }];
  }
  if (!splices) return refuse(b);
  const covered = bar.slice(j, last + 1).map((beat) => beat.beat!);
  const removed = covered.flatMap((beat) => beat.notes.map((note) => note.string));
  const after = last >= j ? nextBeatPos(scoreNode, { barIndex: b, beatIndex: last }) : { barIndex: b, beatIndex: j };
  const shift = clip.beats + rests.length - (last - j + 1);
  const moved = after && (after.barIndex === b ? { ...after, beatIndex: after.beatIndex + shift } : after);
  const change: Change = {
    splices,
    strings: [...clip.strings, ...removed],
    // Grace notes put in front of a bar's first beat take its place as the
    // beat alphaTab 1.8.1 binds the bar before to (insertClipBeats).
    ...bindingsOf(score, [...clipBeats(clip), ...covered], last < j && j === 0 ? bar[0].beat! : undefined),
    gap: { bar: b, before: prevBeatPos(scoreNode, { barIndex: b, beatIndex: j }), after },
    follower: moved && { pos: moved, duration: durationAt(scoreNode, after!) },
  };
  return finish(
    text,
    scoreNode,
    change,
    caret,
    { barIndex: b, beatIndex: j },
    clip,
    { bars: countBars(scoreNode), beats: countBeats(scoreNode) + shift },
    [[...clip.lengthsByBar[0], ...values.map(lengthOf)]],
  );
}

/**
 * Ctrl+V: paste over what is there, from the caret. Whole bars with the
 * caret on a bar's first beat replace that many bars; a single whole bar
 * elsewhere pastes as beats; several are refused there. Beats overwrite the
 * same amount of time from the caret (overwriteBeats). Beats across a bar
 * line are refused: they paste only with Ctrl+Shift+V at a bar's first beat.
 */
export function pasteOverwrite(text: string, caret: Caret, clip: ParsedClip): EditOutcome {
  if (clip.wholeBars && caret.beatIndex === 0) return overwriteBars(text, caret, clip);
  if (clip.wholeBars && clip.bars > 1) return refuse(caret.barIndex, "needsBarStart");
  if (clip.bars > 1) return refuse(caret.barIndex, "crossesBarLine");
  return overwriteBeats(text, caret, clip);
}

/**
 * Ctrl+Shift+V: paste in front of what is there. Whole bars — or beats
 * across bar lines with the caret on a bar's first beat — go in as new bars
 * before the caret's bar; beats go in before the caret's beat.
 */
export function pasteInsert(text: string, caret: Caret, clip: ParsedClip): EditOutcome {
  if (clip.wholeBars || (clip.bars > 1 && caret.beatIndex === 0)) {
    return insertClipBars(text, caret, caret.barIndex, clip);
  }
  if (clip.bars > 1) return refuse(caret.barIndex, "crossesBarLine");
  return insertClipBeats(text, caret, caret, false, clip);
}
