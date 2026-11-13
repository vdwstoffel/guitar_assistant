import { describe, expect, it } from "vitest";
import { caretHint, caretHints } from "./caretHint";
import { intervalFeel, type ProgressionChord } from "./theory";

const Am: ProgressionChord = { root: "A", quality: "Minor", bars: 1 };
const F: ProgressionChord = { root: "F", quality: "Major", bars: 1 };
const inAMinor = { keyRoot: "A", scale: "Minor" };

// MIDI: A2 = 45, A#2/Bb2 = 46, C3 = 48.
describe("caretHint", () => {
  it("names the note's interval over the bar's chord", () => {
    expect(caretHint({ midi: 45, chord: Am, ...inAMinor })).toEqual({
      title: "A — 1 over Am",
      detail: intervalFeel(0),
      inScale: true,
    });
  });

  it("gives the interval's feel as the detail", () => {
    const hint = caretHint({ midi: 48, chord: F, ...inAMinor });
    expect(hint.title).toBe("C — 5 over F");
    expect(hint.detail).toBe(intervalFeel(7));
    expect(hint.detail).toBe("Open, powerful, stable");
    expect(hint.inScale).toBe(true);
  });

  it("says when the note is outside the riff's scale", () => {
    const hint = caretHint({ midi: 46, chord: Am, ...inAMinor });
    expect(hint.title).toBe("A# — b2 over Am");
    expect(hint.inScale).toBe(false);
  });

  it("measures from the key root when the bar has no chord", () => {
    expect(caretHint({ midi: 48, chord: null, ...inAMinor })).toEqual({
      title: "C — b3 over the key",
      detail: intervalFeel(3),
      inScale: true,
    });
  });

  it("asks for a note when there is none at the caret", () => {
    expect(caretHint({ midi: null, chord: Am, ...inAMinor })).toEqual({
      title: "No note at the caret",
      detail: "Put the caret on a note to see how it sounds over the chord",
      inScale: null,
    });
  });

  it("is the same in every octave", () => {
    expect(caretHint({ midi: 45 + 24, chord: Am, ...inAMinor }).title).toBe("A — 1 over Am");
  });

  it("cannot say in or out of a scale that has no notes", () => {
    expect(caretHint({ midi: 45, chord: Am, keyRoot: "A", scale: "None" }).inScale).toBeNull();
  });
});

describe("caretHints", () => {
  it("gives one hint per note, lowest first", () => {
    const hints = caretHints({ midis: [52, 45, 57], chord: Am, ...inAMinor });
    expect(hints.map((h) => h.title)).toEqual(["A — 1 over Am", "E — 5 over Am", "A — 1 over Am"]);
  });

  it("gives the no-note hint for a rest", () => {
    expect(caretHints({ midis: [], chord: Am, ...inAMinor }).map((h) => h.title)).toEqual(["No note at the caret"]);
  });
});
