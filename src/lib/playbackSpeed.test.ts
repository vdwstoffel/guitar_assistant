import { describe, it, expect } from "vitest";
import {
  DEFAULT_PLAYBACK_SPEED,
  MIN_PLAYBACK_SPEED,
  MAX_PLAYBACK_SPEED,
  clampPlaybackSpeed,
  speedToRate,
  applySavedPlaybackSpeed,
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

describe("applySavedPlaybackSpeed", () => {
  it("updates only the matching track", () => {
    const jamTracks = [
      { id: "a", playbackSpeed: 100 },
      { id: "b", playbackSpeed: 80 },
    ];
    expect(applySavedPlaybackSpeed(jamTracks, "a", 65)).toEqual([
      { id: "a", playbackSpeed: 65 },
      { id: "b", playbackSpeed: 80 },
    ]);
  });

  it("returns the same array reference when no track matches", () => {
    const jamTracks = [{ id: "a", playbackSpeed: 100 }];
    expect(applySavedPlaybackSpeed(jamTracks, "missing", 65)).toBe(jamTracks);
  });

  it("does not mutate the input", () => {
    const jamTracks = [{ id: "a", playbackSpeed: 100 }];
    applySavedPlaybackSpeed(jamTracks, "a", 65);
    expect(jamTracks[0].playbackSpeed).toBe(100);
  });

  it("clamps the speed it stores", () => {
    const jamTracks = [{ id: "a", playbackSpeed: 100 }];
    expect(applySavedPlaybackSpeed(jamTracks, "a", 500)[0].playbackSpeed).toBe(200);
  });

  it("fills in a speed that was never set", () => {
    const jamTracks = [{ id: "a", playbackSpeed: null }];
    expect(applySavedPlaybackSpeed(jamTracks, "a", 75)[0].playbackSpeed).toBe(75);
  });
});

// Regression: the player saved the new speed to the database but left the
// in-memory list untouched, so re-selecting the jam track re-applied the stale
// speed that the last library fetch had returned.
describe("speed survives re-selecting a jam track", () => {
  it("restores the speed the user just set, not the one loaded at startup", () => {
    let jamTracks = [
      { id: "painkiller", playbackSpeed: 100 },
      { id: "paranoid", playbackSpeed: 90 },
    ];
    jamTracks = applySavedPlaybackSpeed(jamTracks, "painkiller", 70);
    const reselected = jamTracks.find((jt) => jt.id === "painkiller")!;
    expect(clampPlaybackSpeed(reselected.playbackSpeed)).toBe(70);
  });
});
