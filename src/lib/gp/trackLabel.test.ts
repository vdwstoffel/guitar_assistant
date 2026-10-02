import { describe, it, expect } from "vitest";
import { trackLabels } from "./trackLabel";

// The real six-track file this was built against.
const SLAYER = [
  'Jeff Hanneman | Jackson Soloist Custom | Lead Guitar - Distortion Guitar',
  'Tom Araya | Vocals - Clarinet',
  'Kerry King | ESP "Kerry King" Explorer Custom | Clean Guitar - Electric Guitar (clean)',
  'Kerry King | ESP "Kerry King" Explorer Custom | Lead Guitar - Distortion Guitar',
  'Kerry King | B.C. Rich Wave | Bass - Electric Bass (pick)',
  'Dave Lombardo | Tama Starclassic Custom Kit | Drums - Drums',
];

describe("trackLabels", () => {
  it("leads with the instrument, dropping the player and the gear", () => {
    expect(trackLabels(SLAYER)[1]).toBe("Vocals - Clarinet");
    expect(trackLabels(SLAYER)[4]).toBe("Bass - Electric Bass (pick)");
  });

  it("adds the player when two tracks are the same instrument", () => {
    // Hanneman and King BOTH play "Lead Guitar - Distortion Guitar". The
    // instrument alone cannot tell them apart, so the name comes back.
    const out = trackLabels(SLAYER);
    expect(out[0]).toBe("Jeff Hanneman — Lead Guitar - Distortion Guitar");
    expect(out[3]).toBe("Kerry King — Lead Guitar - Distortion Guitar");
  });

  it("leaves the unambiguous ones short even when others collide", () => {
    // King's clean guitar is unique, so it does not pay for the collision.
    expect(trackLabels(SLAYER)[2]).toBe("Clean Guitar - Electric Guitar (clean)");
  });

  it("gives every track a distinct label", () => {
    const out = trackLabels(SLAYER);
    expect(new Set(out).size).toBe(out.length);
  });

  it("falls back to the whole name when even the player collides", () => {
    const twins = [
      "Kerry King | Guitar A | Lead Guitar",
      "Kerry King | Guitar B | Lead Guitar",
    ];
    expect(trackLabels(twins)).toEqual(twins);
  });

  it("leaves plain names alone", () => {
    expect(trackLabels(["Lead", "Rhythm", "Bass"])).toEqual(["Lead", "Rhythm", "Bass"]);
  });

  it("copes with empty segments and an empty list", () => {
    expect(trackLabels([])).toEqual([]);
    expect(trackLabels(["  Guitar |  | Drums  "])).toEqual(["Drums"]);
    expect(trackLabels([""])).toEqual([""]);
  });
});
