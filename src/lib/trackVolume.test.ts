import { describe, it, expect } from "vitest";
import {
  DEFAULT_TRACK_VOLUME,
  clampTrackVolume,
  resolveTrackVolume,
  applySavedVolume,
} from "./trackVolume";

describe("resolveTrackVolume", () => {
  it("uses the stored volume when the track has one", () => {
    expect(resolveTrackVolume(65)).toBe(65);
  });
  it("falls back to the default when never set", () => {
    expect(resolveTrackVolume(null)).toBe(DEFAULT_TRACK_VOLUME);
    expect(resolveTrackVolume(undefined)).toBe(DEFAULT_TRACK_VOLUME);
  });
  it("keeps a stored silence of 0 rather than defaulting it", () => {
    expect(resolveTrackVolume(0)).toBe(0);
  });
});

describe("clampTrackVolume", () => {
  it("clamps out-of-range values into 0-100", () => {
    expect(clampTrackVolume(150)).toBe(100);
    expect(clampTrackVolume(-20)).toBe(0);
  });
  it("rounds to a whole percentage", () => {
    expect(clampTrackVolume(33.4)).toBe(33);
  });
  it("falls back to the default for NaN", () => {
    expect(clampTrackVolume(Number.NaN)).toBe(DEFAULT_TRACK_VOLUME);
  });
});

describe("applySavedVolume", () => {
  it("updates only the matching track", () => {
    const jamTracks = [
      { id: "a", volume: 40 },
      { id: "b", volume: 70 },
    ];
    const next = applySavedVolume(jamTracks, "a", 85);
    expect(next).toEqual([
      { id: "a", volume: 85 },
      { id: "b", volume: 70 },
    ]);
  });

  it("returns the same array reference when no track matches", () => {
    const jamTracks = [{ id: "a", volume: 40 }];
    expect(applySavedVolume(jamTracks, "missing", 85)).toBe(jamTracks);
  });

  it("does not mutate the input", () => {
    const jamTracks = [{ id: "a", volume: 40 }];
    applySavedVolume(jamTracks, "a", 85);
    expect(jamTracks[0].volume).toBe(40);
  });

  it("clamps the volume it stores", () => {
    const jamTracks = [{ id: "a", volume: 40 }];
    expect(applySavedVolume(jamTracks, "a", 150)[0].volume).toBe(100);
  });

  it("preserves the rest of the track's fields", () => {
    const jamTracks = [{ id: "a", volume: 40, title: "South Of Heaven", pdfs: [{ id: "p1" }] }];
    const next = applySavedVolume(jamTracks, "a", 85);
    expect(next[0].title).toBe("South Of Heaven");
    expect(next[0].pdfs).toBe(jamTracks[0].pdfs);
  });
});

// Regression: the player saved the new volume to the database but left the
// in-memory list untouched, so re-selecting the jam track re-applied the stale
// volume that the last library fetch had returned.
describe("volume survives re-selecting a jam track", () => {
  it("restores the volume the user just set, not the one loaded at startup", () => {
    let jamTracks = [
      { id: "painkiller", volume: 65 },
      { id: "paranoid", volume: 35 },
    ];

    // User drags the slider on Painkiller down to 20.
    jamTracks = applySavedVolume(jamTracks, "painkiller", 20);

    // User switches to Paranoid and back. The player reads the volume off the
    // in-memory track it is handed.
    const reselected = jamTracks.find((jt) => jt.id === "painkiller")!;
    expect(resolveTrackVolume(reselected.volume)).toBe(20);
  });
});
