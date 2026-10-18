import { describe, it, expect } from "vitest";
import { scaleDuration, toggleDotted } from "./duration";
import { toggleTuplet } from "./tuplet";
import { barState } from "../barFill";
import { frac } from "../fraction";
import { parseTex } from "../parse";

const TEX = "\\tempo 120\n.\n3.6.8 5.6.4\n";
const at = (barIndex: number, beatIndex: number, string = 6) => ({ barIndex, beatIndex, string });

describe("scaleDuration", () => {
  it("halves a duration (8 -> 16)", () => {
    expect(scaleDuration(TEX, at(0, 0), "halve")!.text).toContain("3.6.16");
  });

  it("doubles a duration (4 -> 2)", () => {
    expect(scaleDuration(TEX, at(0, 1), "double")!.text).toContain("5.6.2");
  });

  it("clamps at the extremes", () => {
    const fast = "\\tempo 120\n.\n3.6.64\n";
    expect(scaleDuration(fast, at(0, 0), "halve")).toBeNull();
    const slow = "\\tempo 120\n.\n3.6.1\n";
    expect(scaleDuration(slow, at(0, 0), "double")).toBeNull();
  });

  it("materialises an inherited duration before changing it", () => {
    // beat 1 has no explicit duration; it inherits :8 from beat 0
    const tex = "\\tempo 120\n.\n3.6.8 5.6 7.6\n";
    expect(scaleDuration(tex, at(0, 1), "halve")!.text).toContain("5.6.16");
  });
});

describe("toggleDotted", () => {
  it("adds a dot", () => {
    expect(toggleDotted(TEX, at(0, 0))!.text).toContain("3.6.8{d}");
  });

  it("removes an existing dot", () => {
    const dotted = "\\tempo 120\n.\n3.6.8{d} 5.6.4\n";
    const out = toggleDotted(dotted, at(0, 0))!.text;
    expect(out).toContain("3.6.8");
    expect(out).not.toContain("{d}");
  });

  it("removes a dot that landed on the note instead of the beat (duration-less single note)", () => {
    // "3.6{d}" has no duration suffix, so the dot's trailing brace sits
    // directly on the note (see beatText.ts's parseBeatText) rather than in
    // beat.effects. toggleDotted must still recognise it as "already
    // dotted" and clear it, instead of missing it and stacking a second
    // "{d}" onto the beat that can never be removed.
    const tex = "\\tempo 120\n.\n3.6{d} 5.6 7.6 | 7.6.4 r.4\n";
    const off = toggleDotted(tex, at(0, 0))!;
    expect(off.text).toBe("\\tempo 120\n.\n3.6.4 5.6 7.6 | 7.6.4 r.4\n");
    // Toggling again re-dots cleanly, in the canonical (beat-level) spot.
    const on = toggleDotted(off.text, at(0, 0))!;
    expect(on.text).toBe("\\tempo 120\n.\n3.6.4{d} 5.6 7.6 | 7.6.4 r.4\n");
  });
});

const doc = (body: string) => `\\tempo 120\n.\n${body}\n`;
const bodyOf = (text: string) => text.split("\n")[2];
const halve = (body: string, beat = 0) => bodyOf(scaleDuration(doc(body), at(0, beat), "halve")!.text);
const double = (body: string, beat = 0) => bodyOf(scaleDuration(doc(body), at(0, beat), "double")!.text);
const stateOf = (body: string, barIndex = 0) => barState(parseTex(doc(body)).score, barIndex);
/** Every beat's model length, bar by bar. */
const lengths = (body: string) =>
  parseTex(doc(body)).score.tracks[0].staves[0].bars.map((bar: { voices: Array<{ beats: Array<Record<string, number>> }> }) =>
    bar.voices[0].beats.map((b) => `${b.duration}/${b.dots}/${b.tupletNumerator}`),
  );

describe("a duration change stays local (the spec's worked examples, 4/4)", () => {
  it("halving beat 0 of `3.6.4 5.6 7.6 8.6` gives `3.6.8 5.6.4 7.6 8.6`, short by an 8th", () => {
    expect(halve("3.6.4 5.6 7.6 8.6")).toBe("3.6.8 5.6.4 7.6 8.6");
    expect(stateOf("3.6.8 5.6.4 7.6 8.6")).toEqual({ kind: "short", amount: frac(1, 8) });
  });

  it("halving beat 0 of `3.6.8 r r r r r r r` gives `3.6.16 r r r r r r r` — the rests come along (sticky entry)", () => {
    expect(halve("3.6.8 r r r r r r r")).toBe("3.6.16 r r r r r r r");
    // eight 16ths: the bar is short by a half, and shows it
    expect(stateOf("3.6.16 r r r r r r r")).toEqual({ kind: "short", amount: frac(1, 2) });
  });

  it("doubling beat 0 of `3.6.8 r r r r r r r` gives `3.6.4 r r r`: the rests take the quarter, four are absorbed", () => {
    expect(double("3.6.8 r r r r r r r")).toBe("3.6.4 r r r");
  });

  it("doubling beat 0 of `3.6.4 r r r` gives `3.6.2 r`", () => {
    expect(double("3.6.4 r r r")).toBe("3.6.2 r");
  });

  it("doubling beat 0 of `3.6.4 5.6 r r` gives `3.6.2 5.6.4 r r`, over by a quarter", () => {
    expect(double("3.6.4 5.6 r r")).toBe("3.6.2 5.6.4 r r");
    expect(stateOf("3.6.2 5.6.4 r r")).toEqual({ kind: "long", amount: frac(1, 4) });
  });
});

