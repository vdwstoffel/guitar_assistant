import { describe, it, expect } from "vitest";
import {
  DEFAULT_PLAYBACK_SPEED,
  MIN_PLAYBACK_SPEED,
  MAX_PLAYBACK_SPEED,
  clampPlaybackSpeed,
  speedToRate,
} from "./playbackSpeed";

describe("clampPlaybackSpeed", () => {
  it("passes a speed already in range", () => {
    expect(clampPlaybackSpeed(70)).toBe(70);
  });
  it("keeps the boundaries", () => {
    expect(clampPlaybackSpeed(MIN_PLAYBACK_SPEED)).toBe(10);
    expect(clampPlaybackSpeed(MAX_PLAYBACK_SPEED)).toBe(200);
  });
  it("clamps below the floor", () => {
    expect(clampPlaybackSpeed(5)).toBe(10);
    expect(clampPlaybackSpeed(-40)).toBe(10);
  });
  it("clamps above the ceiling", () => {
    expect(clampPlaybackSpeed(500)).toBe(200);
  });
  it("rounds to a whole percentage", () => {
    expect(clampPlaybackSpeed(72.4)).toBe(72);
  });
  it("falls back to the default for NaN", () => {
    expect(clampPlaybackSpeed(Number.NaN)).toBe(DEFAULT_PLAYBACK_SPEED);
  });
  it("treats a missing stored value as the default", () => {
    expect(clampPlaybackSpeed(null)).toBe(100);
    expect(clampPlaybackSpeed(undefined)).toBe(100);
  });
});

describe("speedToRate", () => {
  it("converts a percentage to a media element rate", () => {
    expect(speedToRate(70)).toBeCloseTo(0.7);
    expect(speedToRate(100)).toBe(1);
    expect(speedToRate(200)).toBe(2);
  });
  it("treats a missing stored value as normal speed", () => {
    expect(speedToRate(null)).toBe(1);
    expect(speedToRate(undefined)).toBe(1);
  });
  it("clamps before converting, so the element never gets an illegal rate", () => {
    expect(speedToRate(1000)).toBe(2);
    expect(speedToRate(0)).toBeCloseTo(0.1);
  });
});
