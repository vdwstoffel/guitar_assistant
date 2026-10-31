/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import { parseTex } from "../parse";
import { countBars, countBeats, type Caret } from "../locate";
import { commitEdit, type CommandResult } from "../apply";
import { writeBarDirective } from "./barDirective";

export interface TimeSignature {
  /** Beats in the bar — the top number. */
  numerator: number;
  /** The note value that gets a beat — the bottom number. */
  denominator: number;
}

/** What a tab with no `\ts` anywhere is in: alphaTab's default. */
const DEFAULT: TimeSignature = { numerator: 4, denominator: 4 };

const MAX_NUMERATOR = 32;
const DENOMINATORS = [1, 2, 4, 8, 16, 32];

/** The metres the editor's control lists, in the order it lists them. */
export const TIME_SIGNATURE_PRESETS: TimeSignature[] = [
  { numerator: 2, denominator: 4 },
  { numerator: 3, denominator: 4 },
  { numerator: 4, denominator: 4 },
  { numerator: 5, denominator: 4 },
  { numerator: 6, denominator: 4 },
  { numerator: 7, denominator: 4 },
  { numerator: 2, denominator: 2 },
  { numerator: 3, denominator: 2 },
  { numerator: 3, denominator: 8 },
  { numerator: 5, denominator: 8 },
  { numerator: 6, denominator: 8 },
  { numerator: 7, denominator: 8 },
  { numerator: 9, denominator: 8 },
  { numerator: 12, denominator: 8 },
];

export function isValidTimeSignature({ numerator, denominator }: TimeSignature): boolean {
  return (
    Number.isInteger(numerator) && numerator >= 1 && numerator <= MAX_NUMERATOR &&
    DENOMINATORS.includes(denominator)
  );
}

const same = (a: TimeSignature, b: TimeSignature) =>
  a.numerator === b.numerator && a.denominator === b.denominator;

/**
 * The time signature a bar is in — its own `\ts` or the one it inherits —
 * read from alphaTab's model rather than the text, so `\ts common`, a header
 * `\ts 3 4` and the parenthesised form all read the same. Null for a bar that
 * is not there.
 */
export function readTimeSignature(score: any, barIndex: number): TimeSignature | null {
  const masterBar = score?.masterBars?.[barIndex];
  if (!masterBar) return null;
  return { numerator: masterBar.timeSignatureNumerator, denominator: masterBar.timeSignatureDenominator };
}

/**
 * Change the time signature from `barIndex` on — until the next bar that
 * changes it, which is how a time signature works in written music: it holds
 * until another one replaces it.
 *
 * The bar's own `\ts` is rewritten when it has one, and taken off altogether
 * when the bar is set back to the metre it would inherit, so going 4/4 → 3/4
 * → 4/4 leaves the tab exactly as it was. A header `\ts` (before the `.`)
 * counts as bar 0's and is edited where it is. Written parenthesised, `\ts (3 4)`:
 * alphaTab 1.8.1 reads `\ts 3 4` too but warns that metadata arguments should
 * be wrapped in parentheses.
 *
 * Only the directive changes. A bar whose notes no longer add up to the new
 * metre is flagged by the bar check like any other, for the user to fix —
 * re-barring their music behind their back would be far more surprising.
 *
 * Null when nothing would change, the time signature cannot be written, the
 * bar is not there, or the document does not parse.
 */
export function setTimeSignature(
  text: string,
  caret: Caret,
  barIndex: number,
  wanted: TimeSignature,
): CommandResult | null {
  if (!isValidTimeSignature(wanted)) return null;

  const { scoreNode, score, ok } = parseTex(text);
  if (!ok || !scoreNode || !score) return null;

  const bars = countBars(scoreNode);
  if (barIndex < 0 || barIndex >= bars) return null;

  const current = readTimeSignature(score, barIndex);
  if (!current || same(current, wanted)) return null;

  // Back to the metre the bar would inherit: the bar's own change goes.
  const inherited = barIndex === 0 ? DEFAULT : readTimeSignature(score, barIndex - 1)!;
  const nextText = writeBarDirective(
    text,
    scoreNode,
    barIndex,
    "ts",
    same(wanted, inherited) ? null : `\\ts (${wanted.numerator} ${wanted.denominator})`,
  );
  if (nextText === null) return null;

  // A time signature is metadata: the bar and beat counts must come out
  // unchanged, and the caret stays where the user left it.
  return commitEdit(nextText, caret, { bars, beats: countBeats(scoreNode) });
}
