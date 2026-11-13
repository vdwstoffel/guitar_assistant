import { describe, expect, it } from "vitest";
import { INTERVAL_REFERENCE } from "../intervalReference";
import {
  chordIndexAtBar,
  chordName,
  fretboardCells,
  intervalFeel,
  intervalLabel,
  suggestedChords,
  type ProgressionChord,
} from "./theory";

const std = [40, 45, 50, 55, 59, 64];

describe("chordName", () => {
  it("suffixes by quality", () => {
    expect(chordName({ root: "A", quality: "Minor", bars: 1 })).toBe("Am");
    expect(chordName({ root: "A", quality: "Power", bars: 1 })).toBe("A5");
    expect(chordName({ root: "B", quality: "Diminished", bars: 1 })).toBe("Bdim");
  });
});

describe("intervalLabel", () => {
  it("names the interval above the first pitch class", () => {
    expect(intervalLabel(9, 0)).toBe("b3");
    expect(intervalLabel(5, 9)).toBe("3");
    expect(intervalLabel(9, 3)).toBe("b5");
  });
});

describe("chordIndexAtBar", () => {
  const c = (root: string, bars: number): ProgressionChord => ({ root, quality: "Major", bars });
  it("loops over the progression", () => {
    const chords = [c("A", 1), c("F", 1), c("C", 2)];
    expect([0, 1, 2, 3, 4].map((b) => chordIndexAtBar(chords, b))).toEqual([0, 1, 2, 2, 0]);
  });
  it("is null when empty", () => {
    expect(chordIndexAtBar([], 3)).toBeNull();
  });
});

describe("fretboardCells", () => {
  const base = { tuning: std, keyRoot: "A", scale: "Minor", referenceRoot: "A", chordPcs: [9, 0, 4] };
  it("marks reference root and labels", () => {
    const cells = fretboardCells(base);
    const at = (s: number, f: number) => cells.find((x) => x.string === s && x.fret === f);
    expect(at(0, 5)).toMatchObject({ noteName: "A", label: "1", chordTone: true, isReferenceRoot: true });
    expect(at(0, 0)?.label).toBe("5");
    expect(at(0, 2)).toBeUndefined();
  });
  it("keeps chord tones outside the scale", () => {
    const cells = fretboardCells({ ...base, referenceRoot: "A#", chordPcs: [10, 2, 5] });
    expect(cells.find((x) => x.pc === 10)).toMatchObject({ inScale: false, chordTone: true, label: "1" });
  });
});

describe("suggestedChords", () => {
  it("offers power chords then triads, without duplicates", () => {
    const s = suggestedChords("A", "Minor");
    expect(s.slice(0, 2)).toMatchObject([
      { root: "A", quality: "Power" },
      { root: "A", quality: "Minor" },
    ]);
    expect(s).toContainEqual({ root: "F", quality: "Major", bars: 1 });
    expect(s).toContainEqual({ root: "B", quality: "Diminished", bars: 1 });
    const keys = s.map((x) => `${x.root}:${x.quality}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("intervalFeel", () => {
  it("reads the reference entry", () => {
    expect(intervalFeel(8)).toBe(INTERVAL_REFERENCE.find((i) => i.semitones === 8)!.soundDescription);
  });
});
