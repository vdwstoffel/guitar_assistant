import { describe, it, expect } from "vitest";
import { isBarFull } from "./barCapacity";
import { parseTex } from "./parse";

const score = (body: string) => parseTex(`\\tempo 120\n.\n${body}\n`).score;

describe("isBarFull", () => {
  it("is false for an empty-ish bar", () => {
    expect(isBarFull(score("3.6.4"), 0)).toBe(false);
  });

  it("is false when a 4/4 bar is part-filled", () => {
    expect(isBarFull(score("3.6.8 5.6 7.6 8.6"), 0)).toBe(false); // four eighths = half
  });

  it("is true when four quarters fill 4/4", () => {
    expect(isBarFull(score("3.6.4 5.6 7.6 8.6"), 0)).toBe(true);
  });

  it("is true when eight eighths fill 4/4 — the reported case", () => {
    expect(isBarFull(score("0.6.8 0.6 5.6 0.6 3.6 5.6 0.6 3.6"), 0)).toBe(true);
  });

  it("is true when the bar is over-full", () => {
    expect(isBarFull(score("0.6.8 0.6 5.6 0.6 3.6 5.6 0.6 3.6 9.6 9.6"), 0)).toBe(true);
  });

  it("measures in ticks, so mixed durations work", () => {
    // half + quarter + two eighths = 4/4 exactly
    expect(isBarFull(score("3.6.2 5.6.4 7.6.8 8.6.8"), 0)).toBe(true);
    expect(isBarFull(score("3.6.2 5.6.4 7.6.8"), 0)).toBe(false);
  });

  it("respects a non-4/4 time signature", () => {
    const s = parseTex("\\tempo 120\n\\ts 3 4\n.\n3.6.4 5.6 7.6\n").score;
    expect(isBarFull(s, 0)).toBe(true); // three quarters fills 3/4
    const part = parseTex("\\tempo 120\n\\ts 3 4\n.\n3.6.4 5.6\n").score;
    expect(isBarFull(part, 0)).toBe(false);
  });

  it("looks at the bar it is asked about, not the first one", () => {
    const s = score("3.6.4 5.6 7.6 8.6 | 9.6.4");
    expect(isBarFull(s, 0)).toBe(true);
    expect(isBarFull(s, 1)).toBe(false);
  });

  it("returns false rather than throwing on nonsense input", () => {
    expect(isBarFull(null, 0)).toBe(false);
    expect(isBarFull(score("3.6.4"), 99)).toBe(false);
  });
});
