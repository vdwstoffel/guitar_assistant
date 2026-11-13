/**
 * When a riff's recorded takes start, and which part of each one plays.
 *
 * alphaTab plays the riff's score (its tabs, and a silent clock track) and is the clock; the takes
 * are separate Web Audio buffers. Every pass of the riff — each time round the
 * loop, or each of a song section's repeats — starts them all again from their
 * trim start (spec decision 20), so nothing drifts. A pass begins:
 *
 * - at the first playhead report after playback starts (or resumes);
 * - looping: whenever the tick goes back (alphaTab wrapped to the start);
 * - played through (a riff N times, or a song's sections one after another
 *   in one score): whenever the tick crosses into the next segment — one
 *   pass of one section — whose section's takes then start.
 *
 * alphaTab reports the position of the samples it has just played, so a
 * report can arrive a little into a pass: the takes are started that far in
 * (`elapsed`), not from the top.
 */

/** alphaTab's ticks per quarter note. */
export const TICKS_PER_QUARTER = 960;

export function ticksToSeconds(ticks: number, tempo: number): number {
  return ((ticks / TICKS_PER_QUARTER) * 60) / tempo;
}

/** One pass of one section in the played score, in ticks, and the index of its first played bar. */
export interface Segment {
  start: number;
  end: number;
  /** Which section of the score (a riff, or a song's section) it is a pass of. */
  section: number;
  firstBar: number;
}

export interface SegmentState {
  lastTick: number;
  /** The segment the takes were last started for. */
  segment: number;
}

export interface SegmentReport {
  state: SegmentState;
  /** A segment began at this report: (re)start the takes, those of its section. */
  started: boolean;
  /** The segment the tick is in, -1 past the end. */
  segment: number;
  /** Ticks into that segment at this report. */
  elapsed: number;
}

/**
 * Feed one playhead report (`state` null for the first after a start or
 * resume). Looping (a riff), a tick going back is a new pass; played through
 * (a riff N times, a song), a tick in a later segment starts it, and a tick
 * going back is the playhead reset on stop. A report at or past the end — the
 * tail alphaTab plays out — starts nothing.
 */
export function trackSegment(state: SegmentState | null, tick: number, segments: readonly Segment[], loop: boolean): SegmentReport {
  const index = segments.findIndex((s) => tick >= s.start && tick < s.end);
  if (index < 0) return { state: { lastTick: tick, segment: state?.segment ?? -1 }, started: false, segment: -1, elapsed: 0 };
  const elapsed = tick - segments[index].start;
  let started: boolean;
  let segment: number;
  if (state === null) {
    started = true;
    segment = index;
  } else if (loop) {
    started = tick < state.lastTick || index !== state.segment;
    segment = index;
  } else {
    started = index > state.segment;
    segment = Math.max(index, state.segment);
  }
  return { state: { lastTick: tick, segment }, started, segment: index, elapsed };
}

/**
 * The part of a take one pass plays, `elapsed` seconds into the pass: from its
 * trim start for the pass length, cut at its trim end or the end of the
 * recording (silence after). Null when nothing of it is left to play.
 */
export function takeSlice(
  window: { trimStart: number; trimEnd: number },
  bufferSeconds: number,
  passSeconds: number,
  elapsed: number,
): { offset: number; duration: number } | null {
  const end = Math.min(window.trimEnd, bufferSeconds);
  const length = Math.min(passSeconds, end - window.trimStart);
  const at = Math.max(0, elapsed);
  const duration = length - at;
  // Under 5 ms is not worth a source: it would only click.
  if (!(duration > 0.005)) return null;
  return { offset: window.trimStart + at, duration };
}

/** Index of the last bar starting at or before `tick` (0 for a tick before the first). */
export function barIndexAtTick(barStartTicks: number[], tick: number): number {
  let lo = 0;
  let hi = barStartTicks.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (barStartTicks[mid] <= tick) lo = mid;
    else hi = mid - 1;
  }
  return Math.max(0, lo);
}
