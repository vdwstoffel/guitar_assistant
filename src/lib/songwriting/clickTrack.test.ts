import { describe, expect, it } from "vitest";
import { clickSeconds, clicksUntil, countInAt } from "./clickTrack";

describe("clickSeconds", () => {
  it("clicks on the time signature's beat, the tempo counting quarter notes", () => {
    expect(clickSeconds(120, 4)).toBe(0.5);
    expect(clickSeconds(120, 8)).toBe(0.25);
  });
});

describe("clicksUntil", () => {
  it("lists the clicks from a beat up to (not at) a time, each bar's first accented", () => {
    expect(clicksUntil(10, 0.5, 3, 2, 12)).toEqual([
      { beat: 2, time: 11, accent: false },
      { beat: 3, time: 11.5, accent: true },
    ]);
  });

  it("is empty once the next click is past the time", () => {
    expect(clicksUntil(10, 0.5, 4, 8, 13)).toEqual([]);
  });
});

describe("countInAt", () => {
  it("counts 1 to the bar's beats through the count-in, then stops", () => {
    const at = (now: number) => countInAt(now, 10, 0.5, 4);
    expect([9.9, 10, 10.49, 10.5, 11.2, 11.6, 12].map(at)).toEqual([null, 1, 1, 2, 3, 4, null]);
  });
});
