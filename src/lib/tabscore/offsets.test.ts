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
    expect(codepointToUtf16(`a${GUITAR}`, 99)).toBe(3);
  });

  it("answers for each text, whichever text it converted last", () => {
    const astral = `a${GUITAR}bc`;
    expect(codepointToUtf16("abcdef", 3)).toBe(3);
    expect(codepointToUtf16(astral, 3)).toBe(4);
    expect(codepointToUtf16("abcdef", 3)).toBe(3);
    expect(codepointToUtf16(astral, 2)).toBe(3);
  });

  it("answers for each of several texts of one length that differ only late, or in the middle", () => {
    // Swapping two BMP characters for an astral one keeps the length. A cache
    // keyed on less than the whole text — its length, its first characters,
    // its first and last — would hand one of these another's table.
    const plain = `${"3.6.8 5.6 7.6 8.6 | ".repeat(6)}abcdefgh`;
    const withGuitar = (at: number) => plain.slice(0, at) + GUITAR + plain.slice(at + 2);
    const texts = [plain, ...[0, 30, 60, plain.length - 5, plain.length - 2].map(withGuitar)];
    for (const text of texts) expect(text).toHaveLength(plain.length);

    // the UTF-16 length of the text's first `cp` codepoints
    const reference = (text: string, cp: number) => [...text].slice(0, Math.max(cp, 0)).join("").length;
    // an answer for every codepoint index, from just below the start to just past the end
    const sweep = (text: string, answer: (text: string, cp: number) => number) =>
      Array.from({ length: [...text].length + 5 }, (_, i) => answer(text, i - 1));

    texts.forEach((first, i) =>
      texts.forEach((second, j) => {
        codepointToUtf16(first, 1); // the cache now holds the first's table
        expect(sweep(second, codepointToUtf16), `text ${j} after text ${i}`).toEqual(sweep(second, reference));
      }),
    );
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
