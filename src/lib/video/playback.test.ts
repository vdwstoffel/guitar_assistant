import { describe, it, expect } from "vitest";
import { clampPlaybackRate, loopSeekTarget } from "./playback";

describe("clampPlaybackRate", () => {
  it("passes a rate already in range", () => {
    expect(clampPlaybackRate(0.75)).toBe(0.75);
  });
  it("passes a faster-than-normal rate in range", () => {
    expect(clampPlaybackRate(1.5)).toBe(1.5);
  });
  it("clamps below the floor", () => {
    expect(clampPlaybackRate(0.1)).toBe(0.25);
  });
  it("clamps above the ceiling", () => {
    expect(clampPlaybackRate(5)).toBe(2);
  });
  it("falls back to 1 for NaN", () => {
    expect(clampPlaybackRate(Number.NaN)).toBe(1);
  });
});

describe("loopSeekTarget", () => {
  it("returns null when either point is unset", () => {
    expect(loopSeekTarget(10, null, 20)).toBeNull();
    expect(loopSeekTarget(10, 5, null)).toBeNull();
  });
  it("returns null when b <= a (invalid range)", () => {
    expect(loopSeekTarget(30, 20, 20)).toBeNull();
    expect(loopSeekTarget(30, 25, 20)).toBeNull();
  });
  it("returns null while still before b", () => {
    expect(loopSeekTarget(15, 10, 20)).toBeNull();
  });
  it("returns a when at or past b", () => {
    expect(loopSeekTarget(20, 10, 20)).toBe(10);
    expect(loopSeekTarget(25, 10, 20)).toBe(10);
  });
});
