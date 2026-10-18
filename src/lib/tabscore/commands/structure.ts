/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import { parseTex } from "../parse";
import { spliceCp } from "../offsets";
import { beatSpliceRange, countBars, countBeats, type BeatPos, type Caret } from "../locate";
import { commitEdit, type CommandResult } from "../apply";
import { barState } from "../barFill";
import { frac } from "../fraction";
import { fill, plain } from "../durationValues";
import { durationAt, repinAt } from "../repin";
import { formatRests, nextBeatPos } from "./barEdit";

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

  // The beat that followed keeps its duration, even if it inherited it from
  // the beat going (re-pinning). It moves up one place within the bar.
  const after = nextBeatPos(scoreNode, caret);
  let nextText: string | null = spliceCp(text, from, to, "");
  if (after) {
    const moved: BeatPos =
      after.barIndex === caret.barIndex ? { ...after, beatIndex: after.beatIndex - 1 } : after;
    nextText = repinAt(nextText, moved, durationAt(scoreNode, after));
    if (nextText === null) return null;
  }
  return commitEdit(nextText, caret, {
    bars: countBars(scoreNode),
    beats: countBeats(scoreNode) - 1,
  });
}

/**
 * Append a bar full of rests: bare rests of the duration in force at the end
 * of the score, as many as the last bar's time signature holds (eight after
 * 8ths in 4/4, three quarters in 3/4). When that duration does not divide the
 * bar, the short-bar padding instead (fill: plain values from the beat unit).
 */
export function addBar(text: string, caret: Caret): CommandResult | null {
  const { scoreNode, score, ok } = parseTex(text);
  if (!ok || !scoreNode || !score) return null;

  const bars = countBars(scoreNode);
  const lastBeats = scoreNode.bars[bars - 1]?.beats?.length ?? 0;
  const inForce = durationAt(scoreNode, { barIndex: bars - 1, beatIndex: lastBeats - 1 });
  const masterBar = score.masterBars[score.masterBars.length - 1];
  const values = fill(frac(masterBar.timeSignatureNumerator, masterBar.timeSignatureDenominator), {
    unit: masterBar.timeSignatureDenominator,
    uniform: plain(inForce),
  });
  if (!values || values.length === 0) return null;
  const rests = formatRests(values, inForce);

  const trimmed = text.replace(/\s+$/, "");
  const nextText = `${trimmed} | ${rests.join(" ")}\n`;
  return commitEdit(nextText, { ...caret, barIndex: bars, beatIndex: 0 }, {
    bars: bars + 1,
    beats: countBeats(scoreNode) + rests.length,
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
    // A following bar exists: measure `to` against where IT starts — its own
    // directives (`\rc 2`, `\section`) if it has any, else its first beat — so
    // they stay on it. The bar going keeps its own directives in place, as
    // before: they open the bar that follows now. Same zero-beat hazard as
    // `prev` above, on the other side.
    const next = beatSpliceRange(text, scoreNode, {
      ...caret,
      barIndex: caret.barIndex + 1,
      beatIndex: 0,
    });
    if (!next) return null;
    const first = beatSpliceRange(text, scoreNode, { ...caret, beatIndex: 0 })!;
    from = first.cpStart;
    to = Math.min(next.cpStart, bars[caret.barIndex + 1]?.start?.offset ?? next.cpStart) - 1;
  }

  let nextText: string | null = spliceCp(text, Math.max(from, 0), to, "");
  // The first beat of the bar that followed keeps its duration, even if it
  // inherited it from the bar going (re-pinning).
  if (!isLastBar) {
    const after = { barIndex: caret.barIndex + 1, beatIndex: 0 };
    nextText = repinAt(nextText, { barIndex: caret.barIndex, beatIndex: 0 }, durationAt(scoreNode, after));
    if (nextText === null) return null;
  }

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

/**
 * What → does past the last beat of the score, so the score grows as it is
 * written. A bar that is not short — exact, too long, or exempt from the
 * measure (a pickup, or a bar with no beats) — rolls over to a new bar; a
 * short one takes another beat after the caret.
 *
 * `text` is parsed here, afresh: the caller's memoised parse can be one edit
 * behind while keys arrive at speed, and "is this bar short?" must be answered
 * about this text. A document that does not parse cannot be measured and gets
 * the plain fallback of another beat — which refuses it too, so the result is
 * null and the caller just moves the caret as it would anywhere else.
 */
export function extendScore(text: string, caret: Caret): CommandResult | null {
  const { score, ok } = parseTex(text);
  const state = ok ? barState(score, caret.barIndex) : null;
  return state && state.kind !== "short" ? addBar(text, caret) : insertBeat(text, caret);
}
