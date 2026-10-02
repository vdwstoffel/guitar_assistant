import { describe, it, expect } from "vitest";
import { serializeGpSong } from "./serialize";

const row = (over: Record<string, unknown> = {}) => ({
  id: "x", title: "Song", artist: null, filePath: "GpSongs/a.gp5",
  tempo: 120, trackNames: '["Lead","Bass"]', barCount: 4,
  favorite: false, completed: false, inProgress: false,
  lastPlayedAt: null, completedAt: null, playbackSpeed: null, lastTrackIndex: 0,
  createdAt: new Date("2026-10-02T00:00:00Z"),
  ...over,
} as Parameters<typeof serializeGpSong>[0]);

describe("serializeGpSong", () => {
  it("parses the trackNames column into a list", () => {
    expect(serializeGpSong(row()).trackNames).toEqual(["Lead", "Bass"]);
  });

  it("gives an empty list rather than throwing on a corrupt column", () => {
    // The song is still playable; the picker falls back to numbered parts.
    expect(serializeGpSong(row({ trackNames: "not json" })).trackNames).toEqual([]);
    expect(serializeGpSong(row({ trackNames: '{"not":"an array"}' })).trackNames).toEqual([]);
  });

  it("defaults sections to an empty list when the query did not include them", () => {
    expect(serializeGpSong(row()).sections).toEqual([]);
  });

  it("turns dates into ISO strings the client can read", () => {
    const out = serializeGpSong(row({ lastPlayedAt: new Date("2026-10-01T12:00:00Z") }));
    expect(out.createdAt).toBe("2026-10-02T00:00:00.000Z");
    expect(out.lastPlayedAt).toBe("2026-10-01T12:00:00.000Z");
    expect(out.completedAt).toBeNull();
  });
});
