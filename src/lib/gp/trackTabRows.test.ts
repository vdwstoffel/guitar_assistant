import { describe, it, expect } from "vitest";
import { trackTabRows, gpSubtitle } from "./trackTabRows";
import type { GpSong, TrackTab } from "@/types";

function tab(over: Partial<TrackTab> = {}): TrackTab {
  return {
    id: "tab-1", name: "Scored", alphatex: null, tempo: 120,
    playbackSpeed: null, sortOrder: 0, trackId: "track-1", ...over,
  };
}

function song(over: Partial<GpSong> = {}): GpSong {
  return {
    id: "gp-1", title: "Imported", artist: "Iron Maiden", filePath: "GpSongs/a.gp5",
    tempo: 150, trackNames: ["Lead"], barCount: 351, favorite: false,
    completed: false, inProgress: false, lastPlayedAt: null, completedAt: null,
    playbackSpeed: null, lastTrackIndex: 0, jamTrackId: null, trackId: "track-1",
    sections: [], createdAt: "2026-10-04T10:00:00.000Z", ...over,
  };
}

describe("gpSubtitle", () => {
  it("reads artist, bars and tempo", () => {
    expect(gpSubtitle(song())).toBe("Iron Maiden · 351 bars · 150 BPM");
  });

  it("leaves out an artist the file does not declare", () => {
    expect(gpSubtitle(song({ artist: null }))).toBe("351 bars · 150 BPM");
  });

  it("leaves out a tempo the file does not declare", () => {
    // Not "null BPM", and no dangling separator at the end.
    expect(gpSubtitle(song({ tempo: null }))).toBe("Iron Maiden · 351 bars");
  });

  it("still says something for a file with neither", () => {
    expect(gpSubtitle(song({ artist: null, tempo: null }))).toBe("351 bars");
  });

  it("says bar, not bars, for a one-bar file", () => {
    expect(gpSubtitle(song({ artist: null, tempo: null, barCount: 1 }))).toBe("1 bar");
  });
});

describe("trackTabRows", () => {
  it("returns nothing for a track with neither kind", () => {
    expect(trackTabRows([], [])).toEqual([]);
  });

  it("puts scored tabs first, in sortOrder", () => {
    const rows = trackTabRows(
      [tab({ id: "b", name: "Second", sortOrder: 1 }), tab({ id: "a", name: "First", sortOrder: 0 })],
      [],
    );
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(rows.every((r) => r.kind === "alphatex")).toBe(true);
  });

  it("puts imports after the scored tabs, oldest first", () => {
    const rows = trackTabRows(
      [tab({ id: "scored" })],
      [
        song({ id: "newer", createdAt: "2026-10-04T12:00:00.000Z" }),
        song({ id: "older", createdAt: "2026-10-04T09:00:00.000Z" }),
      ],
    );
    expect(rows.map((r) => r.id)).toEqual(["scored", "older", "newer"]);
  });

  it("names a scored row by its tab name and an import by its title", () => {
    const rows = trackTabRows([tab({ name: "Tricky lick bar 12" })], [song({ title: "Fear of the Dark" })]);
    expect(rows[0]).toMatchObject({ kind: "alphatex", name: "Tricky lick bar 12", subtitle: "120 BPM" });
    expect(rows[1]).toMatchObject({ kind: "gp", name: "Fear of the Dark" });
  });

  it("carries the original record through, so the dock can open it", () => {
    const rows = trackTabRows([], [song({ id: "gp-9" })]);
    expect(rows[0].kind === "gp" && rows[0].song.id).toBe("gp-9");
  });

  it("does not mutate its arguments", () => {
    const tabs = [tab({ id: "b", sortOrder: 1 }), tab({ id: "a", sortOrder: 0 })];
    trackTabRows(tabs, []);
    expect(tabs.map((t) => t.id)).toEqual(["b", "a"]);
  });
});
