/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import { parseTex, type ParseResult } from "../parse";
import { countBars, countBeats, type BeatPos, type Caret } from "../locate";
import { commitEdit, refuse, type EditOutcome, type Refused } from "../apply";
import { isPreviewable } from "../caretBeat";
import { durationAt, repinAt } from "../repin";
import { isWholeBars, positionsIn, stillValid, type Range } from "../selection";
import { isTapped, type ParsedBeat } from "./beatText";
import {
  applySplices, beatSplices, editKey, hasBarDirectives, isEditableBar, nextBeatPos, prevBeatPos, readBar, removeBars,
  spliceBeats, splicesOf, type BeatSplice, type EditSet, type TextSplice,
} from "./barEdit";
import { asRest, HAMMER_ON, unbindStrings, type Gap } from "./rest";

/**
 * A change worked out against one parse, and the edge rules around it: the
 * strings whose ties and legato it could re-bind, the gap it leaves or fills
 * (the beats on either side of it in the unedited text, and the bars it
 * spans, which bound the walks), and the first beat after it — where it sits
 * once the change is made, and the duration it had.
 */
export interface Change {
  splices: TextSplice[];
  strings: number[];
  /**
   * More strings whose legato alone it could re-bind: the nearest earlier note
   * on each loses its hammer-on and slides. alphaTab 1.8.1 binds a hammer-on or
   * slide no further than the next bar's first beat, whatever is on it, so a
   * change that puts another beat first in a bar, or takes one from first
   * place, can bind a note before it on the strings that beat plays
   * (bindableStrings) — while a tie after it on a string the change left alone
   * still holds what it held.
   */
  legatoStrings?: number[];
  /**
   * Strings where only a hammer-on could re-bind: the nearest earlier note on
   * each loses `{h}` and keeps its slides. A hammer-on binds to a left-hand tap
   * on another string, a slide never does, so a tapped beat that comes first
   * in a bar (removeRange, bindableStrings), or one a paste writes or takes
   * out (paste.ts), brings in every string this way.
   *
   * Not every change that takes out a tapped beat widens so. Delete over a
   * selection (clearRange), Shift+Delete over beats away from a bar's first
   * (removeRange) and `r` (rest.ts) look back only on the strings of the notes
   * they remove: a hammer-on bound across strings to a tap one of them takes
   * out can then bind to a later note on its own string. A known gap, older
   * than these commands.
   */
  hammerStrings?: number[];
  gap: Gap;
  follower: { pos: BeatPos; duration: number } | null;
}

/**
 * Whether the tab is one track, one staff and one voice in every bar. The
 * text's bars are every track's, staff's and voice's in turn, so bars added
 * to or taken from any other tab would put the rest out of step.
 */
export function isOnePart(score: any): boolean {
  const staves: any[] | undefined = score?.tracks?.length === 1 ? score.tracks[0].staves : undefined;
  return staves?.length === 1 && (staves[0].bars ?? []).every((bar: any) => bar.voices?.length === 1);
}

/** Every string of the staff the editor writes: what a change that adds or removes bars touches. */
export function allStrings(score: any): number[] {
  const count: number = score?.tracks?.[0]?.staves?.[0]?.tuning?.length || 6;
  return Array.from({ length: count }, (_, i) => i + 1);
}

/**
 * The text with `change` made and its edges cleaned, from one parse: walking
 * out from the gap, the nearest earlier note on each touched string (and on
 * each of `legatoStrings`) loses its hammer-on or slide — on each of
 * `hammerStrings`, its hammer-on alone — and the first later one on each
 * touched string, if a tie, becomes the fret it sounded before the change
 * (feature 2's unbindStrings) — the open string when alphaTab bound it to
 * nothing, since bars removed or notes written could now give it something to
 * bind to; then the follower gets back the duration it had (repinAt). Null
 * when an unreadable beat or a marked tie stops a walk, a splice fails, or the
 * follower cannot be re-pinned — never a silent re-bind.
 */
export function applyChange(text: string, scoreNode: any, change: Change): string | null {
  const edits: EditSet = new Map();
  const gap: Gap = { ...change.gap, pinOrphanTies: true };
  if (!unbindStrings(text, scoreNode, change.strings, gap, edits)) return null;
  // With nothing after the gap to walk on to, only the walk back runs.
  const back: Gap = { ...gap, after: null };
  const legato = change.legatoStrings ?? [];
  if (legato.length > 0 && !unbindStrings(text, scoreNode, legato, back, edits)) return null;
  const hammer = change.hammerStrings ?? [];
  if (hammer.length > 0 && !unbindStrings(text, scoreNode, hammer, back, edits, HAMMER_ON)) return null;
  const edges = beatSplices(text, scoreNode, splicesOf(edits));
  const next = edges && applySplices(text, [...change.splices, ...edges]);
  if (next === null || !change.follower) return next;
  return repinAt(next, change.follower.pos, change.follower.duration);
}

