import { describe, it, expect } from "vitest";
import * as alphaTab from "@coderline/alphatab";
import { toggleEnding, readEndings, MAX_ENDING } from "./endings";
import { toggleRepeatStart, toggleRepeatEnd } from "./repeat";
import { parseTex } from "../parse";

const TEX = "\\tempo 120\n.\n3.6.4 r.4 r.4 r.4 | 5.6.4 r.4 r.4 r.4 | 7.6.4 r.4 r.4 r.4\n";
const at = (barIndex: number, beatIndex: number, string = 6) => ({ barIndex, beatIndex, string });

function score(text: string) {
  const parsed = parseTex(text);
  expect(parsed.ok, text).toBe(true);
  return parsed.score;
}

/** The bars, numbered from 1, in the order alphaTab plays them. */
function playedOrder(text: string): string {
  // alphaTab's midi namespace is part of the untyped interop boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { midi, Settings } = alphaTab as any;
  const generator = new midi.MidiFileGenerator(
    score(text),
    new Settings(),
    new midi.AlphaSynthMidiFileHandler(new midi.MidiFile()),
  );
  generator.generate();
  return generator.tickLookup.masterBars.map((b: { masterBar: { index: number } }) => b.masterBar.index + 1).join(" ");
}

describe("readEndings", () => {
  it("reads nothing from a bar that is not an ending", () => {
    expect(readEndings(score(TEX), 1)).toEqual([]);
  });

  it("reads the numbers a bar's bracket carries", () => {
    const text = "\\tempo 120\n.\nr r r r | \\ae (1 2) r r r r | \\ae (3) r r r r\n";
    expect(readEndings(score(text), 1)).toEqual([1, 2]);
    expect(readEndings(score(text), 2)).toEqual([3]);
  });

  it("reads nothing for a bar that is not there", () => {
    expect(readEndings(score(TEX), 9)).toEqual([]);
  });
});

describe("toggleEnding", () => {
  it("marks the caret's bar as an ending, before its first beat", () => {
    const next = toggleEnding(TEX, at(1, 0), 1, 1)!.text;
    expect(next).toContain("| \\ae (1) 5.6.4");
    expect(readEndings(score(next), 1)).toEqual([1]);
  });

  it("adds a second number to the same bracket", () => {
    const one = toggleEnding(TEX, at(1, 0), 1, 1)!.text;
    const both = toggleEnding(one, at(1, 0), 1, 2)!.text;
    expect(both.match(/\\ae/g)!.length).toBe(1);
    expect(readEndings(score(both), 1)).toEqual([1, 2]);
  });

  it("writes the numbers parenthesised — `\\ae 1 2` would mean ending 1 alone", () => {
    // Verified against alphaTab 1.8.1: unparenthesised, only the first
    // number is the ending's and the rest are read as something else.
    const one = toggleEnding(TEX, at(1, 0), 1, 1)!.text;
    const both = toggleEnding(one, at(1, 0), 1, 2)!.text;
    expect(both).toContain("\\ae (1 2) 5.6.4");
    expect(parseTex(both).diagnostics.filter((d) => d.severity !== "hint")).toEqual([]);
  });

  it("keeps the numbers in order whichever is pressed first", () => {
    const two = toggleEnding(TEX, at(1, 0), 1, 2)!.text;
    expect(toggleEnding(two, at(1, 0), 1, 1)!.text).toContain("\\ae (1 2) ");
  });

  it("takes one number off and leaves the others", () => {
    const text = "\\tempo 120\n.\nr r r r | \\ae (1 2) r r r r\n";
    expect(readEndings(score(toggleEnding(text, at(1, 0), 1, 2)!.text), 1)).toEqual([1]);
  });

  it("takes the bracket off with its last number", () => {
    const on = toggleEnding(TEX, at(1, 0), 1, 1)!.text;
    expect(toggleEnding(on, at(1, 0), 1, 1)!.text).toBe(TEX);
  });

  it("rewrites a hand-written unparenthesised ending", () => {
    const text = "\\tempo 120\n.\nr r r r | \\ae 1 r r r r\n";
    expect(toggleEnding(text, at(1, 0), 1, 2)!.text).toBe("\\tempo 120\n.\nr r r r | \\ae (1 2) r r r r\n");
  });

  it("keeps a repeat-end sign on the same bar", () => {
    const text = "\\tempo 120\n.\n\\ro r r r r | \\rc 3 r r r r\n";
    const next = toggleEnding(text, at(1, 0), 1, 1)!.text;
    expect(score(next).masterBars[1].repeatCount).toBe(3);
    expect(readEndings(score(next), 1)).toEqual([1]);
  });

  it("leaves the music and the caret alone", () => {
    const result = toggleEnding(TEX, at(2, 3, 4), 1, 1)!;
    expect(result.caret).toEqual(at(2, 3, 4));
    expect(result.text).toContain("5.6.4 r.4 r.4 r.4 | 7.6.4 r.4 r.4 r.4");
  });

  it("takes every number alphaTab can draw, up to the eighth ending", () => {
    const next = toggleEnding(TEX, at(1, 0), 1, MAX_ENDING)!.text;
    expect(MAX_ENDING).toBe(8);
    expect(next).toContain("\\ae (8) ");
    expect(readEndings(score(next), 1)).toEqual([8]);
  });

  it("refuses a number no bracket can carry", () => {
    expect(toggleEnding(TEX, at(1, 0), 1, 0)).toBeNull();
    expect(toggleEnding(TEX, at(1, 0), 1, MAX_ENDING + 1)).toBeNull();
    expect(toggleEnding(TEX, at(1, 0), 1, 1.5)).toBeNull();
  });

  it("rejects a bar outside the document", () => {
    expect(toggleEnding(TEX, at(0, 0), 9, 1)).toBeNull();
    expect(toggleEnding(TEX, at(0, 0), -1, 1)).toBeNull();
  });

  it("leaves the document alone when it does not parse", () => {
    expect(toggleEnding("\\tempo 120\n.\n(((\n", at(0, 0), 0, 1)).toBeNull();
  });
});

describe("endings with repeat signs", () => {
  it("plays the 1st-and-2nd ending twice, then skips to the 3rd", () => {
    // Bars 1-2 repeated, a two-bar "1., 2." ending closing the repeat ×3, then
    // a "3." ending: the layout of a typical rock tab's verse.
    let text = "\\tempo 120\n.\nr r r r | r r r r | r r r r | r r r r | r r r r | r r r r\n";
    const step = (edit: (t: string) => { text: string } | null) => {
      text = edit(text)!.text;
    };
    step((t) => toggleRepeatStart(t, at(0, 0), 0));
    step((t) => toggleRepeatEnd(t, at(3, 0), 3, 3));
    step((t) => toggleEnding(t, at(2, 0), 2, 1));
    step((t) => toggleEnding(t, at(2, 0), 2, 2));
    step((t) => toggleEnding(t, at(3, 0), 3, 1));
    step((t) => toggleEnding(t, at(3, 0), 3, 2));
    step((t) => toggleEnding(t, at(4, 0), 4, 3));
    expect(playedOrder(text)).toBe("1 2 3 4 1 2 3 4 1 2 5 6");
  });
});
