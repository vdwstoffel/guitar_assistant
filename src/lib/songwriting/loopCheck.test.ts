import { describe, expect, it } from "vitest";
import { loopPosition } from "./loopCheck";

describe("loopPosition", () => {
  const trim = { start: 1, end: 3 };
  it("runs from the trim start and wraps at its end", () => {
    expect(loopPosition(10, 10, trim)).toBe(1);
    expect(loopPosition(11.5, 10, trim)).toBe(2.5);
    expect(loopPosition(12.5, 10, trim)).toBe(1.5);
  });
  it("sits at the start until the loop begins", () => {
    expect(loopPosition(9.9, 10, trim)).toBe(1);
  });
});

describe("loopPosition from a paused spot", () => {
  const trim = { start: 1, end: 3 };
  it("carries on from where it was paused, then loops the whole trim", () => {
    expect(loopPosition(10, 10, trim, 2.5)).toBe(2.5);
    expect(loopPosition(10.25, 10, trim, 2.5)).toBe(2.75);
    expect(loopPosition(11, 10, trim, 2.5)).toBe(1.5);
  });
});
