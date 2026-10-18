import { describe, it, expect } from "vitest";
import { durationAt, inheritedDuration, repinAt } from "./repin";
import { parseTex } from "./parse";

const tex = (body: string) => `\\tempo 120\n.\n${body}\n`;
const body = (text: string) => text.split("\n")[2];
const at = (barIndex: number, beatIndex: number) => ({ barIndex, beatIndex });

describe("inheritedDuration", () => {
  it("is the beat's own duration", () => {
    expect(inheritedDuration(tex("3.6.8 5.6.16"), at(0, 1))).toBe(16);
  });

  it("is inherited from the nearest earlier suffix, across bar lines and rests", () => {
    expect(inheritedDuration(tex("3.6.16 r 7.6 | 7.6 r"), at(1, 1))).toBe(16);
  });

  it("follows a `:8` written before a beat", () => {
    expect(inheritedDuration(tex(":8 3.6 5.6 | 7.6 r"), at(1, 0))).toBe(8);
  });

  it("is 4 when nothing sets one", () => {
    expect(inheritedDuration(tex("r r r r"), at(0, 2))).toBe(4);
  });

  it("is null when the text does not parse", () => {
    expect(inheritedDuration(tex("((("), at(0, 0))).toBeNull();
  });

  it("never reads a later beat's suffix back onto an earlier beat", () => {
    expect(inheritedDuration(tex("3.6.8 5.6 7.6.16"), at(0, 1))).toBe(8);
    expect(inheritedDuration(tex("3.6.8 5.6 | 7.6.16 r"), at(0, 1))).toBe(8);
  });
});

describe("durationAt", () => {
  it("reads an already-parsed AST", () => {
    const { scoreNode } = parseTex(tex("3.6.8 5.6 | r"));
    expect(durationAt(scoreNode, at(1, 0))).toBe(8);
  });
});

describe("repinAt", () => {
  it("writes the old value onto a beat that now inherits another", () => {
    // `3.6.8` was `3.6.4`: the 5 used to be a quarter
    expect(body(repinAt(tex("3.6.8 5.6 7.6 8.6"), at(0, 1), 4)!)).toBe("3.6.8 5.6.4 7.6 8.6");
  });

  it("leaves a beat with its own suffix alone", () => {
    const text = tex("3.6.8 5.6.16 7.6");
    expect(repinAt(text, at(0, 1), 4)).toBe(text);
  });

  it("leaves a beat that already inherits the value alone", () => {
    const text = tex("3.6.8 5.6 7.6");
    expect(repinAt(text, at(0, 1), 8)).toBe(text);
  });

  it("does nothing past the end of the document", () => {
    const text = tex("3.6.8 5.6");
    expect(repinAt(text, at(1, 0), 4)).toBe(text);
  });

  it("puts a dot that sat on the note onto the beat, beside the new suffix", () => {
    expect(body(repinAt(tex("3.6.16 7.6{d} r"), at(0, 1), 8)!)).toBe("3.6.16 7.6.8{d} r");
  });

  it("is null for a beat it cannot read, and for text that does not parse", () => {
    expect(repinAt(tex("3.6.16 x.6 r"), at(0, 1), 8)).toBeNull();
    expect(repinAt(tex("((("), at(0, 0), 8)).toBeNull();
  });

  it("is null for a target with a quoted argument — tokensOf would split `{ch \"Am\"}` — unless nothing needs writing", () => {
    // bar 1 is the next bar: the caller's own bar check never covered it
    const text = tex('3.6.8 r | (5.6{d} 7.5){ch "Am"}');
    expect(repinAt(text, at(1, 0), 4)).toBeNull();
    expect(repinAt(text, at(1, 0), 8)).toBe(text);
  });

  it.each([
    ["an unquoted argument", "(5.6{d} 7.5){ch Am}"],
    ["a single-quoted argument", "(5.6{d} 7.5){ch 'Am'}"],
    ["an upper-case property", "(5.6{d} 7.5){CH Am}"],
    ["a marked tie", "(5.6{d} 7.5{t})"],
  ])("is null for a target with %s — any beat `misreads` rejects — when a marker must be lifted", (_, target) => {
    // tokensOf reads `{ch Am}` as `ch` and `m`, so lifting the note's {d} onto it wrote `{ch m d}`:
    // the guard is `misreads`, not just a quote in the source
    const text = tex(`3.6.8 r | ${target}`);
    expect(repinAt(text, at(1, 0), 4)).toBeNull();
    expect(repinAt(text, at(1, 0), 8)).toBe(text);
  });

  // With no length marker to lift, the pin is a suffix written after the beat's
  // notes and before its effects, and every effect block is kept as written:
  // nothing passes through tokensOf, so nothing it misreads can be torn apart.
  it.each([
    ["a quoted chord name", '(3.5 5.4){ch "Am"}', '(3.5 5.4).4{ch "Am"}'],
    ["a quoted text", '3.5{txt "Chorus"}', '3.5{txt "Chorus"}.4'],
    ["an unquoted argument", "(3.5 5.4){ch Am}", "(3.5 5.4).4{ch Am}"],
    ["a marked tie", "5.6{t}", "5.6{t}.4"],
  ])("re-pins a target with %s when no marker has to be lifted, its effects verbatim", (_, target, pinned) => {
    expect(body(repinAt(tex(`3.6.8 r | ${target} r`), at(1, 0), 4)!)).toBe(`3.6.8 r | ${pinned} r`);
  });

  it("keeps a re-pinned chord name and text as alphaTab reads them", () => {
    const chord = parseTex(repinAt(tex('3.6.8 r | (3.5 5.4){ch "Am"} r'), at(1, 0), 4)!).score;
    const beat = chord.tracks[0].staves[0].bars[1].voices[0].beats[0];
    expect([beat.duration, chord.tracks[0].staves[0].chords.get(beat.chordId).name]).toEqual([4, "Am"]);
    const text = parseTex(repinAt(tex('3.6.8 r | 3.5{txt "Chorus"} r'), at(1, 0), 4)!).score;
    const textBeat = text.tracks[0].staves[0].bars[1].voices[0].beats[0];
    expect([textBeat.duration, textBeat.text]).toEqual([4, "Chorus"]);
  });

  it("keeps a note's own effect where it was and writes the suffix after it", () => {
    expect(body(repinAt(tex("3.6.16 5.6{h} 7.6"), at(0, 1), 8)!)).toBe("3.6.16 5.6{h}.8 7.6");
  });

  it("re-pins the first beat of the next bar, whose duration comes from the bar before", () => {
    expect(body(repinAt(tex("3.6.8 r | 5.6 7.6"), at(1, 0), 4)!)).toBe("3.6.8 r | 5.6.4 7.6");
  });
});
