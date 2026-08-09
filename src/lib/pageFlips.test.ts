import { describe, it, expect } from "vitest";
import { resolvePageFlip, validatePageFlipInput } from "./pageFlips";

describe("resolvePageFlip", () => {
  const flips = [
    { timestamp: 10, pdfPage: 2 },
    { timestamp: 30, pdfPage: 3 },
    { timestamp: 20, pdfPage: 4 }, // intentionally unsorted
  ];

  it("returns fallback before any flip is reached", () => {
    expect(resolvePageFlip(flips, 5, 0, 1)).toBe(1);
    expect(resolvePageFlip(flips, 5, 0, null)).toBe(null);
  });

  it("returns the page of the latest passed flip (handles unsorted input)", () => {
    expect(resolvePageFlip(flips, 22, 0, 1)).toBe(4); // 10 and 20 passed, 20 is latest
    expect(resolvePageFlip(flips, 35, 0, 1)).toBe(3);
  });

  it("applies anticipation so a flip triggers early", () => {
    expect(resolvePageFlip(flips, 9, 0, 1)).toBe(1);   // not yet at t=10
    expect(resolvePageFlip(flips, 9, 1, 1)).toBe(2);   // 1s early -> flip fires
  });

  it("returns fallback for an empty list", () => {
    expect(resolvePageFlip([], 100, 1, 7)).toBe(7);
  });
});

describe("validatePageFlipInput", () => {
  it("accepts a valid flip", () => {
    expect(validatePageFlipInput({ timestamp: 12.5, pdfPage: 3 })).toEqual({
      ok: true, value: { timestamp: 12.5, pdfPage: 3 },
    });
  });
  it("rejects non-integer or <1 pages", () => {
    expect(validatePageFlipInput({ timestamp: 1, pdfPage: 0 }).ok).toBe(false);
    expect(validatePageFlipInput({ timestamp: 1, pdfPage: 2.5 }).ok).toBe(false);
  });
  it("rejects bad timestamps and non-objects", () => {
    expect(validatePageFlipInput({ timestamp: -1, pdfPage: 1 }).ok).toBe(false);
    expect(validatePageFlipInput({ timestamp: Infinity, pdfPage: 1 }).ok).toBe(false);
    expect(validatePageFlipInput(null).ok).toBe(false);
  });
});
