/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab's model types are only reachable through namespaces that cannot be
 * imported as types across the bundle boundary. These `any`s are the interop
 * boundary with that untyped surface, not unexamined typing.
 */
import { add, cmp, frac, fromDuration, sub, ZERO, type Fraction } from "./fraction";

/**
 * Whether a bar holds what its time signature says. `amount` is how much is
 * missing (short) or how much too much there is (long), in whole notes.
 */
export type BarState =
  | { kind: "exact" }
  | { kind: "exempt" }
  | { kind: "short"; amount: Fraction }
  | { kind: "long"; amount: Fraction };

const barOf = (score: any, barIndex: number) => score?.tracks?.[0]?.staves?.[0]?.bars?.[barIndex] ?? null;

/** One beat's length in whole notes; a grace note takes none. */
export function beatLength(beat: any): Fraction {
  if (beat.graceType > 0) return ZERO;
  return fromDuration(beat.duration, beat.dots, beat.tupletNumerator, beat.tupletDenominator);
}

export function voiceLength(voice: any): Fraction {
  return (voice?.beats ?? []).reduce((sum: Fraction, beat: any) => add(sum, beatLength(beat)), ZERO);
}

/** What the bar should hold: its time signature as a fraction of a whole note. */
export function barCapacity(score: any, barIndex: number): Fraction | null {
  const masterBar = score?.masterBars?.[barIndex];
  if (!masterBar) return null;
  return frac(masterBar.timeSignatureNumerator, masterBar.timeSignatureDenominator);
}

/** A whole rest on its own is the conventional "whole bar's rest" in any metre. */
function isLoneWholeRest(voice: any): boolean {
  const beats = (voice.beats ?? []).filter((beat: any) => !(beat.graceType > 0));
  const only = beats[0];
  return (
    beats.length === 1 && only.isRest && only.duration === 1 && only.dots === 0 && !(only.tupletNumerator > 0)
  );
}

/**
 * Measure a bar of track 0, staff 0 (the staff the editor writes): every voice
 * with beats against the time signature, in exact fractions. A pickup bar
 * (`\ac`), a bar with no beats and a bar that does not exist are exempt. With
 * several voices the longest overshoot wins, then the largest shortfall.
 */
export function barState(score: any, barIndex: number): BarState {
  const capacity = barCapacity(score, barIndex);
  const bar = barOf(score, barIndex);
  if (!capacity || !bar || score.masterBars[barIndex].isAnacrusis) return { kind: "exempt" };

  let measured = false;
  let long: Fraction | null = null;
  let short: Fraction | null = null;
  for (const voice of bar.voices ?? []) {
    if (voice.isEmpty || !voice.beats?.length) continue;
    measured = true;
    if (isLoneWholeRest(voice)) continue;
    const length = voiceLength(voice);
    const order = cmp(length, capacity);
    if (order > 0) {
      const over = sub(length, capacity);
      if (!long || cmp(over, long) > 0) long = over;
    } else if (order < 0) {
      const missing = sub(capacity, length);
      if (!short || cmp(missing, short) > 0) short = missing;
    }
  }
  if (!measured) return { kind: "exempt" };
  if (long) return { kind: "long", amount: long };
  if (short) return { kind: "short", amount: short };
  return { kind: "exact" };
}

export interface BrokenBar {
  barIndex: number;
  state: Extract<BarState, { kind: "short" | "long" }>;
}

/** Every bar that is short or long, in order. */
export function brokenBars(score: any): BrokenBar[] {
  const out: BrokenBar[] = [];
  const count = score?.masterBars?.length ?? 0;
  for (let barIndex = 0; barIndex < count; barIndex++) {
    const state = barState(score, barIndex);
    if (state.kind === "short" || state.kind === "long") out.push({ barIndex, state });
  }
  return out;
}

/**
 * Indexes (voice 0) of a long bar's beats that end after the bar should:
 * the one that straddles the bar line and every one after it. Empty for a
 * bar that is not long.
 */
export function overflowBeats(score: any, barIndex: number): number[] {
  if (barState(score, barIndex).kind !== "long") return [];
  const capacity = barCapacity(score, barIndex)!;
  const beats: any[] = barOf(score, barIndex)?.voices?.[0]?.beats ?? [];
  const out: number[] = [];
  let start = ZERO;
  beats.forEach((beat, index) => {
    const end = add(start, beatLength(beat));
    if (cmp(start, capacity) >= 0 || cmp(end, capacity) > 0) out.push(index);
    start = end;
  });
  return out;
}
