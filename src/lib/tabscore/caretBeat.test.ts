import { describe, it, expect } from "vitest";
import { beatAt, beatNotes, isPreviewable, isAudible } from "./caretBeat";
import { parseTex } from "./parse";

const score = (head: string, body: string) => parseTex(`\\tempo 120\n${head}.\n${body}\n`).score;
const caret = (barIndex: number, beatIndex: number, string = 6) => ({ barIndex, beatIndex, string });
const firstBarBeats = (body: string) => score("", body).tracks[0].staves[0].bars[0].voices[0].beats;

describe("beatAt", () => {
  it("finds the beat by bar and beat index", () => {
    const s = score("", "3.6.4 5.6 7.6 8.6 | 9.6.4 r r r");
    expect(beatAt(s, caret(0, 2)).notes[0].fret).toBe(7);
    expect(beatAt(s, caret(1, 0)).notes[0].fret).toBe(9);
  });

  it("ignores the caret's string — a preview is the whole beat", () => {
    const s = score("", "(0.1 2.2 2.3).4 r r r");
    expect(beatAt(s, caret(0, 0, 1)).notes).toHaveLength(3);
    expect(beatAt(s, caret(0, 0, 6)).notes).toHaveLength(3);
  });

  it("works on 4- and 7-string tunings", () => {
    const bass = score("\\tuning g2 d2 a1 e1\n", "3.4.4 5.1.4 r r");
    expect(beatAt(bass, caret(0, 1, 1)).notes[0].fret).toBe(5);
    const seven = score("\\tuning e4 b3 g3 d3 a2 e2 b1\n", "3.7.4 5.1.4 r r");
    expect(beatAt(seven, caret(0, 0, 7)).notes[0].fret).toBe(3);
  });

  it("is null out of range, or with no score", () => {
    const s = score("", "3.6.4 r r r");
    expect(beatAt(s, caret(0, 9))).toBeNull();
    expect(beatAt(s, caret(5, 0))).toBeNull();
    expect(beatAt(null, caret(0, 0))).toBeNull();
  });
});

describe("isPreviewable", () => {
  it("is true for the one-track, one-voice tabs the editor writes", () => {
    expect(isPreviewable(score("", "3.6.4 r r r"), 0)).toBe(true);
  });

  it("is false for a second voice", () => {
    const s = parseTex("\\tempo 120\n.\n\\voice\n3.6.4 5.6 7.6 8.6\n\\voice\n0.1.2 0.1.2\n").score;
    expect(isPreviewable(s, 0)).toBe(false);
  });

  it("is false for a second track", () => {
    const s = parseTex('\\tempo 120\n.\n\\track "A"\n3.6.4 5.6 7.6 8.6\n\\track "B"\n0.1.1\n').score;
    expect(isPreviewable(s, 0)).toBe(false);
  });

  it("is false with no score, or no such bar", () => {
    expect(isPreviewable(null, 0)).toBe(false);
    expect(isPreviewable(score("", "3.6.4 r r r"), 4)).toBe(false);
  });
});

describe("isAudible", () => {
  it("is false for a rest", () => {
    expect(isAudible(firstBarBeats("r r r r")[0])).toBe(false);
  });

  it("is true for a struck note", () => {
    expect(isAudible(firstBarBeats("3.6.4 r r r")[0])).toBe(true);
  });

  it("is false for a beat of nothing but tied-over notes", () => {
    expect(isAudible(firstBarBeats("3.6.4 -.6.4 5.6.4 r")[1])).toBe(false);
  });

  it("is true for a dead note — struck, just short", () => {
    expect(isAudible(firstBarBeats("x.6.4 r r r")[0])).toBe(true);
  });

  it("is true for the note a legato slide lands on — the preview sounds it", () => {
    expect(isAudible(firstBarBeats("5.3{sl}.4 7.3.4 r r")[1])).toBe(true);
  });

  it("is false for nothing", () => {
    expect(isAudible(null)).toBe(false);
  });
});

describe("beatNotes", () => {
  it("gives each note's string (1 = highest), fret and sounding pitch", () => {
    const s = score("\\tuning e4 b3 g3 d3 a2 e2\n", "5.6.4 3.5.4 r r");
    expect(beatNotes(s, caret(0, 0))).toEqual([{ string: 6, fret: 5, midi: 45 }]);
    expect(beatNotes(s, caret(0, 1))).toEqual([{ string: 5, fret: 3, midi: 48 }]);
  });

  it("is the whole beat, lowest first, whatever string the caret is on", () => {
    const s = score("", "(7.4 7.5 5.6).4 r r r");
    expect(beatNotes(s, caret(0, 0, 1)).map((n) => n.midi)).toEqual([45, 52, 57]);
  });

  it("is empty on a rest, and out of range", () => {
    const s = score("", "5.6.4 r r r");
    expect(beatNotes(s, caret(0, 1))).toEqual([]);
    expect(beatNotes(s, caret(3, 0))).toEqual([]);
    expect(beatNotes(null, caret(0, 0))).toEqual([]);
  });

  it("gives a tied-over note as the fret it sounds", () => {
    const s = score("", "5.6.4 -.6.4 r r");
    expect(beatNotes(s, caret(0, 1))).toEqual([{ string: 6, fret: 5, midi: 45 }]);
  });

  it("leaves out a dead note: it has no pitch", () => {
    expect(beatNotes(score("", "x.6.4 r r r"), caret(0, 0))).toEqual([]);
    expect(beatNotes(score("", "(x.6 7.5).4 r r r"), caret(0, 0)).map((n) => n.fret)).toEqual([7]);
  });

  it("counts strings from the top on a bass, and sounds a capo", () => {
    const bass = score("\\tuning g2 d2 a1 e1\n", "5.4.4 r r r");
    expect(beatNotes(bass, caret(0, 0, 4))).toEqual([{ string: 4, fret: 5, midi: 33 }]);
    const capo = score("\\capo 2\n", "5.6.4 r r r");
    expect(beatNotes(capo, caret(0, 0))).toEqual([{ string: 6, fret: 5, midi: 47 }]);
  });
});
