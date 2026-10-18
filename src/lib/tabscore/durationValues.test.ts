import { describe as group, it, expect } from "vitest";
import { add, frac, ZERO } from "./fraction";
import {
  describe, fill, largestPlainAtMost, lengthOf, plain, valueOf, valueOfBeat, type NoteValue,
} from "./durationValues";

const v = (duration: number, dots: 0 | 1 | 2 = 0, tuplet: number | null = null): NoteValue => ({ duration, dots, tuplet });

group("lengthOf", () => {
  it("reads alphaTab's tuplet ratios: {tu 3} is 3:2, {tu 5} 5:4, {tu 9} 9:8", () => {
    expect(lengthOf(v(8, 0, 3))).toEqual(frac(1, 12));
    expect(lengthOf(v(16, 0, 5))).toEqual(frac(1, 20));
    expect(lengthOf(v(32, 0, 9))).toEqual(frac(1, 36));
  });
});

group("valueOfBeat", () => {
  it("reads duration, dots and tuplet off an alphaTab beat", () => {
    expect(valueOfBeat({ duration: 8, dots: 1, tupletNumerator: -1 })).toEqual(v(8, 1));
    expect(valueOfBeat({ duration: 16, dots: 0, tupletNumerator: 3 })).toEqual(v(16, 0, 3));
  });
});

group("valueOf", () => {
  it("recognises plain, dotted and double-dotted values", () => {
    expect(valueOf(frac(1, 4))).toEqual(v(4));
    expect(valueOf(frac(3, 16))).toEqual(v(8, 1));
    expect(valueOf(frac(7, 16))).toEqual(v(4, 2));
  });

  it("recognises tuplets, triplets first", () => {
    expect(valueOf(frac(1, 12))).toEqual(v(8, 0, 3));
    expect(valueOf(frac(1, 20))).toEqual(v(16, 0, 5));
    expect(valueOf(frac(1, 28))).toEqual(v(16, 0, 7));
  });

  it("tries the preferred tuplet first", () => {
    // 1/24 is a triplet 16th, and also a sextuplet 16th (6:4).
    expect(valueOf(frac(1, 24))).toEqual(v(16, 0, 3));
    expect(valueOf(frac(1, 24), 6)).toEqual(v(16, 0, 6));
  });

  it("is null for what no single value is", () => {
    expect(valueOf(frac(5, 16))).toBeNull();
    expect(valueOf(frac(5, 96))).toBeNull();
  });
});

group("largestPlainAtMost", () => {
  it("is the longest plain value that fits", () => {
    expect(largestPlainAtMost(frac(9, 16))).toEqual(v(2));
    expect(largestPlainAtMost(frac(5, 96))).toEqual(v(32));
    expect(largestPlainAtMost(frac(1, 128))).toBeNull();
  });
});

group("fill", () => {
  it("uses the bar's own value when the gap is a whole number of it", () => {
    expect(fill(frac(3, 16), { unit: 4, uniform: v(16) })).toEqual([v(16), v(16), v(16)]);
    expect(fill(frac(3, 8), { unit: 4, uniform: v(8, 1) })).toEqual([v(8, 1), v(8, 1)]);
    expect(fill(frac(1, 2), { unit: 4, uniform: v(8, 0, 3) })).toHaveLength(6);
  });

  it("otherwise goes longest first from the beat unit down", () => {
    expect(fill(frac(3, 4), { unit: 4 })).toEqual([v(4), v(4), v(4)]);
    expect(fill(frac(5, 16), { unit: 4 })).toEqual([v(4), v(16)]);
    expect(fill(frac(3, 8), { unit: 8 })).toEqual([v(8), v(8), v(8)]);
    expect(fill(frac(5, 16), { unit: 4, uniform: v(8) })).toEqual([v(4), v(16)]);
  });

  it("completes an unfinished tuplet group with its own value first", () => {
    // one triplet 8th written: two more finish the group, then plain rests
    expect(fill(frac(5, 12), { unit: 4, tuplet: v(8, 0, 3) })).toEqual([v(8, 0, 3), v(8, 0, 3), v(4)]);
  });

  it("is null when nothing it may use adds up", () => {
    expect(fill(frac(1, 24), { unit: 4 })).toBeNull();
    expect(fill(frac(1, 48), { unit: 4, tuplet: v(8, 0, 3) })).toBeNull();
    expect(fill(frac(-1, 4), { unit: 4 })).toBeNull();
  });

  it("is empty for nothing", () => {
    expect(fill(frac(0), { unit: 4 })).toEqual([]);
  });

  it("always adds up to what it was asked for", () => {
    for (const [n, d] of [[1, 4], [7, 8], [15, 16], [3, 64], [1, 1]]) {
      const total = fill(frac(n, d), { unit: 4 })!.reduce((sum, value) => add(sum, lengthOf(value)), ZERO);
      expect(total).toEqual(frac(n, d));
    }
  });
});

group("describe", () => {
  it("names a single value", () => {
    expect(describe(frac(1, 4))).toBe("a quarter");
    expect(describe(frac(1, 8))).toBe("an 8th");
    expect(describe(frac(1, 16))).toBe("a 16th");
    expect(describe(frac(3, 16))).toBe("a dotted 8th");
    expect(describe(frac(7, 8))).toBe("a double-dotted half");
    expect(describe(frac(1, 12))).toBe("a triplet 8th");
  });

  it("names a sum, longest first", () => {
    expect(describe(frac(5, 16))).toBe("a quarter and a 16th");
    expect(describe(frac(13, 32))).toBe("a quarter, an 8th and a 32nd");
    expect(describe(frac(9, 4))).toBe("2 wholes and a quarter");
  });

  it("is null for an amount neither says", () => {
    expect(describe(frac(5, 48))).toBeNull();
    expect(describe(frac(0))).toBeNull();
  });
});

group("plain", () => {
  it("is a value with no dot and no tuplet", () => {
    expect(plain(8)).toEqual(v(8));
  });
});
