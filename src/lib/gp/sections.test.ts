import { describe, it, expect } from "vitest";
import { normalizeBarRange } from "./sections";

describe("normalizeBarRange", () => {
  it("passes a sane range through untouched", () => {
    expect(normalizeBarRange({ startBar: 8, endBar: 23 }, 351)).toEqual({ startBar: 8, endBar: 23 });
  });

  it("accepts a single bar", () => {
    expect(normalizeBarRange({ startBar: 4, endBar: 4 }, 351)).toEqual({ startBar: 4, endBar: 4 });
  });

  it("swaps a range dragged right to left", () => {
    // Dragging backwards is a normal gesture, not an error.
    expect(normalizeBarRange({ startBar: 20, endBar: 5 }, 351)).toEqual({ startBar: 5, endBar: 20 });
  });

  it("clamps a range that runs past the end of the song", () => {
    expect(normalizeBarRange({ startBar: 340, endBar: 999 }, 351)).toEqual({ startBar: 340, endBar: 350 });
  });

  it("clamps a negative start", () => {
    expect(normalizeBarRange({ startBar: -5, endBar: 10 }, 351)).toEqual({ startBar: 0, endBar: 10 });
  });

  it("refuses a range entirely outside the song", () => {
    expect(normalizeBarRange({ startBar: 400, endBar: 500 }, 351)).toBeNull();
  });

  it("refuses non-integers and non-numbers", () => {
    expect(normalizeBarRange({ startBar: 1.5, endBar: 4 }, 351)).toBeNull();
    expect(normalizeBarRange({ startBar: NaN, endBar: 4 }, 351)).toBeNull();
  });

  it("refuses anything when the song has no bars", () => {
    expect(normalizeBarRange({ startBar: 0, endBar: 0 }, 0)).toBeNull();
  });
});
