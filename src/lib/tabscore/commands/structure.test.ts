import { describe, it, expect } from "vitest";
import { insertBeat, deleteBeat, addBar, deleteBar } from "./structure";
import { parseTex } from "../parse";
import { countBars, countBeats } from "../locate";

const TEX = "\\tempo 120\n.\n3.6.8 5.6 7.6 | 7.6.4 r.4\n";
const at = (barIndex: number, beatIndex: number, string = 6) => ({ barIndex, beatIndex, string });
const shape = (t: string) => {
  const { scoreNode } = parseTex(t);
  return { bars: countBars(scoreNode), beats: countBeats(scoreNode) };
};

describe("insertBeat", () => {
  it("adds a rest after the caret and moves the caret onto it", () => {
    const r = insertBeat(TEX, at(0, 0))!;
    expect(shape(r.text)).toEqual({ bars: 2, beats: 6 });
    expect(r.caret).toEqual(at(0, 1));
  });
});

describe("deleteBeat", () => {
  it("removes the beat and keeps the caret in range", () => {
    const r = deleteBeat(TEX, at(0, 1))!;
    expect(shape(r.text)).toEqual({ bars: 2, beats: 4 });
  });

  it("CLAMPS the caret when the last beat in a bar is deleted", () => {
    const r = deleteBeat(TEX, at(1, 1))!;      // bar 1 had 2 beats; caret was on the last
    expect(shape(r.text)).toEqual({ bars: 2, beats: 4 });
    expect(r.caret).toEqual(at(1, 0));          // not left pointing at index 1
  });

  it("refuses to empty a bar completely", () => {
    const one = "\\tempo 120\n.\n3.6.8\n";
    expect(deleteBeat(one, at(0, 0))).toBeNull();
  });

  it("deletes a beat cleanly when separators are wider than one space", () => {
    const multi = "\\tempo 120\n.\n3.6.8   5.6   7.6 | 7.6.4 r.4\n";
    const r = deleteBeat(multi, at(0, 1))!;
    expect(r.text).toBe("\\tempo 120\n.\n3.6.8   7.6 | 7.6.4 r.4\n");
  });
});

describe("addBar", () => {
  it("appends a bar of rests", () => {
    const r = addBar(TEX, at(1, 1))!;
    expect(shape(r.text).bars).toBe(3);
    expect(r.caret.barIndex).toBe(2);
  });
});

describe("deleteBar", () => {
  it("removes a bar and clamps the caret", () => {
    const r = deleteBar(TEX, at(1, 1))!;
    expect(shape(r.text).bars).toBe(1);
    expect(r.caret).toEqual(at(0, 2));
  });

  it("refuses to delete the only bar", () => {
    const one = "\\tempo 120\n.\n3.6.8\n";
    expect(deleteBar(one, at(0, 0))).toBeNull();
  });

  it("deletes a non-last bar without leaving whitespace artifacts", () => {
    const r = deleteBar(TEX, at(0, 0))!;
    expect(shape(r.text)).toEqual({ bars: 1, beats: 2 });
    expect(r.text).toBe("\\tempo 120\n.\n7.6.4 r.4\n");
    expect(r.caret).toEqual(at(0, 0));
  });

  it("deletes a middle bar without leaving a doubled separator", () => {
    const three = "\\tempo 120\n.\n3.6.8 5.6 7.6 | 7.6.4 r.4 | 9.6 8.6\n";
    const r = deleteBar(three, at(1, 0))!;
    expect(shape(r.text)).toEqual({ bars: 2, beats: 5 });
    expect(r.text).toBe("\\tempo 120\n.\n3.6.8 5.6 7.6 | 9.6 8.6\n");
    expect(r.caret).toEqual(at(1, 0));
  });

  it("deletes the last bar cleanly when spacing around the pipe is irregular", () => {
    const wide = "\\tempo 120\n.\n3.6.8 5.6 7.6   |   7.6.4 r.4\n";
    const r = deleteBar(wide, at(1, 0))!;
    expect(r.text).toBe("\\tempo 120\n.\n3.6.8 5.6 7.6\n");
  });

  it("returns null rather than throwing when the adjacent bar has no beats", () => {
    const zero = "\\tempo 120\n.\n3.6.8 | | 5.6\n";
    expect(deleteBar(zero, at(0, 0))).toBeNull();
  });
});
