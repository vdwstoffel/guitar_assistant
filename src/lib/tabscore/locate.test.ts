import { describe, it, expect } from "vitest";
import { parseTex } from "./parse";
import { findBeatNode, beatSpliceRange, countBars, countBeats, clampCaret } from "./locate";
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

  it("clamps a caret past the end back into range", () => {
    const { scoreNode } = parseTex(TEX);
    expect(clampCaret(scoreNode, { barIndex: 9, beatIndex: 9, string: 6 }))
      .toEqual({ barIndex: 1, beatIndex: 1, string: 6 });
    expect(clampCaret(scoreNode, { barIndex: -1, beatIndex: -1, string: 9 }))
      .toEqual({ barIndex: 0, beatIndex: 0, string: 6 });
  });
});
