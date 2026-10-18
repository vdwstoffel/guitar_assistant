/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab's model types are only reachable through namespaces that cannot be
 * imported as types across the bundle boundary. These `any`s are the interop
 * boundary with that untyped surface, not unexamined typing.
 */
import { cmp, div, frac, fromDuration, mul, sub, ZERO, type Fraction } from "./fraction";

/** A note value the editor can write: `.8`, `.8{d}`, `.8{tu 3}`. */
export interface NoteValue {
  /** 1 = whole … 64 = 64th. */
  duration: number;
  dots: 0 | 1 | 2;
  /** The n of `{tu n}`; null when not a tuplet. */
  tuplet: number | null;
}

/** Whole to 64th, longest first. */
export const DURATIONS: readonly number[] = [1, 2, 4, 8, 16, 32, 64];

/**
 * `{tu n}` → the denominator alphaTab 1.8.1 reads it with (3 in the time of
 * 2, 5 in the time of 4, …). Probed: any other n is a semantic error.
 */
export const TUPLET_DENOMINATOR: Readonly<Record<number, number>> = {
  3: 2, 5: 4, 6: 4, 7: 4, 9: 8, 10: 8, 11: 8, 12: 8,
};
const TUPLETS = [3, 5, 6, 7, 9, 10, 11, 12];

export const plain = (duration: number): NoteValue => ({ duration, dots: 0, tuplet: null });

export function lengthOf(v: NoteValue): Fraction {
  const den = v.tuplet === null ? -1 : (TUPLET_DENOMINATOR[v.tuplet] ?? -1);
  return fromDuration(v.duration, v.dots, v.tuplet ?? -1, den);
}

/** The value an alphaTab Beat is written with. */
export function valueOfBeat(beat: any): NoteValue {
  const dots = beat.dots === 1 || beat.dots === 2 ? beat.dots : 0;
  return { duration: beat.duration, dots, tuplet: beat.tupletNumerator > 0 ? beat.tupletNumerator : null };
}

export const sameValue = (a: NoteValue, b: NoteValue): boolean =>
  a.duration === b.duration && a.dots === b.dots && a.tuplet === b.tuplet;

function* candidates(preferTuplet: number | null): Generator<NoteValue> {
  if (preferTuplet !== null && TUPLET_DENOMINATOR[preferTuplet]) {
    for (const duration of DURATIONS) yield { duration, dots: 0, tuplet: preferTuplet };
  }
  for (const dots of [0, 1, 2] as const) {
    for (const duration of DURATIONS) yield { duration, dots, tuplet: null };
  }
  for (const tuplet of TUPLETS) {
    for (const duration of DURATIONS) yield { duration, dots: 0, tuplet };
  }
}

/**
 * The single value exactly this long, or null. Plain values win over dotted,
 * dotted over double-dotted, and those over tuplets — except `preferTuplet`'s
 * own values, tried first, so a shortened triplet note stays a triplet.
 */
export function valueOf(length: Fraction, preferTuplet: number | null = null): NoteValue | null {
  for (const v of candidates(preferTuplet)) {
    if (cmp(lengthOf(v), length) === 0) return v;
  }
  return null;
}

/** The longest plain value (no dot, no tuplet) that fits in `length`, or null below a 64th. */
export function largestPlainAtMost(length: Fraction): NoteValue | null {
  for (const duration of DURATIONS) {
    if (cmp(frac(1, duration), length) <= 0) return plain(duration);
  }
  return null;
}

/** Plain values, longest first from `unit` down to 64ths; null when they cannot add up to `length` exactly. */
function plainFill(length: Fraction, unit: number): NoteValue[] | null {
  const out: NoteValue[] = [];
  let rest = length;
  for (const duration of DURATIONS) {
    if (duration < unit) continue;
    const one = frac(1, duration);
    while (cmp(rest, one) >= 0) {
      out.push(plain(duration));
      rest = sub(rest, one);
    }
  }
  return cmp(rest, ZERO) === 0 ? out : null;
}

export interface FillOptions {
  /** The beat unit, the time signature's denominator: the longest plain value used. */
  unit: number;
  /** The bar's own value when every beat shares it: used when the gap is a whole number of it. */
  uniform?: NoteValue | null;
  /** The value of an unfinished tuplet group at the gap's start: completed first. */
  tuplet?: NoteValue | null;
}

/**
 * Rest values that add up to exactly `length`, or null when none can. In
 * order: the bar's uniform value if it divides the gap; plain values longest
 * first from the beat unit; and if the gap is not a sum of plain values, the
 * fewest `tuplet` values (at most n of them) that leave one.
 */
export function fill(length: Fraction, opts: FillOptions): NoteValue[] | null {
  const sign = cmp(length, ZERO);
  if (sign < 0) return null;
  if (sign === 0) return [];
  if (opts.uniform) {
    const count = div(length, lengthOf(opts.uniform));
    if (count.d === 1 && count.n > 0) return Array.from({ length: count.n }, () => ({ ...opts.uniform! }));
  }
  const plainOnly = plainFill(length, opts.unit);
  if (plainOnly) return plainOnly;
  const t = opts.tuplet;
  if (t && t.tuplet !== null) {
    for (let k = 1; k <= t.tuplet; k++) {
      const rest = sub(length, mul(lengthOf(t), frac(k)));
      if (cmp(rest, ZERO) < 0) break;
      const tail = plainFill(rest, opts.unit);
      if (tail) return [...Array.from({ length: k }, () => ({ ...t })), ...tail];
    }
  }
  return null;
}

const BASE: Record<number, [string, string]> = {
  1: ["whole", "wholes"],
  2: ["half", "halves"],
  4: ["quarter", "quarters"],
  8: ["8th", "8ths"],
  16: ["16th", "16ths"],
  32: ["32nd", "32nds"],
  64: ["64th", "64ths"],
};
const TUPLET_NAME: Record<number, string> = { 3: "triplet", 5: "quintuplet", 6: "sextuplet", 7: "septuplet" };

function phrase(v: NoteValue, count: number): string {
  const dots = v.dots === 1 ? "dotted " : v.dots === 2 ? "double-dotted " : "";
  const tuplet = v.tuplet === null ? "" : `${TUPLET_NAME[v.tuplet] ?? `${v.tuplet}-tuplet`} `;
  const [one, many] = BASE[v.duration];
  if (count > 1) return `${count} ${dots}${tuplet}${many}`;
  const words = `${dots}${tuplet}${one}`;
  return `${words.startsWith("8") || words.startsWith("11-") ? "an" : "a"} ${words}`;
}

function joinAnd(parts: string[]): string {
  return parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * An amount in words: one value when it is one ("a dotted 8th"), else plain
 * values longest first ("a quarter and a 16th"); null when neither says it.
 */
export function describe(length: Fraction): string | null {
  if (cmp(length, ZERO) <= 0) return null;
  const single = valueOf(length);
  if (single) return phrase(single, 1);
  const parts: string[] = [];
  let rest = length;
  for (const duration of DURATIONS) {
    const one = frac(1, duration);
    let count = 0;
    while (cmp(rest, one) >= 0) {
      count++;
      rest = sub(rest, one);
    }
    if (count > 0) parts.push(phrase(plain(duration), count));
  }
  return cmp(rest, ZERO) === 0 ? joinAnd(parts) : null;
}