describe("re-pinning", () => {
  it("halving or doubling the first of two bars of inherited 8ths changes no other note or bar", () => {
    const body = "3.6.8 5.6 7.6 8.6 3.6 5.6 7.6 8.6 | 3.6 5.6 7.6 8.6 3.6 5.6 7.6 8.6";
    for (const out of [halve(body), double(body)]) {
      const [before, after] = [lengths(body), lengths(out)];
      expect(after[0].slice(1)).toEqual(before[0].slice(1));
      expect(after[1]).toEqual(before[1]);
    }
  });

  it("puts the old value on the next bar when the sticky rests run to the bar line", () => {
    expect(halve("3.6.8 r r r | r r 5.6 r")).toBe("3.6.16 r r r | r.8 r 5.6 r");
  });

  it("re-pins after absorbing: the run's last rest keeps the new value, the notes after it their old one", () => {
    // the run takes quarters; three rests give way, the third split to an 8th
    expect(double("3.6.8 r r r r 5.6 7.6 8.6")).toBe("3.6.4 r.8 r.4 5.6.8 7.6 8.6");
    expect(stateOf("3.6.4 r.8 r.4 5.6.8 7.6 8.6")).toEqual({ kind: "exact" });
  });

  it("keeps whatever the new value is on the run's rests after a split — 8ths here, not quarters", () => {
    expect(double("3.6.16 r r r 5.6.2 7.6.8 8.6.16")).toBe("3.6.8 r.16 r.8 5.6.2 7.6.8 8.6.16");
    expect(stateOf("3.6.8 r.16 r.8 5.6.2 7.6.8 8.6.16")).toEqual({ kind: "exact" });
  });

  it("leaves the beat after the run alone when the split lands on the run's last rest", () => {
    expect(double("3.6.8 r r 5.6 7.6 8.6 9.6 10.6")).toBe("3.6.4 r.8 5.6 7.6 8.6 9.6 10.6");
    expect(stateOf("3.6.4 r.8 5.6 7.6 8.6 9.6 10.6")).toEqual({ kind: "exact" });
  });

  it("moves a dot that sat on the note onto the beat when it writes the duration", () => {
    expect(double("3.6{d} r r r")).toBe("3.6.2{d} r.4");
    expect(stateOf("3.6.2{d} r.4")).toEqual({ kind: "exact" });
  });
});

describe("absorbing rests when a beat grows", () => {
  it("splits a rest when only part of it is needed", () => {
    expect(double("3.6.4 r.2 r.4")).toBe("3.6.2 r.4 r.4");
  });

  it("stops at a note — a tied one too, so a held note is never cut", () => {
    expect(double("3.6.8 -.6 r r r r r r")).toBe("3.6.4 -.6.8 r r r r r r");
    expect(stateOf("3.6.4 -.6.8 r r r r r r")).toEqual({ kind: "long", amount: frac(1, 8) });
  });

  it("never reaches past the bar line", () => {
    const out = bodyOf(scaleDuration(doc("3.6.4 5.6 7.6 8.6 | r r r r"), at(0, 3), "double")!.text);
    expect(out).toBe("3.6.4 5.6 7.6 8.6.2 | r.4 r r r");
  });

  it("a dot absorbs too, and the beat after a split rest is re-pinned", () => {
    const out = bodyOf(toggleDotted(doc("3.6.8 5.6 r r r r r r"), at(0, 1))!.text);
    expect(out).toBe("3.6.8 5.6.8{d} r.16 r.8 r r r r");
    expect(stateOf(out)).toEqual({ kind: "exact" });
  });

  it("shortening never pads: the bar is left short", () => {
    expect(halve("3.6.4 5.6 7.6 8.6", 3)).toBe("3.6.4 5.6 7.6 8.6.8");
  });

  it("the triplet toggle neither absorbs nor pads: three 8ths made a triplet leave the bar an 8th short", () => {
    const out = bodyOf(toggleTuplet(doc("3.6.8 5.6 7.6 r r r r r"), at(0, 0))!.text);
    expect(out).toBe("3.6.8{tu 3} 5.6.8{tu 3} 7.6.8{tu 3} r r r r r");
    expect(stateOf(out)).toEqual({ kind: "short", amount: frac(1, 8) });
  });

  it("stops at a rest it cannot cut exactly, rather than skipping on to the next", () => {
    // a quarter triplet less an 8th is no note value
    const kept = "3.6.4 r.4{tu 3} r.4{tu 3} r.4{tu 3} r.4 r.8";
    expect(double("3.6.8 r.4{tu 3} r.4{tu 3} r.4{tu 3} r.4 r.8")).toBe(kept);
    expect(stateOf(kept)).toEqual({ kind: "long", amount: frac(1, 8) });
  });

  it("counts a grace note as no length at all", () => {
    expect(double("3.6.4 5.6{gr ob} r r r", 1)).toBe("3.6.4 5.6.2{gr ob} r.4 r.2");
    expect(stateOf("3.6.4 5.6.2{gr ob} r.4 r.2")).toEqual({ kind: "exact" });
  });

  it("leaves a pickup bar alone: it has no length to keep", () => {
    expect(double("\\ac 3.6.8 r r r r r r r | 3.6.4 5.6 7.6 8.6")).toBe("\\ac 3.6.4 r r r r r r r | 3.6.4 5.6 7.6 8.6");
  });

  it("shortening trims nothing, even from a bar that is already long", () => {
    expect(halve("3.6.2 r.4 r.4 r.4 r.4")).toBe("3.6.4 r.4 r.4 r.4 r.4");
    expect(bodyOf(toggleDotted(doc("3.6.4{d} r.4 r.4 r.4 r.4"), at(0, 0))!.text)).toBe("3.6.4 r.4 r.4 r.4 r.4");
  });
});

