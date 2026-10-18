import { describe, it, expect } from "vitest";
import { parseTex } from "./parse";
import { findBeatNode, beatSpliceRange, countBars, countBeats, clampCaret, sameCaret } from "./locate";
import { sliceCp } from "./offsets";

const TEX = "\\tempo 120\n.\n3.6.8 5.6 7.6 | 7.6.4 r.4\n";

describe("locate", () => {
  it("counts bars and beats", () => {
    const { scoreNode } = parseTex(TEX);
    expect(countBars(scoreNode)).toBe(2);
    expect(countBeats(scoreNode)).toBe(5);
  });

  it("finds the beat node at a caret", () => {
    const { scoreNode } = parseTex(TEX);
    const node = findBeatNode(scoreNode, { barIndex: 1, beatIndex: 0, string: 6 });
    expect(node).not.toBeNull();
    expect(sliceCp(TEX, node.start.offset, node.end.offset).trim()).toBe("7.6.4");
  });

  it("returns null for an out-of-range caret", () => {
    const { scoreNode } = parseTex(TEX);
    expect(findBeatNode(scoreNode, { barIndex: 9, beatIndex: 0, string: 6 })).toBeNull();
    expect(findBeatNode(scoreNode, { barIndex: 0, beatIndex: 9, string: 6 })).toBeNull();
  });

  it("TRIMS TRAILING WHITESPACE from the splice range", () => {
    // node.end.offset is inclusive AND swallows the separator; splicing the raw
    // range merges this beat into the next one (3.6.8 + 5.6 -> fret 85).
    const { scoreNode } = parseTex(TEX);
    const raw = findBeatNode(scoreNode, { barIndex: 0, beatIndex: 0, string: 6 });
    const range = beatSpliceRange(TEX, scoreNode, { barIndex: 0, beatIndex: 0, string: 6 })!;
    expect(sliceCp(TEX, raw.start.offset, raw.end.offset)).toBe("3.6.8 "); // raw includes the space
    expect(sliceCp(TEX, range.cpStart, range.cpEnd)).toBe("3.6.8");        // trimmed does not
  });

  it("trims a bar line written straight after the beat, with no space before it", () => {
    // `8.6|9.6.4`: alphaTab's node for the 8 ends on the `|`; splicing it would swallow the bar line
    const text = "\\tempo 120\n.\n3.6.4 5.6 7.6 8.6|9.6.4 5.6 7.6 8.6| 3.6.1\n";
    const { scoreNode } = parseTex(text);
    const source = (barIndex: number, beatIndex: number) => {
      const range = beatSpliceRange(text, scoreNode, { barIndex, beatIndex })!;
      return sliceCp(text, range.cpStart, range.cpEnd);
    };
    expect([source(0, 3), source(1, 0), source(1, 3), source(2, 0)]).toEqual(["8.6", "9.6.4", "8.6", "3.6.1"]);
  });

  it("trims a comment written straight after the beat: its first `/` ends up in alphaTab's node", () => {
    const source = (body: string, barIndex: number, beatIndex: number) => {
      const text = `\\tempo 120\n.\n${body}\n`;
      const range = beatSpliceRange(text, parseTex(text).scoreNode, { barIndex, beatIndex })!;
      return sliceCp(text, range.cpStart, range.cpEnd);
    };
    expect(source("3.6.4 r r r// end", 0, 3)).toBe("r");
    expect(source("3.6.4 r r r/* c */ | 5.6.4 r r r", 0, 3)).toBe("r");
    expect(source("3.6.4 r r/* c */ r", 0, 2)).toBe("r");
    expect(source("(3.6 5.5).4/* x */ r r r", 0, 0)).toBe("(3.6 5.5).4");
    expect(source("3.6.4 r r r//", 0, 3)).toBe("r");
    // a comment after a space was never in the node
    expect(source("3.6.4 r r r // end", 0, 3)).toBe("r");
  });

  it("clamps a caret past the end back into range", () => {
    const { scoreNode } = parseTex(TEX);
    expect(clampCaret(scoreNode, { barIndex: 9, beatIndex: 9, string: 6 }))
      .toEqual({ barIndex: 1, beatIndex: 1, string: 6 });
    expect(clampCaret(scoreNode, { barIndex: -1, beatIndex: -1, string: 9 }))
      .toEqual({ barIndex: 0, beatIndex: 0, string: 6 });
  });
});

describe("sameCaret", () => {
  it("compares carets by value: bar, beat and string", () => {
    expect(sameCaret({ barIndex: 1, beatIndex: 2, string: 3 }, { barIndex: 1, beatIndex: 2, string: 3 })).toBe(true);
    expect(sameCaret({ barIndex: 1, beatIndex: 2, string: 3 }, { barIndex: 1, beatIndex: 2, string: 4 })).toBe(false);
    expect(sameCaret({ barIndex: 1, beatIndex: 2, string: 3 }, { barIndex: 1, beatIndex: 3, string: 3 })).toBe(false);
    expect(sameCaret({ barIndex: 1, beatIndex: 2, string: 3 }, { barIndex: 0, beatIndex: 2, string: 3 })).toBe(false);
  });
});
