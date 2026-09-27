/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import { parseTex } from "../parse";
import { sliceCp, spliceCp } from "../offsets";
import { countBars, countBeats, type Caret } from "../locate";
import { commitEdit, type CommandResult } from "../apply";

/** The notated tempo, not the practice playback speed. */
export const MIN_TEMPO = 20;
export const MAX_TEMPO = 400;

export function clampTempo(bpm: number): number {
  return Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(bpm)));
}

/**
 * Locate the `\tempo` directive's argument in the source.
 *
 * The directives sit on the first bar node's `metaData`. The argument node's
 * range, like a beat's, is inclusive AND runs to the following newline — so
 * the same trailing-whitespace trim applies. Splicing it verbatim would join
 * the new number onto whatever directive comes next.
 */
function findTempoArgument(
  text: string,
  scoreNode: any,
): { cpStart: number; cpEnd: number; value: number } | null {
  const metaData: any[] = scoreNode?.bars?.[0]?.metaData ?? [];
  for (const node of metaData) {
    if (!node?.tag?.start || !node?.arguments?.start || !node?.arguments?.end) continue;
    const tag = sliceCp(text, node.tag.start.offset, node.tag.end.offset);
    if (!/\\\s*tempo\b/.test(tag)) continue;

    const cpStart = node.arguments.start.offset;
    let cpEnd = node.arguments.end.offset;
    while (cpEnd > cpStart && /\s/.test(sliceCp(text, cpEnd, cpEnd))) cpEnd--;

    const value = Number(sliceCp(text, cpStart, cpEnd).trim());
    if (!Number.isFinite(value)) return null;
    return { cpStart, cpEnd, value };
  }
  return null;
}

/**
 * The document's notated tempo, or null when it has none / does not parse.
 *
 * Takes an optional already-parsed `scoreNode` so a caller that has one (the
 * editor memoises a parse per keystroke) does not pay for a second parse.
 */
export function readTempo(text: string, scoreNode?: any): number | null {
  if (scoreNode) return findTempoArgument(text, scoreNode)?.value ?? null;
  const parsed = parseTex(text);
  if (!parsed.ok || !parsed.scoreNode) return null;
  return findTempoArgument(text, parsed.scoreNode)?.value ?? null;
}

/**
 * Rewrite the notated tempo. This edits the score, unlike the percentage
 * playback speed, which scales playback without touching the music.
 *
 * Returns null when the document has no `\tempo` directive — callers should
 * disable the control in that case rather than letting the edit fail
 * silently. Inserting a directive that was never there is a different, more
 * invasive edit and is deliberately out of scope.
 */
export function setTempo(
  text: string,
  bpm: number,
  caret: Caret = { barIndex: 0, beatIndex: 0, string: 6 },
): CommandResult | null {
  if (!Number.isFinite(bpm)) return null;

  const { scoreNode, ok } = parseTex(text);
  if (!ok || !scoreNode) return null;

  const found = findTempoArgument(text, scoreNode);
  if (!found) return null;

  const nextText = spliceCp(text, found.cpStart, found.cpEnd, String(clampTempo(bpm)));
  // Tempo is metadata: the bar and beat counts must come out unchanged, and
  // the caller's caret should survive rather than jumping to the first beat.
  return commitEdit(nextText, caret, {
    bars: countBars(scoreNode),
    beats: countBeats(scoreNode),
  });
}
