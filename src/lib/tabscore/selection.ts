/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import type { BeatPos, Caret } from "./locate";
import { nextBeatPos, prevBeatPos } from "./commands/barEdit";

/**
 * A run of whole beats — every string — in reading order, both ends
 * included, possibly across bar lines. Stored as positions, never as
 * alphaTab Beats: every edit renders a fresh Score.
 */
export interface Range {
  from: BeatPos;
  to: BeatPos;
}

/** How much a range holds: whole bars or beats, and how many of each. */
export interface RangeSize {
  wholeBars: boolean;
  bars: number;
  beats: number;
}

const pos = (p: BeatPos): BeatPos => ({ barIndex: p.barIndex, beatIndex: p.beatIndex });
const beatCount = (scoreNode: any, barIndex: number): number => scoreNode?.bars?.[barIndex]?.beats?.length ?? 0;

/** Reading order: below zero when `a` comes first. */
export function comparePos(a: BeatPos, b: BeatPos): number {
  return a.barIndex - b.barIndex || a.beatIndex - b.beatIndex;
}

/** The range from the anchor to the caret (the head), in either direction. Strings are dropped. */
export function rangeOf(anchor: BeatPos, head: BeatPos): Range {
  return comparePos(anchor, head) <= 0 ? { from: pos(anchor), to: pos(head) } : { from: pos(head), to: pos(anchor) };
}

/**
 * Whether the range starts on a bar's first beat and ends on a bar's last
 * beat. Never for a range that is not stillValid, whatever its ends say.
 */
export function isWholeBars(scoreNode: any, range: Range): boolean {
  return (
    stillValid(scoreNode, range) &&
    range.from.beatIndex === 0 &&
    range.to.beatIndex === beatCount(scoreNode, range.to.barIndex) - 1
  );
}

/** Shift+←/→: the caret one beat on, across bar lines. At either end of the score it stays put. */
export function extendByBeat(scoreNode: any, head: Caret, delta: 1 | -1): Caret {
  const next = delta === 1 ? nextBeatPos(scoreNode, head) : prevBeatPos(scoreNode, head);
  return next ? { ...head, barIndex: next.barIndex, beatIndex: next.beatIndex } : head;
}

/**
 * Ctrl+Shift+→: the caret to its bar's last beat, or — already there — to
 * the next bar's last beat. ← mirrors it onto first beats. At either end of
 * the score it stays put.
 */
export function extendToBarEdge(scoreNode: any, head: Caret, delta: 1 | -1): Caret {
  if (delta === 1) {
    const last = beatCount(scoreNode, head.barIndex) - 1;
    if (head.beatIndex < last) return { ...head, beatIndex: last };
    const next = nextBeatPos(scoreNode, head);
    return next ? { ...head, barIndex: next.barIndex, beatIndex: beatCount(scoreNode, next.barIndex) - 1 } : head;
  }
  if (head.beatIndex > 0) return { ...head, beatIndex: 0 };
  const prev = prevBeatPos(scoreNode, head);
  return prev ? { ...head, barIndex: prev.barIndex, beatIndex: 0 } : head;
}

/**
 * Ctrl+A: the score's first beat to its last; null for a score with no beats.
 * Found by stepping from two sentinels just outside the score — one beat
 * before bar 0's first (`beatIndex: -1`), and a bar past the last one — so
 * nextBeatPos and prevBeatPos skip empty bars at either end, as they do
 * anywhere, and return null when no bar has a beat.
 */
export function selectAll(scoreNode: any): Range | null {
  const first = nextBeatPos(scoreNode, { barIndex: 0, beatIndex: -1 });
  const last = prevBeatPos(scoreNode, { barIndex: scoreNode?.bars?.length ?? 0, beatIndex: 0 });
  return first && last ? { from: first, to: last } : null;
}

/** One bar, whole; null for a bar with no beats. */
export function barRange(scoreNode: any, barIndex: number): Range | null {
  const count = beatCount(scoreNode, barIndex);
  return count > 0 ? { from: { barIndex, beatIndex: 0 }, to: { barIndex, beatIndex: count - 1 } } : null;
}

/**
 * Whether both ends still name a beat, in order. A selection an edit has
 * left pointing at nothing is cleared, never clamped into a different range.
 * It sees only ends that no longer name a beat, not ones that moved: an end
 * that names another beat after an edit passes as if nothing had happened.
 */
export function stillValid(scoreNode: any, range: Range): boolean {
  const exists = (p: BeatPos) => p.beatIndex >= 0 && p.beatIndex < beatCount(scoreNode, p.barIndex);
  return exists(range.from) && exists(range.to) && comparePos(range.from, range.to) <= 0;
}

/** Every beat of the range, in reading order; none for a range that is not stillValid. */
export function positionsIn(scoreNode: any, range: Range): BeatPos[] {
  const out: BeatPos[] = [];
  if (!stillValid(scoreNode, range)) return out;
  for (let p: BeatPos | null = pos(range.from); p && comparePos(p, range.to) <= 0; p = nextBeatPos(scoreNode, p)) {
    out.push(p);
  }
  return out;
}

/**
 * Whole bars or beats, how many bars it touches and how many beats it holds;
 * not whole bars, no bars and no beats for a range that is not stillValid.
 */
export function sizeOf(scoreNode: any, range: Range): RangeSize {
  if (!stillValid(scoreNode, range)) return { wholeBars: false, bars: 0, beats: 0 };
  return {
    wholeBars: isWholeBars(scoreNode, range),
    bars: range.to.barIndex - range.from.barIndex + 1,
    beats: positionsIn(scoreNode, range).length,
  };
}
