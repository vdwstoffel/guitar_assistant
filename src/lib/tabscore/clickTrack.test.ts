import { describe, it, expect } from "vitest";
import {
  buildClickTrack,
  advanceClicks,
  seekClicks,
  countInClicks,
  type Click,
  type ClickBar,
} from "./clickTrack";

/** A 4/4 bar is 3840 ticks, a quarter note 960 — alphaTab's own units. */
const bar44 = (start: number): ClickBar => ({
  start,
  end: start + 3840,
  numerator: 4,
  denominator: 4,
});

const ticks = (track: Click[]) => track.map((c) => c.tick);
const accents = (track: Click[]) => track.filter((c) => c.accent).map((c) => c.tick);

describe("buildClickTrack", () => {
  it("is empty without bars", () => {
    expect(buildClickTrack([])).toEqual([]);
  });

  it("puts a click on every beat of a 4/4 bar", () => {
    expect(ticks(buildClickTrack([bar44(0)]))).toEqual([0, 960, 1920, 2880]);
  });

  it("accents only the first beat of each bar", () => {
    const track = buildClickTrack([bar44(0), bar44(3840)]);
    expect(ticks(track)).toEqual([0, 960, 1920, 2880, 3840, 4800, 5760, 6720]);
    expect(accents(track)).toEqual([0, 3840]);
  });

  it("follows the time signature's denominator, not the quarter note", () => {
    // 6/8: six eighths of 480 ticks each.
    const sixEight: ClickBar = { start: 0, end: 2880, numerator: 6, denominator: 8 };
    expect(ticks(buildClickTrack([sixEight]))).toEqual([0, 480, 960, 1440, 1920, 2400]);
  });

  it("handles 3/4", () => {
    const threeFour: ClickBar = { start: 0, end: 2880, numerator: 3, denominator: 4 };
    expect(ticks(buildClickTrack([threeFour]))).toEqual([0, 960, 1920]);
  });

  it("clicks through a repeated bar once per pass", () => {
    // A repeated bar appears twice in the played order, at different ticks.
    const track = buildClickTrack([bar44(0), bar44(3840), bar44(7680), bar44(11520)]);
    expect(track).toHaveLength(16);
    expect(accents(track)).toEqual([0, 3840, 7680, 11520]);
  });

  it("gives a short pickup bar only the beats that fit, and keeps the beat length", () => {
    // An anacrusis: one quarter of pickup, then full 4/4 bars. Dividing the
    // pickup's own length by its numerator would give a 240-tick "beat".
    const track = buildClickTrack([
      { start: 0, end: 960, numerator: 4, denominator: 4 },
      bar44(960),
      bar44(4800),
    ]);
    expect(ticks(track)).toEqual([0, 960, 1920, 2880, 3840, 4800, 5760, 6720, 7680]);
    expect(accents(track)).toEqual([0, 960, 4800]);
  });

  it("ignores a bar of zero or negative length rather than looping forever", () => {
    expect(buildClickTrack([{ start: 100, end: 100, numerator: 4, denominator: 4 }])).toEqual([]);
  });
});

describe("advanceClicks", () => {
  const track = buildClickTrack([bar44(0), bar44(3840)]);
  const collect = () => {
    const played: number[] = [];
    return { played, emit: (c: Click) => played.push(c.tick) };
  };

  it("plays the clicks the position has reached, in order", () => {
    const { played, emit } = collect();
    const cursor = advanceClicks(track, 0, 1920, false, emit);
    expect(played).toEqual([0, 960, 1920]);
    expect(cursor).toBe(3);
  });

  it("never plays the same click twice", () => {
    const { played, emit } = collect();
    let cursor = advanceClicks(track, 0, 1000, false, emit);
    cursor = advanceClicks(track, cursor, 1000, false, emit);
    cursor = advanceClicks(track, cursor, 1900, false, emit);
    expect(played).toEqual([0, 960]);
    expect(cursor).toBe(2);
  });

  it("plays nothing before the first click is due", () => {
    const late = buildClickTrack([bar44(3840)]);
    const { played, emit } = collect();
    expect(advanceClicks(late, 0, 100, false, emit)).toBe(0);
    expect(played).toEqual([]);
  });

  it("stops at the end of the track", () => {
    const { played, emit } = collect();
    const cursor = advanceClicks(track, 0, 999999, false, emit);
    expect(played).toHaveLength(8);
    expect(advanceClicks(track, cursor, 999999, false, emit)).toBe(8);
    expect(played).toHaveLength(8);
  });

  it("re-seeks silently after a jump instead of firing everything skipped over", () => {
    // Clicking into the middle of a score, or a loop restarting, must not
    // let off a burst of every click in between.
    const { played, emit } = collect();
    const cursor = advanceClicks(track, 0, 5000, true, emit);
    expect(played).toEqual([]);
    expect(cursor).toBe(6); // first click at or after 5000 is 5760
  });

  it("resumes cleanly from where a jump left it", () => {
    const { played, emit } = collect();
    const afterJump = advanceClicks(track, 0, 3840, true, emit);
    advanceClicks(track, afterJump, 4800, false, emit);
    expect(played).toEqual([3840, 4800]);
  });

  it("re-seeks backwards for a loop that jumped to the start", () => {
    const { played, emit } = collect();
    let cursor = advanceClicks(track, 0, 6720, false, emit);
    expect(played).toHaveLength(8);
    cursor = advanceClicks(track, cursor, 0, true, emit);
    expect(cursor).toBe(0);
    cursor = advanceClicks(track, cursor, 0, false, emit);
    expect(played).toHaveLength(9);
  });
});

describe("seekClicks", () => {
  const track = buildClickTrack([bar44(0), bar44(3840)]);

  it("stays on a click that falls exactly on the tick, so it still gets played", () => {
    expect(seekClicks(track, 0)).toBe(0);
    expect(seekClicks(track, 3840)).toBe(4);
  });

  it("keeps the click under a playhead alphaTab has rounded one tick past it", () => {
    // Starting a score, or restarting a loop, reports tick 1 and 3841 rather
    // than 0 and 3840 — the downbeat must still be played.
    expect(seekClicks(track, 1)).toBe(0);
    expect(seekClicks(track, 3841)).toBe(4);
  });

  it("moves past the clicks already behind the tick", () => {
    expect(seekClicks(track, 2)).toBe(1);
    expect(seekClicks(track, 2000)).toBe(3);
  });

  it("lands past the end for a tick beyond the score", () => {
    expect(seekClicks(track, 99999)).toBe(8);
  });
});

describe("countInClicks", () => {
  const bars = [bar44(0), { start: 3840, end: 6720, numerator: 3, denominator: 4 }];

  it("counts a bar of the time signature playback starts in", () => {
    expect(countInClicks(bars, 0)).toBe(4);
    expect(countInClicks(bars, 2000)).toBe(4);
    expect(countInClicks(bars, 3840)).toBe(3);
    expect(countInClicks(bars, 5000)).toBe(3);
  });

  it("falls back to the first bar past the end of the score", () => {
    expect(countInClicks(bars, 99999)).toBe(4);
  });

  it("falls back to four without bars", () => {
    expect(countInClicks([], 0)).toBe(4);
  });
});
