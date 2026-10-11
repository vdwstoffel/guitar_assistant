import { describe, it, expect } from "vitest";
import {
  parseTrackMix,
  serializeTrackMix,
  trackMixColumn,
  toTrackMix,
  channelsOf,
  DEFAULT_TRACK_MIX,
} from "./trackMix";

describe("parseTrackMix", () => {
  it("restores a saved mix", () => {
    const json = JSON.stringify([
      { level: 0.4, muted: false, soloed: false },
      { level: 1, muted: true, soloed: false },
    ]);
    expect(parseTrackMix(json, 2)).toEqual([
      { level: 0.4, muted: false, soloed: false },
      { level: 1, muted: true, soloed: false },
    ]);
  });

  it("gives every track the all-audible default when nothing was ever saved", () => {
    expect(parseTrackMix(null, 3)).toEqual([
      DEFAULT_TRACK_MIX,
      DEFAULT_TRACK_MIX,
      DEFAULT_TRACK_MIX,
    ]);
  });

  it("falls back to the default rather than throwing on a corrupt column", () => {
    expect(parseTrackMix("{not json", 2)).toEqual([DEFAULT_TRACK_MIX, DEFAULT_TRACK_MIX]);
  });

  it("pads a mix saved before the file gained tracks", () => {
    const json = JSON.stringify([{ level: 0.2, muted: false, soloed: false }]);
    expect(parseTrackMix(json, 3)).toEqual([
      { level: 0.2, muted: false, soloed: false },
      DEFAULT_TRACK_MIX,
      DEFAULT_TRACK_MIX,
    ]);
  });

  it("drops channels for tracks the file no longer has", () => {
    const json = JSON.stringify([
      { level: 0.2, muted: false, soloed: false },
      { level: 0.3, muted: false, soloed: false },
    ]);
    expect(parseTrackMix(json, 1)).toEqual([{ level: 0.2, muted: false, soloed: false }]);
  });

  it("clamps a level outside 0-1 into range", () => {
    const json = JSON.stringify([
      { level: 4, muted: false, soloed: false },
      { level: -1, muted: false, soloed: false },
    ]);
    expect(parseTrackMix(json, 2)).toEqual([
      { level: 1, muted: false, soloed: false },
      { level: 0, muted: false, soloed: false },
    ]);
  });

  it("repairs a channel whose fields are missing or the wrong type", () => {
    const json = JSON.stringify([{ level: "loud", muted: 1 }]);
    expect(parseTrackMix(json, 1)).toEqual([DEFAULT_TRACK_MIX]);
  });

  it("falls back to the default when the column holds something other than a list", () => {
    expect(parseTrackMix(JSON.stringify({ level: 0.5 }), 1)).toEqual([DEFAULT_TRACK_MIX]);
  });
});

describe("serializeTrackMix", () => {
  it("encodes a touched mix", () => {
    const mix = [
      { level: 0.5, muted: false, soloed: false },
      { level: 1, muted: false, soloed: false },
    ];
    expect(JSON.parse(serializeTrackMix(mix)!)).toEqual(mix);
  });

  it("stores nothing when every track is still at the default", () => {
    expect(serializeTrackMix([DEFAULT_TRACK_MIX, DEFAULT_TRACK_MIX])).toBeNull();
  });

  it("stores a mix whose only change is a mute", () => {
    const mix = [DEFAULT_TRACK_MIX, { level: 1, muted: true, soloed: false }];
    expect(serializeTrackMix(mix)).not.toBeNull();
  });

  it("stores a mix whose only change is a solo", () => {
    const mix = [DEFAULT_TRACK_MIX, { level: 1, muted: false, soloed: true }];
    expect(serializeTrackMix(mix)).not.toBeNull();
  });

  it("round-trips through parseTrackMix unchanged", () => {
    const mix = [
      { level: 0.25, muted: true, soloed: false },
      { level: 1, muted: false, soloed: true },
    ];
    expect(parseTrackMix(serializeTrackMix(mix), 2)).toEqual(mix);
  });
});

describe("trackMixColumn", () => {
  it("encodes a mix sent by the client", () => {
    const mix = [
      { level: 0.5, muted: false, soloed: false },
      { level: 1, muted: true, soloed: false },
    ];
    expect(parseTrackMix(trackMixColumn(mix), 2)).toEqual(mix);
  });

  it("clears the column when the client sends null", () => {
    expect(trackMixColumn(null)).toBeNull();
  });

  it("clears the column when the client sends a mix back at its defaults", () => {
    expect(trackMixColumn([DEFAULT_TRACK_MIX, DEFAULT_TRACK_MIX])).toBeNull();
  });

  it("stores nothing rather than junk when the body is not a list", () => {
    expect(trackMixColumn("0.5")).toBeNull();
    expect(trackMixColumn({ level: 0.5 })).toBeNull();
  });

  it("normalises a channel the client got wrong instead of storing it", () => {
    // Whatever reaches the column has already been through the same
    // validation a read applies, so a bad client cannot poison the row.
    const stored = trackMixColumn([{ level: 7, muted: "yes", soloed: false }]);
    expect(parseTrackMix(stored, 1)).toEqual([DEFAULT_TRACK_MIX]);
  });
});

describe("toTrackMix", () => {
  it("gathers the mixer's three parallel arrays into one channel per track", () => {
    expect(toTrackMix([0.5, 1], [false, true], [true, false])).toEqual([
      { level: 0.5, muted: false, soloed: true },
      { level: 1, muted: true, soloed: false },
    ]);
  });

  it("treats a missing flag as off rather than undefined", () => {
    // The arrays are sized from trackNames and only ever drift if a file is
    // re-imported, but an undefined would be stored as a null channel.
    expect(toTrackMix([0.5], [], [])).toEqual([{ level: 0.5, muted: false, soloed: false }]);
  });
});

describe("channelsOf", () => {
  it("reads a song's saved mix into one channel per track", () => {
    const saved = [{ level: 0.3, muted: true, soloed: false }];
    expect(channelsOf(saved, 2)).toEqual([
      { level: 0.3, muted: true, soloed: false },
      DEFAULT_TRACK_MIX,
    ]);
  });

  it("opens all-audible when the song carries no mix at all", () => {
    expect(channelsOf(undefined, 2)).toEqual([DEFAULT_TRACK_MIX, DEFAULT_TRACK_MIX]);
  });
});
