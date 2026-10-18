/* eslint-disable @typescript-eslint/no-explicit-any --
 * Renders with alphaTab and reads its bounds, which have no published types here.
 */
import { describe, it, expect } from "vitest";
import * as alphaTabModule from "@coderline/alphatab";
import { selectionRects, type Rect } from "./selectionRects";
import { parseTex } from "./parse";

const alphaTab = alphaTabModule as any;

// Twelve bars of eight 8ths, rendered 720 px wide: a few bars per system row.
const TEX = `\\tempo 120\n.\n${Array.from({ length: 12 }, () => "3.6.8 5.6 7.6 8.6 3.6 5.6 7.6 8.6").join(" | ")}\n`;

function rendered() {
  const score = parseTex(TEX).score;
  for (const staff of score.tracks[0].staves) {
    staff.showStandardNotation = false;
    staff.showTablature = true;
  }
  const settings = new alphaTab.Settings();
  settings.core.engine = "svg";
  settings.core.enableLazyLoading = false;
  const renderer = new alphaTab.rendering.ScoreRenderer(settings);
  renderer.width = 720;
  renderer.renderScore(score, [0]);
  return { score, lookup: renderer.boundsLookup };
}
const { score, lookup } = rendered();
const beat = (barIndex: number, beatIndex: number) => lookup.findBeat(score.tracks[0].staves[0].bars[barIndex].voices[0].beats[beatIndex]);
const range = (from: [number, number], to: [number, number]) => ({
  from: { barIndex: from[0], beatIndex: from[1] },
  to: { barIndex: to[0], beatIndex: to[1] },
});
const systemOf = (barIndex: number, beatIndex = 0) => beat(barIndex, beatIndex).barBounds.masterBarBounds.staffSystemBounds;
/** The rectangles over the fixture's own render, which is never another render's. */
const drawn = (r: ReturnType<typeof range>): Rect[] => {
  const rects = selectionRects(score, lookup, r);
  if (!rects) throw new Error("the fixture's lookup read as another render's");
  return rects;
};

describe("selectionRects", () => {
  it("renders on more than one system row (the fixture is not vacuous)", () => {
    expect(lookup.staffSystems.length).toBeGreaterThan(2);
  });

  it("is one rectangle from the first beat's left edge to the last beat's right edge on one row", () => {
    const [r] = drawn(range([0, 2], [0, 4]));
    expect(r.left).toBeCloseTo(beat(0, 2).realBounds.x);
    expect(r.left + r.width).toBeCloseTo(beat(0, 4).realBounds.x + beat(0, 4).realBounds.w);
    expect(selectionRects(score, lookup, range([0, 2], [0, 4]))).toHaveLength(1);
  });

  it("stretches a bar's first and last beat to the bar's edges", () => {
    const bar = beat(1, 0).barBounds.masterBarBounds.realBounds;
    const [r] = drawn(range([1, 0], [1, 7]));
    expect(r.left).toBeCloseTo(bar.x);
    expect(r.width).toBeCloseTo(bar.w);
  });

  it("covers one beat when the selection is one beat", () => {
    const [r] = drawn(range([0, 3], [0, 3]));
    expect(r.left).toBeCloseTo(beat(0, 3).realBounds.x);
    expect(r.width).toBeCloseTo(beat(0, 3).realBounds.w);
  });

  it("is one rectangle per row across rows: partial, full…, partial", () => {
    const first = systemOf(0).index;
    const lastBar = score.tracks[0].staves[0].bars.length - 1;
    const last = systemOf(lastBar).index;
    const rects = drawn(range([0, 2], [lastBar, 1]));
    expect(rects).toHaveLength(last - first + 1);
    const row = (i: number) => lookup.staffSystems[i].visualBounds;
    expect(rects[0].left).toBeCloseTo(beat(0, 2).realBounds.x);
    expect(rects[0].left + rects[0].width).toBeCloseTo(row(first).x + row(first).w);
    expect(rects[1]).toEqual({ left: row(first + 1).x, top: row(first + 1).y, width: row(first + 1).w, height: row(first + 1).h });
    const end = rects[rects.length - 1];
    expect(end.left).toBeCloseTo(row(last).x);
    expect(end.left + end.width).toBeCloseTo(beat(lastBar, 1).realBounds.x + beat(lastBar, 1).realBounds.w);
    expect(rects.map((r) => r.top)).toEqual([...rects.map((r) => r.top)].sort((a, b) => a - b));
  });

  it("is empty for a beat that is not on the score", () => {
    expect(selectionRects(score, lookup, range([0, 0], [40, 0]))).toEqual([]);
    expect(selectionRects(score, null, range([0, 0], [0, 1]))).toEqual([]);
  });

  // Beyond the brief: where the box sits vertically is as visible as where it sits across.
  it("is as tall as the bar's row, not as a beat: one row, and the first and last rows of several", () => {
    const row = (barIndex: number, beatIndex: number) => beat(barIndex, beatIndex).barBounds.masterBarBounds.visualBounds;
    const [one] = drawn(range([0, 2], [0, 4]));
    expect(one.top).toBeCloseTo(row(0, 2).y);
    expect(one.height).toBeCloseTo(row(0, 2).h);
    const lastBar = score.tracks[0].staves[0].bars.length - 1;
    const rects = drawn(range([0, 2], [lastBar, 1]));
    const end = rects[rects.length - 1];
    expect(rects[0].top).toBeCloseTo(row(0, 2).y);
    expect(rects[0].height).toBeCloseTo(row(0, 2).h);
    expect(end.top).toBeCloseTo(row(lastBar, 1).y);
    expect(end.height).toBeCloseTo(row(lastBar, 1).h);
  });

  it("is empty when it is the first beat that is not on the score", () => {
    expect(selectionRects(score, lookup, range([40, 0], [0, 1]))).toEqual([]);
    expect(selectionRects(score, lookup, range([0, 99], [0, 100]))).toEqual([]);
  });

  // Between a render's start and the moment its bounds land, alphaTab's api has
  // the new Score and the last render's lookup. Beat ids restart with every
  // parse, so that lookup finds the new Score's beats by id — where the old
  // render drew other beats.
  it("is null while the lookup is another render's, which knows the new score's beats only by their ids", () => {
    const next = parseTex(TEX).score;
    const first = next.tracks[0].staves[0].bars[0].voices[0].beats[2];
    expect(first.id).toBe(score.tracks[0].staves[0].bars[0].voices[0].beats[2].id);
    expect(lookup.findBeat(first)).not.toBeNull();
    expect(selectionRects(next, lookup, range([0, 2], [0, 4]))).toBeNull();
    expect(selectionRects(next, lookup, range([0, 2], [3, 1]))).toBeNull();
    // and its own score's beats are found as ever
    expect(selectionRects(score, lookup, range([0, 2], [0, 4]))).toHaveLength(1);
  });
});
