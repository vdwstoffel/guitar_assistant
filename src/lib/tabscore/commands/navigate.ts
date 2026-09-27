/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import { parseTex } from "../parse";
import { clampCaret, type Caret } from "../locate";

export function moveBeat(text: string, caret: Caret, delta: 1 | -1): Caret {
  const { scoreNode, ok } = parseTex(text);
  if (!ok || !scoreNode) return caret;

  const bars: any[] = scoreNode.bars ?? [];
  if (bars.length === 0) return caret;

  const beatsIn = (i: number) => bars[i]?.beats?.length ?? 0;

  // Start from a caret known to be in range. The loops below bound barIndex
  // only via bars.length going forward and via barIndex > 0 going back, so an
  // already-corrupted barIndex would otherwise pass straight through (or make
  // the backward walk iterate its own magnitude).
  let { barIndex, beatIndex } = clampCaret(scoreNode, caret);
  beatIndex += delta;

  while (beatIndex >= beatsIn(barIndex) && barIndex + 1 < bars.length) {
    beatIndex -= beatsIn(barIndex);
    barIndex++;
  }
  while (beatIndex < 0 && barIndex > 0) {
    barIndex--;
    beatIndex += beatsIn(barIndex);
  }

  if (beatIndex < 0) beatIndex = 0;
  if (beatIndex >= beatsIn(barIndex)) beatIndex = Math.max(beatsIn(barIndex) - 1, 0);

  return { ...caret, barIndex, beatIndex };
}

export function moveString(caret: Caret, delta: 1 | -1): Caret {
  return { ...caret, string: Math.min(Math.max(caret.string + delta, 1), 6) };
}
