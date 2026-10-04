import { describe, it, expect } from "vitest";
import { validateGpParent, isStandaloneGpSong } from "./parentLink";

describe("validateGpParent", () => {
  it("accepts a tab on a jam track", () => {
    expect(validateGpParent({ jamTrackId: "jam-1", trackId: null })).toBeNull();
  });

  it("accepts a tab on a lesson track", () => {
    expect(validateGpParent({ jamTrackId: null, trackId: "track-1" })).toBeNull();
  });

  it("accepts a standalone import, which has neither parent", () => {
    expect(validateGpParent({ jamTrackId: null, trackId: null })).toBeNull();
    expect(validateGpParent({})).toBeNull();
  });

  it("refuses both parents at once", () => {
    // Nothing in the UI can produce this, which is exactly why the API has
    // to say so rather than storing a row that belongs in two places.
    expect(validateGpParent({ jamTrackId: "jam-1", trackId: "track-1" })).toMatch(/not both/);
  });

  it("treats an empty string as no parent, not as a parent", () => {
    // FormData yields "" for a field that was appended empty.
    expect(validateGpParent({ jamTrackId: "", trackId: "track-1" })).toBeNull();
  });
});

describe("isStandaloneGpSong", () => {
  it("is true only when neither parent is set", () => {
    expect(isStandaloneGpSong({ jamTrackId: null, trackId: null })).toBe(true);
    expect(isStandaloneGpSong({ jamTrackId: "jam-1", trackId: null })).toBe(false);
    // The case this function exists for: before it, the Jam Tracks list
    // filtered on jamTrackId alone, so every lesson import appeared there too.
    expect(isStandaloneGpSong({ jamTrackId: null, trackId: "track-1" })).toBe(false);
  });
});
