/**
 * Exact rational arithmetic for note lengths, in fractions of a whole note.
 * Integers only, never ticks: alphaTab's ticks round an 8th septuplet's
 * 1920/7 down to 274, and would call an exact bar of septuplets two ticks short.
 */
export interface Fraction {
  /** Numerator; carries the sign. */
  readonly n: number;
  /** Denominator; always positive. */
  readonly d: number;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

/**
 * n/d in lowest terms with a positive denominator. Zero is always +0: a
 * product such as -1 × 0 is -0 in JavaScript, and toEqual tells the two apart.
 */
export function frac(n: number, d = 1): Fraction {
  if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) {
    throw new Error(`not a fraction: ${n}/${d}`);
  }
  const sign = d < 0 ? -1 : 1;
  const g = gcd(n, d);
  return { n: n === 0 ? 0 : (sign * n) / g, d: (sign * d) / g };
}

export const ZERO: Fraction = frac(0);

export const add = (a: Fraction, b: Fraction): Fraction => frac(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Fraction, b: Fraction): Fraction => frac(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Fraction, b: Fraction): Fraction => frac(a.n * b.n, a.d * b.d);
export const div = (a: Fraction, b: Fraction): Fraction => frac(a.n * b.d, a.d * b.n);

export function cmp(a: Fraction, b: Fraction): -1 | 0 | 1 {
  const x = a.n * b.d - b.n * a.d;
  return x < 0 ? -1 : x > 0 ? 1 : 0;
}

/**
 * The length of one beat: 1/duration, times 3/2 for a dot or 7/4 for two,
 * times the tuplet's denominator over its numerator (3:2 → 2/3). A
 * tupletNumerator or tupletDenominator of -1 (alphaTab's "none") or 0 means
 * no tuplet. alphaTab writes a double whole as -2 and a quadruple whole as -4
 * (`.-2`, `.-4`): two and four wholes, not a negative length.
 */
export function fromDuration(
  duration: number,
  dots = 0,
  tupletNumerator = -1,
  tupletDenominator = -1,
): Fraction {
  let length = duration < 0 ? frac(-duration) : frac(1, duration);
  if (dots === 1) length = mul(length, frac(3, 2));
  else if (dots === 2) length = mul(length, frac(7, 4));
  if (tupletNumerator > 0 && tupletDenominator > 0) {
    length = mul(length, frac(tupletDenominator, tupletNumerator));
  }
  return length;
}
