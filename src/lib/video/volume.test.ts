import { describe, it, expect } from "vitest";
import { DEFAULT_VOLUME, storedToElementVolume, elementToStoredVolume } from "./volume";

describe("storedToElementVolume", () => {
  it("converts a stored percentage to the element's 0-1 range", () => {
    expect(storedToElementVolume(40)).toBeCloseTo(0.4);
  });
  it("treats null as full volume", () => {
    expect(storedToElementVolume(null)).toBe(1);
  });
  it("keeps a stored silence of 0 rather than defaulting it", () => {
    expect(storedToElementVolume(0)).toBe(0);
  });
  it("clamps out-of-range stored values", () => {
    expect(storedToElementVolume(150)).toBe(1);
    expect(storedToElementVolume(-20)).toBe(0);
  });
  it("falls back to full volume for NaN", () => {
    expect(storedToElementVolume(Number.NaN)).toBe(1);
  });
});

describe("elementToStoredVolume", () => {
  it("converts the element's 0-1 range to a stored percentage", () => {
    expect(elementToStoredVolume(0.4)).toBe(40);
  });
  it("rounds to a whole percentage", () => {
    expect(elementToStoredVolume(0.333)).toBe(33);
  });
  it("keeps the extremes", () => {
    expect(elementToStoredVolume(0)).toBe(0);
    expect(elementToStoredVolume(1)).toBe(100);
  });
  it("clamps out-of-range element values", () => {
    expect(elementToStoredVolume(1.5)).toBe(100);
    expect(elementToStoredVolume(-1)).toBe(0);
  });
  it("falls back to the default for NaN", () => {
    expect(elementToStoredVolume(Number.NaN)).toBe(DEFAULT_VOLUME);
  });
});

describe("round trip", () => {
  it("survives a store/restore cycle", () => {
    for (const v of [0, 5, 25, 50, 75, 100]) {
      expect(elementToStoredVolume(storedToElementVolume(v))).toBe(v);
    }
  });
});