describe("a bar line written straight after the last beat", () => {
  it("leaves the bar editable, and the bar line where it was", () => {
    expect(halve("3.6.4 5.6 7.6 8.6|9.6.4 5.6 7.6 8.6", 3)).toBe("3.6.4 5.6 7.6 8.6.8|9.6.4 5.6 7.6 8.6");
    expect(bodyOf(toggleDotted(doc("3.6.4 5.6 7.6 8.6.8|9.6.4 5.6"), at(0, 3))!.text)).toBe("3.6.4 5.6 7.6 8.6.8{d}|9.6.4 5.6");
  });
});

describe("refusals", () => {
  it("leaves a bar it cannot read alone", () => {
    expect(scaleDuration(doc("3.6.8 x.6 r r"), at(0, 0), "halve")).toBeNull();
    expect(toggleDotted(doc(":8 3.6 5.6 r r"), at(0, 1))).toBeNull();
  });

  it("refuses, rather than mangle it, when the beat it must re-pin has a quoted argument and a dot to lift", () => {
    expect(scaleDuration(doc('3.6.8 r | (5.6{d} 7.5){ch "Am"}'), at(0, 0), "halve")).toBeNull();
    // the same quoted beat is fine when nothing needs writing onto it
    expect(halve('3.6.8 r | 3.6.16 (5.6 7.5){ch "Am"}')).toBe('3.6.16 r | 3.6.16 (5.6 7.5){ch "Am"}');
  });

  it("refuses when the beat it must re-pin is one it cannot read", () => {
    expect(scaleDuration(doc("3.6.4 r r r | x.5 r r r"), at(0, 0), "halve")).toBeNull();
    expect(scaleDuration(doc("3.6.4 r r r | x.5 r r r"), at(0, 0), "double")).toBeNull();
  });
});

// The next bar's first beat inherits the edited bar's duration and has to be
// re-pinned. A quoted chord name or text on it stays exactly as written: the
// pin is a suffix, and with no length marker to lift nothing is re-tokenised.
describe("re-pinning a next bar that opens with a chord name or a text", () => {
  it.each([
    ['(3.5 5.4){ch "Am"}', '(3.5 5.4).4{ch "Am"}'],
    ['3.5{txt "Chorus"}', '3.5{txt "Chorus"}.4'],
  ])("%s: halving and doubling the first beat of the bar before act", (first, pinned) => {
    expect(halve(`3.6.4 r r r | ${first} r r r`)).toBe(`3.6.8 r r r | ${pinned} r r r`);
    expect(double(`3.6.4 r r r | ${first} r r r`)).toBe(`3.6.2 r | ${pinned} r r r`);
  });

  it("keeps the chord name and the text, and the beat's quarter, as alphaTab reads them", () => {
    for (const out of [halve('3.6.4 r r r | (3.5 5.4){ch "Am"} r r r'), double('3.6.4 r r r | (3.5 5.4){ch "Am"} r r r')]) {
      const staff = parseTex(doc(out)).score.tracks[0].staves[0];
      const beat = staff.bars[1].voices[0].beats[0];
      expect([beat.duration, staff.chords.get(beat.chordId).name]).toEqual([4, "Am"]);
    }
    const textBeat = parseTex(doc(halve('3.6.4 r r r | 3.5{txt "Chorus"} r r r'))).score.tracks[0].staves[0].bars[1].voices[0].beats[0];
    expect([textBeat.duration, textBeat.text]).toEqual([4, "Chorus"]);
  });
});
