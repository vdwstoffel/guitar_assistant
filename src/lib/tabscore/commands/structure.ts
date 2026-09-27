/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import { parseTex } from "../parse";
import { spliceCp } from "../offsets";
import { beatSpliceRange, countBars, countBeats, type Caret } from "../locate";
import { commitEdit, type CommandResult } from "../apply";

export function insertBeat(text: string, caret: Caret): CommandResult | null {
  const { scoreNode, ok } = parseTex(text);
  if (!ok || !scoreNode) return null;

  const range = beatSpliceRange(text, scoreNode, caret);
  if (!range) return null;

  const nextText = spliceCp(text, range.cpEnd + 1, range.cpEnd, " r");
  return commitEdit(nextText, { ...caret, beatIndex: caret.beatIndex + 1 }, {
    bars: countBars(scoreNode),
    beats: countBeats(scoreNode) + 1,
  });
}

export function deleteBeat(text: string, caret: Caret): CommandResult | null {
  const { scoreNode, ok } = parseTex(text);
  if (!ok || !scoreNode) return null;

  const beats: any[] = scoreNode.bars[caret.barIndex]?.beats ?? [];
  if (beats.length <= 1) return null;

  const range = beatSpliceRange(text, scoreNode, caret);
  if (!range) return null;

  // Take exactly one adjacent separator with it so the two neighbours don't
  // run together, measured against a real neighbouring beat's actual
  // start/end rather than assumed to be a single codepoint — beats can be
  // separated by arbitrary whitespace. Prefer the FOLLOWING beat when one
  // exists; otherwise (this is the bar's last beat) fall back to the
  // PRECEDING beat, so the separator before it goes instead. A bar with only
  // one beat is already refused above, so whichever neighbour is needed is
  // guaranteed to exist.
  const isLastBeat = caret.beatIndex === beats.length - 1;
  let from: number;
  let to: number;
  if (isLastBeat) {
    const prev = beatSpliceRange(text, scoreNode, { ...caret, beatIndex: caret.beatIndex - 1 })!;
    from = prev.cpEnd + 1;
    to = range.cpEnd;
  } else {
    const next = beatSpliceRange(text, scoreNode, { ...caret, beatIndex: caret.beatIndex + 1 })!;
    from = range.cpStart;
    to = next.cpStart - 1;
  }

  const nextText = spliceCp(text, from, to, "");
  return commitEdit(nextText, caret, {
    bars: countBars(scoreNode),
    beats: countBeats(scoreNode) - 1,
  });
}

export function addBar(text: string, caret: Caret): CommandResult | null {
  const { scoreNode, ok } = parseTex(text);
  if (!ok || !scoreNode) return null;

  const trimmed = text.replace(/\s+$/, "");
  const nextText = `${trimmed} | r r r r\n`;
  return commitEdit(nextText, { ...caret, barIndex: countBars(scoreNode), beatIndex: 0 }, {
    bars: countBars(scoreNode) + 1,
    beats: countBeats(scoreNode) + 4,
  });
}

export function deleteBar(text: string, caret: Caret): CommandResult | null {
  const { scoreNode, ok } = parseTex(text);
  if (!ok || !scoreNode) return null;

  const bars: any[] = scoreNode.bars ?? [];
  if (bars.length <= 1) return null;

  const bar = bars[caret.barIndex];
  const beats = bar?.beats ?? [];
  if (beats.length === 0) return null;

  const last = beatSpliceRange(text, scoreNode, { ...caret, beatIndex: beats.length - 1 })!;

  // Drop the bar's contents plus exactly one adjacent separator (a pipe and
  // its surrounding whitespace), measured against a real neighbouring beat's
  // actual start/end rather than assumed to be a fixed width — a bar can be
  // reformatted with arbitrary spacing around its pipes, and a fixed offset
  // either strips too little (leaving a dangling pipe) or too much/little on
  // one side (leaving a stray or doubled space). The two branches differ in
  // which neighbour supplies the separator:
  const isLastBar = caret.barIndex === bars.length - 1;
  let from: number;
  let to: number;
  if (isLastBar) {
    // No following bar: measure `from` against the PREVIOUS bar's last beat.
    // (isLastBar together with the bars.length <= 1 guard above means
    // caret.barIndex - 1 >= 0 always holds.) The previous bar can legally
    // have zero beats (e.g. "a | | b" parses fine), in which case there is
    // no beat to measure against — refuse rather than crash on the null.
    const prevBeats = bars[caret.barIndex - 1]?.beats ?? [];
    const prev = beatSpliceRange(text, scoreNode, {
      ...caret,
      barIndex: caret.barIndex - 1,
      beatIndex: prevBeats.length - 1,
    });
    if (!prev) return null;
    from = prev.cpEnd + 1;
    to = last.cpEnd;
  } else {
    // A following bar exists: measure `to` against where ITS first beat
    // actually starts. Same zero-beat hazard as `prev` above, on the other
    // side.
    const next = beatSpliceRange(text, scoreNode, {
      ...caret,
      barIndex: caret.barIndex + 1,
      beatIndex: 0,
    });
    if (!next) return null;
    const first = beatSpliceRange(text, scoreNode, { ...caret, beatIndex: 0 })!;
    from = first.cpStart;
    to = next.cpStart - 1;
  }

  const nextText = spliceCp(text, Math.max(from, 0), to, "");

  // The deleted bar's own barIndex no longer denotes a beat range post-edit.
  // When it was the last bar, nothing shifts into its place, so fall back to
  // the new last bar's final beat — clampCaret resolves both the now-out-of-
  // range barIndex and this sentinel beatIndex. Otherwise the following bar
  // has shifted down into the same index, so land on its first beat. Passing
  // the stale beatIndex through unchanged would silently stay in range (the
  // fallback bar may happen to be long enough) without landing on a
  // meaningful position — the caret-dangling bug this task owns.
  const nextCaret: Caret = isLastBar
    ? { ...caret, beatIndex: Number.MAX_SAFE_INTEGER }
    : { ...caret, beatIndex: 0 };

  return commitEdit(nextText, nextCaret, {
    bars: bars.length - 1,
    beats: countBeats(scoreNode) - beats.length,
  });
}