/** The gap a range leaves: the bars it spans, and the beats either side of it. */
function gapOf(scoreNode: any, range: Range): Gap {
  return {
    bar: range.from.barIndex,
    firstBar: range.from.barIndex,
    lastBar: range.to.barIndex,
    before: prevBeatPos(scoreNode, range.from),
    after: nextBeatPos(scoreNode, range.to),
  };
}

/** Each bar of the range read from one parse, or the first one the commands cannot read. */
function readRange(text: string, parsed: ParseResult, range: Range): Map<number, ParsedBeat[]> | Refused {
  const bars = new Map<number, ParsedBeat[]>();
  for (let barIndex = range.from.barIndex; barIndex <= range.to.barIndex; barIndex++) {
    if (!isEditableBar(text, parsed, barIndex)) return refuse(barIndex);
    bars.set(barIndex, readBar(text, parsed.scoreNode, barIndex)!.map((b) => b.beat!));
  }
  return bars;
}

/**
 * Delete over a selection: every selected beat becomes a rest of the same
 * length — markers kept, as `r` does (asRest) — from one parse, one unbinding
 * over the union of the cleared notes' strings, and one splice. The caret and
 * the selection stay. A selection of rests changes nothing.
 *
 * Unlike `r`, a tie after the selection that held only ties alphaTab bound to
 * nothing is unbound too, as the open string it sounded: left a tie, it would
 * reach past the new rests to an older one and hold it across them.
 */
export function clearRange(text: string, caret: Caret, range: Range): EditOutcome {
  const parsed = parseTex(text);
  const { scoreNode } = parsed;
  if (!parsed.ok || !scoreNode || !stillValid(scoreNode, range)) return refuse(range.from.barIndex);
  const bars = readRange(text, parsed, range);
  if (!(bars instanceof Map)) return bars;

  const edits: EditSet = new Map();
  const strings: number[] = [];
  for (const pos of positionsIn(scoreNode, range)) {
    const beat = bars.get(pos.barIndex)![pos.beatIndex];
    if (beat.notes.length === 0) continue;
    strings.push(...beat.notes.map((note) => note.string));
    edits.set(editKey(pos), { pos, beat: asRest(beat) });
  }
  if (edits.size === 0) return { kind: "noop", reason: "alreadyRest" };
  const gap: Gap = { ...gapOf(scoreNode, range), pinOrphanTies: true };
  if (!unbindStrings(text, scoreNode, strings, gap, edits)) return refuse(range.from.barIndex);
  const next = spliceBeats(text, scoreNode, splicesOf(edits));
  const result = next && commitEdit(next, caret, { bars: countBars(scoreNode), beats: countBeats(scoreNode) });
  return result ? { kind: "ok", result } : refuse(range.from.barIndex);
}

/**
 * The strings whose legato a beat can take on once it is first in its bar, or
 * give up once it is not, as Change names them: `legato`, those it plays,
 * alphaTab 1.8.1 binding a hammer-on or slide to the note on its own string;
 * and `hammer`, every string when it holds a left-hand tap (`{lht}`,
 * isTapped), which a hammer-on binds to from another string too — a slide
 * never does. Shared with paste, for the beat it sets second behind a new
 * first beat of a bar.
 */
export function bindableStrings(beat: ParsedBeat, score: any): { legato: number[]; hammer: number[] } {
  return { legato: beat.notes.map((note) => note.string), hammer: isTapped(beat) ? allStrings(score) : [] };
}

/**
 * Whether a bar outside the range's bars has beats. The text can have bars
 * with none — a `|` with nothing after it, or before the first beat. alphaTab
 * drops an empty bar at the end and keeps one at the start or between bars as
 * a single empty beat, so counting bars would let the last of the music go.
 */
function leavesMusic(scoreNode: any, { from, to }: Range): boolean {
  const bars: any[] = scoreNode?.bars ?? [];
  const outside = (barIndex: number) => barIndex < from.barIndex || barIndex > to.barIndex;
  return bars.some((bar, barIndex) => outside(barIndex) && (bar.beats?.length ?? 0) > 0);
}

