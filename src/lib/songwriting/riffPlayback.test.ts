import { describe, expect, it } from "vitest";
import { barIndexAtTick, takeSlice, ticksToSeconds, trackSegment, type Segment, type SegmentState } from "./riffPlayback";

const seg = (start: number, end: number, section = 0): Segment => ({ start, end, section, firstBar: 0 });
const LOOP = [seg(0, 3840)];
const THREE = [seg(0, 3840), seg(3840, 7680), seg(7680, 11520)];

/** Feed a run of playhead reports through the tracker; the ticks at which a segment started, with its elapsed ticks. */
function run(segments: Segment[], loop: boolean, ticks: number[], from: SegmentState | null = null) {
  let state = from;
  const starts: [number, number][] = [];
  for (const t of ticks) {
    const r = trackSegment(state, t, segments, loop);
    state = r.state;
    if (r.started) starts.push([t, r.elapsed]);
  }
  return { starts, state };
}

describe("trackSegment, a riff on loop", () => {
  it("starts a pass at the first report after play, compensating for the ticks already played", () => {
    expect(run(LOOP, true, [12, 200, 900]).starts).toEqual([[12, 12]]);
  });

  it("starts a new pass whenever the tick wraps back", () => {
    expect(run(LOOP, true, [0, 1000, 3800, 8, 2000, 3830, 30]).starts).toEqual([
      [0, 0],
      [8, 8],
      [30, 30],
    ]);
  });

  it("does not start a pass from a report at or past the end of the score (the drain before the wrap)", () => {
    expect(run(LOOP, true, [3840, 3900]).starts).toEqual([]);
    expect(run(LOOP, true, [3000, 3840, 10]).starts).toEqual([
      [3000, 3000],
      [10, 10],
    ]);
  });

  it("a resume mid-pass (after a sound bank swap) starts the takes that far in", () => {
    expect(run(LOOP, true, [1920, 2000]).starts).toEqual([[1920, 1920]]);
  });
});

describe("trackSegment, played through once", () => {
  it("starts a segment at each boundary, measured within it", () => {
    expect(run(THREE, false, [0, 2000, 3850, 5000, 7700, 11000]).starts).toEqual([
      [0, 0],
      [3850, 10],
      [7700, 20],
    ]);
  });

  it("never starts one past the last", () => {
    expect(run(THREE, false, [0, 3850, 7700, 11520, 11600]).starts).toEqual([
      [0, 0],
      [3850, 10],
      [7700, 20],
    ]);
  });

  it("ignores a tick going back (the playhead reset when it stops)", () => {
    expect(run(THREE, false, [0, 3850, 0, 100]).starts).toEqual([
      [0, 0],
      [3850, 10],
    ]);
  });

  it("does not skip a segment whose first report arrives late", () => {
    expect(run(THREE, false, [0, 3000, 4500]).starts).toEqual([
      [0, 0],
      [4500, 660],
    ]);
  });

  it("a song: sections of different lengths, each pass a segment, reported with its section", () => {
    const song = [seg(0, 3840, 0), seg(3840, 7680, 0), seg(7680, 10560, 1)];
    expect(run(song, false, [0, 3900, 7700, 9000]).starts).toEqual([
      [0, 0],
      [3900, 60],
      [7700, 20],
    ]);
    expect(trackSegment({ lastTick: 7700, segment: 2 }, 9000, song, false).segment).toBe(2);
    expect(song[trackSegment(null, 9000, song, false).segment].section).toBe(1);
  });
});

describe("takeSlice", () => {
  const whole = { trimStart: 0, trimEnd: Infinity };

  it("plays from the trim start for the pass length when the take is longer", () => {
    expect(takeSlice({ trimStart: 0.5, trimEnd: 20 }, 30, 8, 0)).toEqual({ offset: 0.5, duration: 8 });
  });

  it("stops at the trim end when the kept take is shorter than the pass (silence after)", () => {
    expect(takeSlice({ trimStart: 1, trimEnd: 4 }, 30, 8, 0)).toEqual({ offset: 1, duration: 3 });
  });

  it("stops at the end of the recording when no trim end is stored", () => {
    expect(takeSlice(whole, 3, 8, 0)).toEqual({ offset: 0, duration: 3 });
  });

  it("starts that far into the take when the pass is already under way", () => {
    expect(takeSlice({ trimStart: 1, trimEnd: 20 }, 30, 8, 0.25)).toEqual({ offset: 1.25, duration: 7.75 });
  });

  it("returns null when nothing of the take is left in this pass", () => {
    expect(takeSlice({ trimStart: 1, trimEnd: 4 }, 30, 8, 3)).toBeNull();
    expect(takeSlice({ trimStart: 1, trimEnd: 4 }, 30, 8, 5)).toBeNull();
    expect(takeSlice({ trimStart: 5, trimEnd: Infinity }, 3, 8, 0)).toBeNull();
  });

  it("treats a negative elapsed time as the start of the pass", () => {
    expect(takeSlice(whole, 10, 8, -0.1)).toEqual({ offset: 0, duration: 8 });
  });
});

describe("ticksToSeconds", () => {
  it("is 960 ticks per quarter note", () => {
    expect(ticksToSeconds(960, 120)).toBe(0.5);
    expect(ticksToSeconds(3840, 60)).toBe(4);
  });
});

describe("barIndexAtTick", () => {
  it("finds the bar under a tick", () => {
    const starts = [0, 3840, 7680];
    expect(barIndexAtTick(starts, 0)).toBe(0);
    expect(barIndexAtTick(starts, 3839)).toBe(0);
    expect(barIndexAtTick(starts, 3840)).toBe(1);
    expect(barIndexAtTick(starts, 99999)).toBe(2);
    expect(barIndexAtTick(starts, -5)).toBe(0);
  });
});
