import { describe, it, expect } from "vitest";
import { visibleScaleSongs } from "./scaleSongs";

const SONGS = [
  { id: "1", rootNote: "A", scaleType: "Minor Pentatonic" },
  { id: "2", rootNote: "A", scaleType: "Minor" },
  { id: "3", rootNote: "D", scaleType: "Minor" },
];

describe("visibleScaleSongs", () => {
  it("lists every song when no scale is selected", () => {
    expect(visibleScaleSongs(SONGS, "C", "None")).toEqual(SONGS);
  });

  it("ignores the key when no scale is selected", () => {
    // The key select is disabled in this state, so whatever it holds is stale.
    expect(visibleScaleSongs(SONGS, "F#", "None")).toHaveLength(3);
  });

  it("narrows to the selected root and scale", () => {
    expect(visibleScaleSongs(SONGS, "A", "Minor").map((s) => s.id)).toEqual(["2"]);
  });

  it("matches on both root and scale, not either", () => {
    expect(visibleScaleSongs(SONGS, "D", "Minor Pentatonic")).toEqual([]);
    expect(visibleScaleSongs(SONGS, "A", "Blues")).toEqual([]);
  });

  it("returns empty for an empty library", () => {
    expect(visibleScaleSongs([], "A", "None")).toEqual([]);
  });
});