/**
 * Shift+Delete over a selection. Whole bars go as bars, cut at bar level so
 * the bars around them keep their directives, and unread, as − Bar deletes a
 * bar — refused in a tab of more than one track, staff or voice, when one of
 * them carries a directive of its own (a repeat sign, tempo, time signature
 * or section would move or vanish), or when they are all the bars that have
 * beats. Otherwise the selected beats go, refused when a bar would be left
 * empty or cannot be read. Either way the edges are cleaned (applyChange: the
 * removed notes' strings, every string when bars go — and the legato of the
 * strings the beat that comes first plays when a bar's first beat goes, and
 * on every string the hammer-ons, when that beat holds a left-hand tap) and
 * the caret lands on the first beat after the range, else the last one before
 * it.
 */
export function removeRange(text: string, caret: Caret, range: Range): EditOutcome {
  const parsed = parseTex(text);
  const { scoreNode, score } = parsed;
  if (!parsed.ok || !scoreNode || !stillValid(scoreNode, range)) return refuse(range.from.barIndex);
  const { from, to } = range;
  const count = countBars(scoreNode);
  const gap = gapOf(scoreNode, range);
  const { before, after } = gap;

  if (isWholeBars(scoreNode, range)) {
    // The text's bars are every track's, staff's and voice's in turn: one going would leave the others out of step.
    if (!isPreviewable(score, from.barIndex)) return refuse(from.barIndex, "severalTracks");
    if (!leavesMusic(scoreNode, range)) return refuse(from.barIndex, "wouldRemoveAll");
    for (let barIndex = from.barIndex; barIndex <= to.barIndex; barIndex++) {
      if (hasBarDirectives(text, scoreNode, barIndex)) return refuse(barIndex, "barsCarrySigns");
    }
    const cut = removeBars(text, scoreNode, from.barIndex, to.barIndex);
    if (!cut) return refuse(from.barIndex);
    const removed = to.barIndex - from.barIndex + 1;
    const moved = after && { barIndex: after.barIndex - removed, beatIndex: after.beatIndex };
    const next = applyChange(text, scoreNode, {
      splices: [cut],
      strings: allStrings(score),
      gap,
      follower: moved && { pos: moved, duration: durationAt(scoreNode, after!) },
    });
    const landing = moved ?? before!;
    const result =
      next &&
      commitEdit(next, { ...caret, ...landing }, {
        bars: count - removed,
        beats: countBeats(scoreNode) - positionsIn(scoreNode, range).length,
      });
    return result ? { kind: "ok", result } : refuse(from.barIndex);
  }

  const bars = readRange(text, parsed, range);
  if (!(bars instanceof Map)) return bars;
  const splices: BeatSplice[] = [];
  const strings: number[] = [];
  for (const [barIndex, beats] of bars) {
    const first = barIndex === from.barIndex ? from.beatIndex : 0;
    const last = barIndex === to.barIndex ? to.beatIndex : beats.length - 1;
    if (first === 0 && last === beats.length - 1) return refuse(barIndex, "wouldEmptyBar");
    splices.push({ barIndex, first, last, beats: [] });
    for (const beat of beats.slice(first, last + 1)) strings.push(...beat.notes.map((note) => note.string));
  }
  const cut = beatSplices(text, scoreNode, splices);
  // A bar's first beat going puts the next one first (read above, with its bar): legato before it could bind to that.
  const firsts = splices.flatMap((s) => (s.first === 0 ? [bindableStrings(bars.get(s.barIndex)![s.last + 1], score)] : []));
  const legatoStrings = firsts.flatMap((f) => f.legato);
  const hammerStrings = firsts.flatMap((f) => f.hammer);
  // The follower moves up by however many beats went from its own bar.
  const gone = to.beatIndex - (from.barIndex === to.barIndex ? from.beatIndex : 0) + 1;
  const moved = after && (after.barIndex === to.barIndex ? { ...after, beatIndex: after.beatIndex - gone } : after);
  const next =
    cut &&
    applyChange(text, scoreNode, {
      splices: cut,
      strings,
      legatoStrings,
      hammerStrings,
      gap,
      follower: moved && { pos: moved, duration: durationAt(scoreNode, after!) },
    });
  const landing = moved ?? before!;
  const result =
    next &&
    commitEdit(next, { ...caret, ...landing }, {
      bars: count,
      beats: countBeats(scoreNode) - positionsIn(scoreNode, range).length,
    });
  return result ? { kind: "ok", result } : refuse(from.barIndex);
}
