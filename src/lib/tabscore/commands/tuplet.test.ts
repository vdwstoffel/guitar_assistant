import { describe, it, expect } from "vitest";
import { toggleTuplet, tupletAt, TRIPLET } from "./tuplet";
import { parseTex } from "../parse";

// Eight eighths: a full 4/4 bar, so a triplet can be made inside it without
// the bar's arithmetic getting in the way.
const TEX = "\\tempo 120\n.\n3.6.8 5.6 7.6 8.6 3.6 5.6 7.6 8.6\n";
const at = (barIndex: number, beatIndex: number, string = 6) => ({ barIndex, beatIndex, string });

function node(text: string) {
  const parsed = parseTex(text);
  expect(parsed.ok, text).toBe(true);
  return parsed.scoreNode;
}

/** Playback ticks per bar, which is where a tuplet actually shows up. */
function ticks(text: string) {
  const parsed = parseTex(text);
  expect(parsed.ok).toBe(true);
  return (parsed.score!.tracks[0].staves[0].bars as {
    voices: { beats: { playbackDuration: number }[] }[];
  }[]).map((b) => b.voices[0].beats.reduce((n, bt) => n + bt.playbackDuration, 0));
}

/** Which beats of bar 0 carry a marker, so a whole group is easy to assert. */
function marked(text: string) {
  const scoreNode = node(text);
  const count = scoreNode.bars[0].beats.length;
  return Array.from({ length: count }, (_, i) => tupletAt(text, scoreNode, at(0, i)));
}

describe("toggleTuplet", () => {
  it("marks the caret's beat and the two after it — a triplet is three beats", () => {
    // The whole point. Marking one beat leaves notation that does not add up,
    // and arrowing onto an existing rest adds no beat to carry a marker onto.
    expect(marked(toggleTuplet(TEX, at(0, 1))!.text)).toEqual([null, 3, 3, 3, null, null, null, null]);
  });

  it("writes an explicit duration so the brace can only be the beat's", () => {
    // A bare `5.6{tu 3}` reads back with the marker on the NOTE, so toggling
    // off would miss it and write a second block. toggleDotted pins the
    // duration for the same reason, and the importer's own output looks like
    // this.
    expect(toggleTuplet(TEX, at(0, 1))!.text).toContain("5.6.8{tu 3} 7.6.8{tu 3} 8.6.8{tu 3}");
  });

  it("takes the whole group apart again", () => {
    const on = toggleTuplet(TEX, at(0, 1))!.text;
    expect(marked(toggleTuplet(on, at(0, 1))!.text)).toEqual(Array(8).fill(null));
  });

  it("unmarks the group from any beat in it, not just the one it started on", () => {
    const on = toggleTuplet(TEX, at(0, 1))!.text;
    expect(marked(toggleTuplet(on, at(0, 3))!.text)).toEqual(Array(8).fill(null));
  });

  it("clears a whole run, however long it grew", () => {
    // Two adjacent triplets read as one six-long run; pulling three beats out
    // of the middle would leave notation that does not add up.
    let text = toggleTuplet(TEX, at(0, 0))!.text;
    text = toggleTuplet(text, at(0, 3))!.text;
    expect(marked(text)).toEqual([3, 3, 3, 3, 3, 3, null, null]);
    expect(marked(toggleTuplet(text, at(0, 4))!.text)).toEqual(Array(8).fill(null));
  });

  it("three marked eighths take the time of two", () => {
    // 3 x 480 would be 1440; a triplet squeezes them into 960, which is what
    // makes the rest of the bar still fit.
    expect(ticks(toggleTuplet(TEX, at(0, 0))!.text)).toEqual([3840 - 1440 + 960]);
  });

  it("grows the bar when the group runs past what is written", () => {
    const short = "\\tempo 120\n.\n3.6.8 5.6\n";
    const grown = toggleTuplet(short, at(0, 1))!.text;
    expect(marked(grown)).toEqual([null, 3, 3, 3]);
    expect(parseTex(grown).ok).toBe(true);
  });

  it("marks rests and chords too", () => {
    const mixed = "\\tempo 120\n.\nr.8 (3.6 5.5).8 7.6 8.6 3.6 5.6 7.6 8.6\n";
    const out = toggleTuplet(mixed, at(0, 0))!.text;
    expect(out).toContain("r.8{tu 3}");
    expect(out).toContain("(3.6 5.5).8{tu 3}");
  });

  it("keeps each beat's other effects", () => {
    const dotted = "\\tempo 120\n.\n3.6.8 5.6.8{d} 7.6 8.6 3.6 5.6\n";
    const out = toggleTuplet(dotted, at(0, 1))!.text;
    expect(out).toContain("{d tu 3}");
    // Unmarking keeps the dot and drops only the marker. The durations it
    // pinned stay spelled out rather than inherited — same values, and the
    // same thing toggleDotted leaves behind.
    const off = toggleTuplet(out, at(0, 1))!.text;
    expect(off).toContain("5.6.8{d}");
    expect(off).not.toContain("tu 3");
  });

  it("reads a marker written by hand without a duration", () => {
    // Nothing this command writes looks like this, because it pins the
    // duration. But the source pane is editable and alphaTex accepts the bare
    // form — where parseBeatText hands the brace to the NOTE. Looking only at
    // beat.effects would call the beat unmarked and mark it a second time.
    const byHand = "\\tempo 120\n.\n3.6.8 5.6{tu 3} 7.6{tu 3} 8.6{tu 3} 3.6 5.6 7.6 8.6\n";
    expect(tupletAt(byHand, node(byHand), at(0, 1))).toBe(TRIPLET);
    const off = toggleTuplet(byHand, at(0, 2))!.text;
    expect(off).not.toContain("tu 3");
  });

  it("replaces a different tuplet rather than nesting one inside it", () => {
    const five = toggleTuplet(TEX, at(0, 1), 5)!.text;
    expect(marked(five)).toEqual([null, 5, 5, 5, 5, 5, null, null]);
    const three = toggleTuplet(five, at(0, 1), 3)!.text;
    expect(marked(three)).toEqual([null, 3, 3, 3, 5, 5, null, null]);
  });

  it("rejects a nonsensical tuplet size", () => {
    expect(toggleTuplet(TEX, at(0, 0), 1)).toBeNull();
    expect(toggleTuplet(TEX, at(0, 0), 99)).toBeNull();
  });

  it("rejects a caret past the end of the bar", () => {
    expect(toggleTuplet(TEX, at(0, 99))).toBeNull();
  });

  it("leaves the document alone when it does not parse", () => {
    expect(toggleTuplet("\\tempo 120\n.\n(((\n", at(0, 0))).toBeNull();
  });

  it("keeps the caret where it was", () => {
    expect(toggleTuplet(TEX, at(0, 2, 4))!.caret).toEqual(at(0, 2, 4));
  });
});

describe("tupletAt", () => {
  it("reports nothing for a plain beat", () => {
    expect(tupletAt(TEX, node(TEX), at(0, 0))).toBeNull();
  });

  it("reports the size of the tuplet the beat is in", () => {
    const marked5 = toggleTuplet(TEX, at(0, 2), 5)!.text;
    expect(tupletAt(marked5, node(marked5), at(0, 2))).toBe(5);
    expect(tupletAt(marked5, node(marked5), at(0, 1))).toBeNull();
  });
});
