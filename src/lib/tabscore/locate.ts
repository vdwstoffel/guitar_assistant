/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import { sliceCp } from "./offsets";

export interface Caret {
  barIndex: number;
  beatIndex: number;
  /**
   * 1-6: the AlphaTex text digit / `Caret` convention, 1 = high e, 6 = low E.
   * This is the INVERSE of alphaTab's internal `Note.string` (1 = low E) —
   * see ScoreCanvas.tsx's `noteStringToCaretString` doc comment for the
   * verified conversion. Do not read this as "alphaTab convention."
   */
  string: number;
}

/** Inclusive codepoint bounds. */
export interface SpliceRange {
  cpStart: number;
  cpEnd: number;
}

export function countBars(scoreNode: any): number {
  return scoreNode?.bars?.length ?? 0;
}

export function countBeats(scoreNode: any): number {
  return (scoreNode?.bars ?? []).reduce(
    (n: number, b: any) => n + (b.beats?.length ?? 0),
    0,
  );
}

export function findBeatNode(scoreNode: any, caret: Caret): any | null {
  const bar = scoreNode?.bars?.[caret.barIndex];
  if (!bar) return null;
  return bar.beats?.[caret.beatIndex] ?? null;
}

/**
 * The AST's end.offset is inclusive AND includes trailing whitespace, so
 * splicing it verbatim eats the separator and merges adjacent beats — a
 * corruption that still parses. Walk back over whitespace first.
 */
export function beatSpliceRange(
  text: string,
  scoreNode: any,
  caret: Caret,
): SpliceRange | null {
  const node = findBeatNode(scoreNode, caret);
  if (!node?.start || !node?.end) return null;

  const cpStart = node.start.offset;
  let cpEnd = node.end.offset;
  while (cpEnd > cpStart && /\s/.test(sliceCp(text, cpEnd, cpEnd))) {
    cpEnd--;
  }
  return { cpStart, cpEnd };
}

export function clampCaret(scoreNode: any, caret: Caret): Caret {
  const bars = countBars(scoreNode);
  if (bars === 0) return { barIndex: 0, beatIndex: 0, string: 6 };

  const barIndex = Math.min(Math.max(caret.barIndex, 0), bars - 1);
  const beats = scoreNode.bars[barIndex].beats?.length ?? 0;
  const beatIndex = Math.min(Math.max(caret.beatIndex, 0), Math.max(beats - 1, 0));
  const string = Math.min(Math.max(caret.string, 1), 6);
  return { barIndex, beatIndex, string };
}
