/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import { parseTex } from "../parse";
import { sliceCp, spliceCp } from "../offsets";
import { countBars, countBeats, type Caret } from "../locate";
import { commitEdit, type CommandResult } from "../apply";

export const MIN_REPEAT_COUNT = 2;
export const MAX_REPEAT_COUNT = 16;

export function clampRepeatCount(n: number): number {
  return Math.min(MAX_REPEAT_COUNT, Math.max(MIN_REPEAT_COUNT, Math.round(n)));
}

/** What a single bar carries: an opening sign, a closing one, or neither. */
export interface BarRepeat {
  /** The bar starts a repeated section (`\ro`, rendered as `𝄆`). */
  open: boolean;
  /** The bar ends one, played this many times total (`\rc N`, `𝄇`). */
  count: number | null;
}

interface Directive {
  /** Inclusive codepoint bounds of the whole directive, trailing space included. */
  cpStart: number;
  cpEnd: number;
  argument: string | null;
}

/**
 * `\ro` and `\rc N` are BAR metadata, and sit on the bar they apply to —
 * unlike `\tempo`, which the editor only ever reads from bar 0. `\ro` has no
 * argument at all, so its AST node has no `arguments` property; only `\rc`
 * does.
 */
function findDirective(
  text: string,
  scoreNode: any,
  barIndex: number,
  name: "ro" | "rc",
): Directive | null {
  const metaData: any[] = scoreNode?.bars?.[barIndex]?.metaData ?? [];
  for (const node of metaData) {
    if (!node?.tag?.start || !node?.end) continue;
    const tag = sliceCp(text, node.tag.start.offset, node.tag.end.offset);
    if (!new RegExp(`\\\\\\s*${name}\\b`).test(tag)) continue;
    return {
      cpStart: node.start.offset,
      cpEnd: node.end.offset,
      argument: node.arguments
        ? sliceCp(text, node.arguments.start.offset, node.arguments.end.offset).trim()
        : null,
    };
  }
  return null;
}

/** Where a directive for this bar has to be written. */
function insertionPoint(scoreNode: any, barIndex: number): number | null {
  // Before the bar's first beat, NOT at the end of the previous one:
  // verified against alphaTab 1.8.1 that `... \rc 2 |` — the position a
  // musician would write the closing sign — parses as an extra, empty bar
  // carrying the repeat, silently lengthening the score.
  const offset = scoreNode?.bars?.[barIndex]?.beats?.[0]?.start?.offset;
  return typeof offset === "number" ? offset : null;
}

export function readBarRepeat(text: string, scoreNode: any, barIndex: number): BarRepeat {
  const open = findDirective(text, scoreNode, barIndex, "ro") !== null;
  const close = findDirective(text, scoreNode, barIndex, "rc");
  const count = close ? Number(close.argument) : NaN;
  return { open, count: Number.isFinite(count) ? count : null };
}

/**
 * Add or remove one repeat directive on one bar.
 *
 * Start and end are set separately, on whichever bar the caret is in — the
 * way the notation itself works, and the way you actually mark a piece up:
 * put the caret in the bar the section starts on, press start; go to the bar
 * it ends on, press end. Nothing has to be selected in between, and the
 * drag-selected practice section stays what it is — a playback loop, not
 * notation.
 */
function writeDirective(
  text: string,
  caret: Caret,
  barIndex: number,
  name: "ro" | "rc",
  argument: string | null,
): CommandResult | null {
  const { scoreNode, ok } = parseTex(text);
  if (!ok || !scoreNode) return null;

  const bars = countBars(scoreNode);
  if (barIndex < 0 || barIndex >= bars) return null;

  const existing = findDirective(text, scoreNode, barIndex, name);
  let nextText: string;

  if (argument === null && !existing) return null; // nothing to remove
  if (argument === null) {
    nextText = spliceCp(text, existing!.cpStart, existing!.cpEnd, "");
  } else {
    const directive = `\\${name}${argument === "" ? "" : ` ${argument}`} `;
    if (existing) {
      nextText = spliceCp(text, existing.cpStart, existing.cpEnd, directive);
    } else {
      const at = insertionPoint(scoreNode, barIndex);
      if (at === null) return null;
      nextText = spliceCp(text, at, at - 1, directive);
    }
  }

  // Repeat signs are metadata: the bar and beat counts must come out
  // unchanged, and the caret should stay where the user left it.
  return commitEdit(nextText, caret, { bars, beats: countBeats(scoreNode) });
}

/**
 * Put a repeat-start sign (`\ro`, `𝄆`) on `barIndex`, or take the one
 * that is there off again.
 */
export function toggleRepeatStart(
  text: string,
  caret: Caret,
  barIndex: number,
): CommandResult | null {
  const { scoreNode, ok } = parseTex(text);
  if (!ok || !scoreNode) return null;
  const on = readBarRepeat(text, scoreNode, barIndex).open;
  return writeDirective(text, caret, barIndex, "ro", on ? null : "");
}

/**
 * Put a repeat-end sign (`\rc N`, `𝄇`) on `barIndex`, or take it off.
 *
 * Pressing it on a bar that already ends a repeat with a DIFFERENT count
 * rewrites the count rather than removing the sign — otherwise changing "×2"
 * to "×4" would take two presses and lose the sign in between.
 */
export function toggleRepeatEnd(
  text: string,
  caret: Caret,
  barIndex: number,
  count: number,
): CommandResult | null {
  const { scoreNode, ok } = parseTex(text);
  if (!ok || !scoreNode) return null;
  const wanted = clampRepeatCount(count);
  const current = readBarRepeat(text, scoreNode, barIndex).count;
  const remove = current === wanted;
  return writeDirective(text, caret, barIndex, "rc", remove ? null : String(wanted));
}
