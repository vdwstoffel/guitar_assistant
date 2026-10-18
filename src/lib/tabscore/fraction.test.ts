import { describe, it, expect } from "vitest";
import { frac, ZERO, add, sub, mul, div, cmp, fromDuration } from "./fraction";

describe("frac", () => {
  it("reduces to lowest terms with a positive denominator", () => {
    expect(frac(2, 8)).toEqual({ n: 1, d: 4 });
    expect(frac(3, -6)).toEqual({ n: -1, d: 2 });
    expect(frac(0, 5)).toEqual(ZERO);
  });

  it("refuses what is not a fraction", () => {
    expect(() => frac(1, 0)).toThrow();
    expect(() => frac(0.5, 2)).toThrow();
  });

  it("never returns negative zero, which toEqual tells apart from zero", () => {
    expect(Object.is(frac(0, -5).n, 0)).toBe(true);
    expect(Object.is(frac(-0).n, 0)).toBe(true);
    expect(Object.is(mul(frac(-1, 2), ZERO).n, 0)).toBe(true);
    expect(mul(frac(-1, 2), ZERO)).toEqual(ZERO);
  });
});

describe("arithmetic", () => {
  it("adds, subtracts, multiplies and divides exactly", () => {
    expect(add(frac(1, 4), frac(1, 8))).toEqual(frac(3, 8));
    expect(sub(frac(1, 4), frac(1, 3))).toEqual(frac(-1, 12));
    expect(mul(frac(1, 8), frac(2, 3))).toEqual(frac(1, 12));
    expect(div(frac(3, 4), frac(1, 8))).toEqual(frac(6));
  });

  it("compares", () => {
    expect(cmp(frac(1, 3), frac(1, 4))).toBe(1);
    expect(cmp(frac(2, 8), frac(1, 4))).toBe(0);
    expect(cmp(frac(-1, 12), ZERO)).toBe(-1);
  });
});

describe("fromDuration", () => {
  it("is 1/duration for a plain value", () => {
    expect(fromDuration(4)).toEqual(frac(1, 4));
    expect(fromDuration(64)).toEqual(frac(1, 64));
  });

  it("adds half for a dot and three quarters for two", () => {
    expect(fromDuration(8, 1)).toEqual(frac(3, 16));
    expect(fromDuration(4, 2)).toEqual(frac(7, 16));
  });

  it("scales by the tuplet: three triplet 8ths are one quarter", () => {
    expect(fromDuration(8, 0, 3, 2)).toEqual(frac(1, 12));
    expect(fromDuration(16, 0, 7, 4)).toEqual(frac(1, 28));
  });

  it("treats -1 as no tuplet, as alphaTab writes it", () => {
    expect(fromDuration(8, 0, -1, -1)).toEqual(frac(1, 8));
  });

  it("reads alphaTab's double and quadruple whole, written `.-2` and `.-4`, as two and four wholes", () => {
    expect(fromDuration(-2)).toEqual(frac(2));
    expect(fromDuration(-4)).toEqual(frac(4));
    expect(fromDuration(-2, 1)).toEqual(frac(3));
  });
});
