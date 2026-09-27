import { describe, it, expect } from "vitest";
import { codepointToUtf16, sliceCp, spliceCp, normalizeNewlines } from "./offsets";

const GUITAR = "\u{1F3B8}"; // 🎸 — one codepoint, two UTF-16 units

describe("codepointToUtf16", () => {
  it("is the identity for BMP-only text", () => {
    expect(codepointToUtf16("abcdef", 3)).toBe(3);
  });

  it("shifts past each non-BMP character", () => {
    const t = `a${GUITAR}bc`;         // cp: a=0, 🎸=1, b=2, c=3
    expect(codepointToUtf16(t, 0)).toBe(0);
    expect(codepointToUtf16(t, 1)).toBe(1);
    expect(codepointToUtf16(t, 2)).toBe(3); // b sits at UTF-16 index 3
    expect(codepointToUtf16(t, 3)).toBe(4);
  });

  it("clamps past the end", () => {
    expect(codepointToUtf16("ab", 99)).toBe(2);
  });
});

describe("sliceCp", () => {
  it("slices inclusively by codepoint", () => {
    expect(sliceCp("3.6.8 5.6", 0, 4)).toBe("3.6.8");
  });

  it("slices correctly after a non-BMP character", () => {
    const t = `${GUITAR} 3.6.8`;      // cp: 🎸=0, space=1, '3'=2 … '8'=6
    expect(sliceCp(t, 2, 6)).toBe("3.6.8");
  });
});

describe("spliceCp", () => {
  it("replaces an inclusive codepoint range", () => {
    expect(spliceCp("3.6.8 5.6", 0, 4, "7.5")).toBe("7.5 5.6");
  });

  it("leaves text outside the range byte-identical after a non-BMP character", () => {
    const t = `\\title "${GUITAR}"\n.\n3.6.8 5.6\n`;
    const cpStart = [...t].findIndex((_, i, a) => a.slice(i, i + 5).join("") === "3.6.8");
    const out = spliceCp(t, cpStart, cpStart + 4, "9.6");
    expect(out).toBe(`\\title "${GUITAR}"\n.\n9.6 5.6\n`);
  });
});

describe("normalizeNewlines", () => {
  it("converts CRLF and lone CR to LF", () => {
    expect(normalizeNewlines("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
  });
});
