import { describe, it, expect } from "vitest";
import { setFret, clearNote } from "./setFret";

const TEX = "\\tempo 120\n.\n3.6.8 5.6 7.6 | 7.6.4 r.4\n";
const at = (barIndex: number, beatIndex: number, string: number) => ({ barIndex, beatIndex, string });

describe("setFret", () => {
  it("replaces the fret on an existing note, keeping the duration", () => {
    const r = setFret(TEX, at(0, 0, 6), 9)!;
    expect(r.text).toBe("\\tempo 120\n.\n9.6.8 5.6 7.6 | 7.6.4 r.4\n");
  });

  it("does not merge into the following beat", () => {
    const r = setFret(TEX, at(0, 0, 6), 5)!;
    expect(r.text).toContain("5.6.8 5.6");
    expect(r.text).not.toContain("5.6.85.6");
  });

  it("adds a note on a different string, making a chord", () => {
    const r = setFret(TEX, at(0, 1, 5), 7)!;
    expect(r.text).toContain("(5.6 7.5)");
  });

  it("orders a chord correctly when the new note is on a higher string number", () => {
    // Existing note on string 1; adding string 6 must place the NEW note first.
    const tex = "\\tempo 120\n.\n3.1.8 5.6 7.6 | 7.6.4 r.4\n";
    const r = setFret(tex, { barIndex: 0, beatIndex: 0, string: 6 }, 9)!;
    expect(r.text).toContain("(9.6 3.1)");
  });

  it("turns a rest into a note", () => {
    const r = setFret(TEX, at(1, 1, 6), 3)!;
    expect(r.text).toContain("3.6.4");
    expect(r.text).not.toContain("r.4");
  });

  it("preserves comments and formatting elsewhere byte-for-byte", () => {
    const tex = "\\tempo 120\n.\n// riff\n3.6.8   5.6 7.6 | 7.6.4 r.4\n";
    const r = setFret(tex, at(0, 0, 6), 9)!;
    expect(r.text).toBe("\\tempo 120\n.\n// riff\n9.6.8   5.6 7.6 | 7.6.4 r.4\n");
  });

  it("rejects an out-of-range fret", () => {
    expect(setFret(TEX, at(0, 0, 6), -1)).toBeNull();
    expect(setFret(TEX, at(0, 0, 6), 25)).toBeNull();
  });

  it("accepts the boundary frets 0 and 24", () => {
    const tex = "\\tempo 120\n.\n3.6.8 5.6 7.6 | 7.6.4 r.4\n";
    expect(setFret(tex, { barIndex: 0, beatIndex: 0, string: 6 }, 0)).not.toBeNull();
    expect(setFret(tex, { barIndex: 0, beatIndex: 0, string: 6 }, 24)).not.toBeNull();
  });

  it("returns null for an out-of-range caret", () => {
    expect(setFret(TEX, at(9, 0, 6), 3)).toBeNull();
  });
});

describe("clearNote", () => {
  it("removes one note from a chord", () => {
    const tex = "\\tempo 120\n.\n(3.6 5.5).8 9.6\n";
    const r = clearNote(tex, at(0, 0, 5))!;
    expect(r.text).toContain("3.6.8");
    expect(r.text).not.toContain("5.5");
  });

  it("turns the last note of a beat into a rest", () => {
    const r = clearNote(TEX, at(0, 0, 6))!;
    expect(r.text).toContain("r.8");
  });

  it("is a no-op returning null when the string is already empty", () => {
    expect(clearNote(TEX, at(0, 0, 1))).toBeNull();
  });
});
