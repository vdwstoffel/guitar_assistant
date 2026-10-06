/**
 * Where the metronome clicks fall, on alphaTab's midi tick axis.
 *
 * Built from the played bar order rather than taken from alphaTab's own
 * `midiEventsPlayed` metronome events, because those are released against the
 * wrong clock. alphaTab compares each event's score time against the player's
 * *real* elapsed time, and those two axes only coincide at 100% speed
 * (verified against 1.8.1 and 1.8.4, `AlphaSynth.updateTimePosition`). At 50%
 * the clicks arrive early and bunched; at 150% they arrive at the score's own
 * rate — a beat every 500ms where the music plays one every 333ms — and fall
 * behind without limit. A tick position, by contrast, is correct in real time
 * at every speed, so the click is played when playback *reaches* its tick.
 *
 * The bars come from `api.tickCache.masterBars`, which is the order bars are
 * actually played in: a repeated bar appears once per pass, at its own ticks.
 */

/** One metronome click. */
export interface Click {
  /** The midi tick at which it sounds. */
  tick: number;
  /** First beat of the bar — played louder. */
  accent: boolean;
}

/** A bar as played, reduced to what the click grid needs. */
export interface ClickBar {
  /** Midi tick at which this pass of the bar starts. */
  start: number;
  end: number;
  numerator: number;
  denominator: number;
}

/**
 * alphaTab's `MidiUtils.QuarterTime`, used only when no bar can supply it.
 * It is a fixed constant of alphaTab's midi generation, but it is not part of
 * the public API surface, so it is derived from the music where possible.
 */
const DEFAULT_QUARTER_TICKS = 960;

/** The default count-in when the score has no bar to take one from. */
const DEFAULT_COUNT_IN = 4;

/**
 * How many ticks a quarter note lasts.
 *
 * Derived from the bars themselves rather than hard-coded, and from the
 * LONGEST bar: a bar always holds its full time signature except for a pickup,
 * which is short and would otherwise suggest an impossibly fast beat.
 */
function quarterTicksOf(bars: ClickBar[]): number {
  let quarter = 0;
  for (const bar of bars) {
    const length = bar.end - bar.start;
    if (length <= 0 || bar.numerator <= 0 || bar.denominator <= 0) continue;
    quarter = Math.max(quarter, (length * bar.denominator) / (4 * bar.numerator));
  }
  return quarter > 0 ? quarter : DEFAULT_QUARTER_TICKS;
}

/** The click grid for a whole score, in playing order. */
export function buildClickTrack(bars: ClickBar[]): Click[] {
  const quarter = quarterTicksOf(bars);
  const track: Click[] = [];
  for (const bar of bars) {
    if (bar.end <= bar.start || bar.denominator <= 0) continue;
    const beat = (quarter * 4) / bar.denominator;
    if (beat <= 0) continue;
    // Counted off the bar line rather than off a grid running through the
    // whole score, so the accent lands on the downbeat even after a pickup
    // bar or a time signature change. alphaTab's own counter does not.
    for (let tick = bar.start, k = 0; tick < bar.end; tick += beat, k++) {
      track.push({ tick, accent: k === 0 });
    }
  }
  return track;
}

/**
 * alphaTab reports a tick position one tick high: converting a time back to
 * ticks it adds one "for possible rounding errors"
 * (`MidiFileSequencer.currentTimePositionToTickPosition`). Taking that at face
 * value when seeking steps straight over a click sitting exactly on the
 * playhead — and the first beat of a bar always is one, so starting a score
 * from the top lost its downbeat, and every loop restart lost the first click
 * of the section.
 */
const TICK_ROUNDING = 1;

/**
 * Where the cursor belongs for a playhead at `tick`: the first click not yet
 * played, counting one sitting on the playhead itself as still to come.
 */
export function seekClicks(track: Click[], tick: number): number {
  const from = tick - TICK_ROUNDING;
  let lo = 0;
  let hi = track.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (track[mid].tick < from) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Play every click playback has reached since the last call, and return the
 * new cursor.
 *
 * `jumped` is for a seek or a loop restart: the cursor moves to the new
 * position without playing anything, because a jump has not *played* the
 * clicks it skipped over — without this, clicking into the middle of a score
 * would let off every click before it at once.
 */
export function advanceClicks(
  track: Click[],
  cursor: number,
  tick: number,
  jumped: boolean,
  emit: (click: Click) => void,
): number {
  if (jumped) return seekClicks(track, tick);
  let next = cursor;
  while (next < track.length && track[next].tick <= tick) {
    emit(track[next]);
    next++;
  }
  return next;
}

/**
 * How many clicks alphaTab counts in before playing from `tick`.
 *
 * It counts one bar of whatever time signature is in force there
 * (`MidiFileSequencer.generateCountInMidi`), so this is that bar's numerator.
 */
export function countInClicks(bars: ClickBar[], tick: number): number {
  for (const bar of bars) {
    if (tick >= bar.start && tick < bar.end) return bar.numerator;
  }
  return bars[0]?.numerator ?? DEFAULT_COUNT_IN;
}
