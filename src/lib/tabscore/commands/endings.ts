/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab's model types are only reachable through namespaces that cannot be
 * imported as types across the bundle boundary. These `any`s are the interop
 * boundary with that untyped surface, not unexamined typing.
 */
import { parseTex } from "../parse";
import { countBars, countBeats, type Caret } from "../locate";
import { commitEdit, type CommandResult } from "../apply";
import { writeBarDirective } from "./barDirective";

/** alphaTab's `MasterBar.MaxAlternateEndings`: its bitmask holds eight. */
export const MAX_ENDING = 8;

/**
 * The ending numbers a bar's bracket carries, from 1 and in order — `[1, 2]`
 * for a "1., 2." bar — or none. Read from alphaTab's model, whose
 * `alternateEndings` is a bitmask with ending n at bit n-1.
 */
export function readEndings(score: any, barIndex: number): number[] {
  const mask: number = score?.masterBars?.[barIndex]?.alternateEndings ?? 0;
  const endings: number[] = [];
  for (let n = 1; n <= MAX_ENDING; n++) if (mask & (1 << (n - 1))) endings.push(n);
  return endings;
}

/**
 * Put ending number `ending` on `barIndex`'s bracket (`\ae`), or take it off.
 *
 * An ending is marked bar by bar, on whichever bar the caret is in, like the
 * repeat signs: alphaTab draws side-by-side bars carrying the same numbers as
 * one bracket, and on each pass through a repeat plays only the bars whose
 * numbers include that pass — "1., 2." on the first two, "3." on the third.
 *
 * Always written parenthesised, `\ae (1 2)`: verified against alphaTab 1.8.1
 * that `\ae 1 2` makes a bar ending 1 alone.
 */
export function toggleEnding(
  text: string,
  caret: Caret,
  barIndex: number,
  ending: number,
): CommandResult | null {
  if (!Number.isInteger(ending) || ending < 1 || ending > MAX_ENDING) return null;

  const { scoreNode, score, ok } = parseTex(text);
  if (!ok || !scoreNode || !score) return null;

  const bars = countBars(scoreNode);
  if (barIndex < 0 || barIndex >= bars) return null;

  const current = readEndings(score, barIndex);
  const next = current.includes(ending)
    ? current.filter((n) => n !== ending)
    : [...current, ending].sort((a, b) => a - b);
  const nextText = writeBarDirective(
    text,
    scoreNode,
    barIndex,
    "ae",
    next.length > 0 ? `\\ae (${next.join(" ")})` : null,
  );
  if (nextText === null) return null;

  // An ending is metadata: the bar and beat counts must come out unchanged,
  // and the caret stays where the user left it.
  return commitEdit(nextText, caret, { bars, beats: countBeats(scoreNode) });
}
