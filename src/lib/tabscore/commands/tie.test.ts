import { describe, it, expect } from "vitest";
import { toggleTie } from "./tie";
import { parseTex } from "../parse";

// Two bars, four quarter-note beats each, so the across-a-barline case and
// the walk-back-through-a-chain case both have room.
const TEX = "\\tempo 120\n.\n3.6.4 5.6 7.6 8.6 | 3.5.4 5.5 7.5 8.5\n";
const at = (barIndex: number, beatIndex: number, string = 6) => ({ barIndex, beatIndex, string });

describe("toggleTie", () => {
  it("ties a note to the previous one on the same string", () => {
    expect(toggleTie(TEX, at(0, 1))!.text).toContain("3.6.4 -.6 7.6");
  });

  it("unties to the fret the tie was sounding, not to a hole", () => {
    // Beat 1 was a 5; tying it makes it sound the 3 before it, so untying
    // writes that 3 rather than restoring the 5 (which the text no longer
    // holds) or leaving the string empty. Ctrl+Z is the exact inverse.
    const tied = toggleTie(TEX, at(0, 1))!;
    expect(toggleTie(tied.text, at(0, 1))!.text).toContain("3.6.4 3.6 7.6");
  });

  it("round-trips exactly when the note already matched what it ties to", () => {
    const repeated = "\\tempo 120\n.\n3.6.4 3.6 7.6 8.6\n";
    const tied = toggleTie(repeated, at(0, 1))!;
    expect(toggleTie(tied.text, at(0, 1))!.text).toBe(repeated);
  });

  it("walks back through a chain of ties to find the real fret", () => {
    const one = toggleTie(TEX, at(0, 1))!;
    const two = toggleTie(one.text, at(0, 2))!;
    expect(two.text).toContain("3.6.4 -.6 -.6 8.6");
    // Beat 2's origin is beat 0 (fret 3), reached through beat 1's own tie.
    expect(toggleTie(two.text, at(0, 2))!.text).toContain("3.6.4 -.6 3.6 8.6");
  });

  it("ties across a barline to the last note of the previous bar", () => {
    // Bar 1 is entirely on string 5, so string 6's origin is bar 0's last
    // beat — fret 8, on the far side of the barline.
    const tied = toggleTie(TEX, at(1, 0, 6))!;
    expect(tied.text).toContain("| (-.6 3.5).4");
    expect(toggleTie(tied.text, at(1, 0, 6))!.text).toContain("| (8.6 3.5).4");
  });

  it("refuses when nothing earlier plays that string", () => {
    // The very first beat of the document has nothing before it.
    expect(toggleTie(TEX, at(0, 0))).toBeNull();
    // String 5's first appearance IS bar 1 beat 0, so there is no origin.
    expect(toggleTie(TEX, at(1, 0, 5))).toBeNull();
  });

  it("adds a tied note on a string the beat does not yet play", () => {
    // Bar 1 beat 1 plays string 5 only; string 6 was last played in bar 0.
    const tied = toggleTie(TEX, at(1, 1, 6))!;
    expect(tied.text).toContain("(-.6 5.5)");
  });

  it("keeps the note's own effects when tying and untying", () => {
    const withVibrato = "\\tempo 120\n.\n3.6.4 5.6{v} 7.6 8.6\n";
    const tied = toggleTie(withVibrato, at(0, 1))!;
    expect(tied.text).toContain("-.6{v}");
    expect(toggleTie(tied.text, at(0, 1))!.text).toContain("3.6{v}");
  });

  it("produces a document alphaTab reads as a real tie", () => {
    const tied = toggleTie(TEX, at(0, 1))!;
    const parsed = parseTex(tied.text);
    expect(parsed.ok).toBe(true);
    const beat = parsed.score!.tracks[0].staves[0].bars[0].voices[0].beats[1];
    expect(beat.notes[0].isTieDestination).toBe(true);
    // alphaTab resolves the tied note's fret from its origin.
    expect(beat.notes[0].fret).toBe(3);
  });

  it("leaves the document alone when it does not parse", () => {
    expect(toggleTie("\\tempo 120\n.\n(((\n", at(0, 0))).toBeNull();
  });
});
