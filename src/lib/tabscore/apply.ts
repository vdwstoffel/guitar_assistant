import { parseTex } from "./parse";
import { clampCaret, countBars, countBeats, type Caret } from "./locate";

export interface CommandResult {
  text: string;
  caret: Caret;
}

/**
 * What the command intends the document's shape to be afterwards. A parse
 * check alone is not enough: dropping a separator merges two beats into one
 * and still parses cleanly, so commands assert the resulting counts.
 */
export interface StructureExpectation {
  bars?: number;
  beats?: number;
}

export function commitEdit(
  nextText: string,
  caret: Caret,
  expected: StructureExpectation,
): CommandResult | null {
  const result = parseTex(nextText);
  if (!result.ok || !result.scoreNode) return null;

  if (expected.bars !== undefined && countBars(result.scoreNode) !== expected.bars) return null;
  if (expected.beats !== undefined && countBeats(result.scoreNode) !== expected.beats) return null;

  return { text: nextText, caret: clampCaret(result.scoreNode, caret) };
}
