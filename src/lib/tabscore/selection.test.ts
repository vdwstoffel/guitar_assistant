import { describe, it, expect } from "vitest";
import {
  barRange, comparePos, extendByBeat, extendToBarEdge, isWholeBars, positionsIn, rangeOf, selectAll, sizeOf, stillValid,
} from "./selection";
import { parseTex } from "./parse";
import { deleteBeat } from "./commands/structure";

const node = (body: string) => parseTex(`\\tempo 120\n.\n${body}\n`).scoreNode;
const at = (barIndex: number, beatIndex: number) => ({ barIndex, beatIndex });
const caret = (barIndex: number, beatIndex: number, string = 3) => ({ barIndex, beatIndex, string });
// 4 + 2 + 2 beats
const DOC = node("3.6.4 5.6 7.6 8.6 | 3.6.2 5.6 | 7.6.4 r.2");

describe("rangeOf", () => {
  it("orders the ends, whichever way the selection was made, and drops the string", () => {
    expect(rangeOf(caret(1, 1), caret(0, 2))).toEqual({ from: at(0, 2), to: at(1, 1) });
    expect(rangeOf(caret(0, 2), caret(1, 1))).toEqual({ from: at(0, 2), to: at(1, 1) });
  });

  it("is one beat when anchor and head meet", () => {
    expect(rangeOf(caret(1, 0), caret(1, 0, 6))).toEqual({ from: at(1, 0), to: at(1, 0) });
  });

  it("compares positions in reading order", () => {
    expect(comparePos(at(0, 3), at(1, 0))).toBeLessThan(0);
    expect(comparePos(at(1, 1), at(1, 1))).toBe(0);
  });
});

describe("isWholeBars", () => {
  it("is a bar's first beat to a bar's last beat", () => {
    expect(isWholeBars(DOC, { from: at(1, 0), to: at(1, 1) })).toBe(true);
    expect(isWholeBars(DOC, { from: at(0, 0), to: at(2, 1) })).toBe(true);
  });

  it("is not a partial bar at either end", () => {
    expect(isWholeBars(DOC, { from: at(0, 1), to: at(1, 1) })).toBe(false);
    expect(isWholeBars(DOC, { from: at(0, 0), to: at(1, 0) })).toBe(false);
    expect(isWholeBars(DOC, { from: at(0, 0), to: at(0, 2) })).toBe(false);
  });
});

describe("extendByBeat", () => {
  it("moves the head one beat, across bar lines, keeping its string", () => {
    expect(extendByBeat(DOC, caret(0, 3), 1)).toEqual(caret(1, 0));
    expect(extendByBeat(DOC, caret(1, 0), -1)).toEqual(caret(0, 3));
  });

  it("stops at the ends of the score — it never adds a beat", () => {
    expect(extendByBeat(DOC, caret(2, 1), 1)).toEqual(caret(2, 1));
    expect(extendByBeat(DOC, caret(0, 0), -1)).toEqual(caret(0, 0));
  });
});

describe("extendToBarEdge", () => {
  it("goes to the bar's last beat, then the next bar's last beat", () => {
    expect(extendToBarEdge(DOC, caret(0, 1), 1)).toEqual(caret(0, 3));
    expect(extendToBarEdge(DOC, caret(0, 3), 1)).toEqual(caret(1, 1));
  });

  it("mirrors to first beats going left", () => {
    expect(extendToBarEdge(DOC, caret(1, 1), -1)).toEqual(caret(1, 0));
    expect(extendToBarEdge(DOC, caret(1, 0), -1)).toEqual(caret(0, 0));
  });

  it("stops at the ends of the score", () => {
    expect(extendToBarEdge(DOC, caret(2, 1), 1)).toEqual(caret(2, 1));
    expect(extendToBarEdge(DOC, caret(0, 0), -1)).toEqual(caret(0, 0));
  });
});

describe("selectAll", () => {
  it("runs from the first beat to the last", () => {
    expect(selectAll(DOC)).toEqual({ from: at(0, 0), to: at(2, 1) });
  });

  it("is null for a score with no beats: the empty document is one bar with none", () => {
    expect(node("").bars).toHaveLength(1);
    expect(selectAll(node(""))).toBeNull();
  });

  it("starts and ends on beats past empty bars at either end", () => {
    expect(selectAll(node("| 3.6.4 5.6 | 7.6.2 | |"))).toEqual({ from: at(1, 0), to: at(2, 0) });
  });
});

// A bar with no beats between two that have them: the selection steps over it.
describe("across an empty bar", () => {
  const GAP = node("3.6.8 5.6 | | 7.6");

  it("extends beat by beat over it, both ways", () => {
    expect(extendByBeat(GAP, caret(0, 1), 1)).toEqual(caret(2, 0));
    expect(extendByBeat(GAP, caret(2, 0), -1)).toEqual(caret(0, 1));
  });

  it("extends to the next bar's edge over it, both ways", () => {
    expect(extendToBarEdge(GAP, caret(0, 0), 1)).toEqual(caret(0, 1));
    expect(extendToBarEdge(GAP, caret(0, 1), 1)).toEqual(caret(2, 0));
    expect(extendToBarEdge(GAP, caret(2, 0), -1)).toEqual(caret(0, 0));
  });

  it("lists the beats either side, and counts the bars it spans, the empty one too", () => {
    const either = { from: at(0, 1), to: at(2, 0) };
    expect(positionsIn(GAP, either)).toEqual([at(0, 1), at(2, 0)]);
    expect(sizeOf(GAP, either)).toEqual({ wholeBars: false, bars: 3, beats: 2 });
  });
});

describe("one-beat bars", () => {
  const ONES = node("3.6.1 | 5.6.1 | 7.6.1");

  it("extend to the bar's edge a whole bar at a time: the caret is on both edges at once", () => {
    expect(extendToBarEdge(ONES, caret(0, 0), 1)).toEqual(caret(1, 0));
    expect(extendToBarEdge(ONES, caret(1, 0), -1)).toEqual(caret(0, 0));
    expect(extendToBarEdge(ONES, caret(2, 0), 1)).toEqual(caret(2, 0));
    expect(extendToBarEdge(ONES, caret(0, 0), -1)).toEqual(caret(0, 0));
  });

  it("are whole bars when one beat is selected, alone or with others", () => {
    expect(isWholeBars(ONES, { from: at(1, 0), to: at(1, 0) })).toBe(true);
    expect(isWholeBars(ONES, { from: at(0, 0), to: at(2, 0) })).toBe(true);
    expect(sizeOf(ONES, { from: at(1, 0), to: at(1, 0) })).toEqual({ wholeBars: true, bars: 1, beats: 1 });
  });
});

describe("barRange and sizeOf", () => {
  it("covers one bar", () => {
    expect(barRange(DOC, 1)).toEqual({ from: at(1, 0), to: at(1, 1) });
    expect(barRange(DOC, 7)).toBeNull();
  });

  it("counts bars and beats, and knows whole bars", () => {
    expect(sizeOf(DOC, { from: at(0, 2), to: at(1, 1) })).toEqual({ wholeBars: false, bars: 2, beats: 4 });
    expect(sizeOf(DOC, { from: at(1, 0), to: at(2, 1) })).toEqual({ wholeBars: true, bars: 2, beats: 4 });
  });

  it("lists every position in reading order", () => {
    expect(positionsIn(DOC, { from: at(0, 3), to: at(1, 1) })).toEqual([at(0, 3), at(1, 0), at(1, 1)]);
  });
});

describe("stillValid", () => {
  it("holds while both ends name beats", () => {
    expect(stillValid(DOC, { from: at(0, 1), to: at(2, 1) })).toBe(true);
  });

  it("holds for one beat — the two ends are the same — and for the score's very first beat", () => {
    expect(stillValid(DOC, { from: at(1, 1), to: at(1, 1) })).toBe(true);
    expect(stillValid(DOC, { from: at(0, 0), to: at(0, 0) })).toBe(true);
  });

  it("fails once a real edit has taken the beat an end names", () => {
    const text = "\\tempo 120\n.\n3.6.4 5.6 7.6 8.6 | 3.6.2 5.6\n";
    const selected = { from: at(1, 0), to: at(1, 1) };
    expect(stillValid(parseTex(text).scoreNode, selected)).toBe(true);
    const edited = deleteBeat(text, caret(1, 1));
    expect(edited && edited.text.split("\n")[2]).toBe("3.6.4 5.6 7.6 8.6 | 3.6.2");
    expect(stillValid(parseTex(edited!.text).scoreNode, selected)).toBe(false);
    // An end that names another beat after the edit is not seen: bar 0's last beat went, and beat 2 is still one.
    const shorter = deleteBeat(text, caret(0, 3))!;
    expect(stillValid(parseTex(shorter.text).scoreNode, { from: at(0, 0), to: at(0, 2) })).toBe(true);
  });

  it("fails when an edit took either end away — the selection is cleared, not clamped", () => {
    const shorter = node("3.6.4 5.6 7.6 8.6 | 3.6.2 5.6");
    expect(stillValid(shorter, { from: at(0, 1), to: at(2, 1) })).toBe(false);
    expect(stillValid(shorter, { from: at(1, 2), to: at(1, 2) })).toBe(false);
  });
});

// An edit can leave a stored range pointing at beats that are not there. stillValid
// says so; sizing or listing such a range must not read it as music.
describe("a range an edit has stranded", () => {
  // bar 1 is a `|` with nothing in it: bars 0 and 2 have beats
  const GAP = node("3.6.4 5.6 | | 7.6.4 r");
  const SHORT = node("3.6.4 5.6 7.6 8.6 | 3.6.2 5.6");
  const STRANDED = [
    { name: "starts in a bar with no beats", doc: GAP, range: { from: at(1, 0), to: at(2, 1) } },
    { name: "starts past the end of its bar", doc: SHORT, range: { from: at(1, 2), to: at(1, 2) } },
    { name: "ends past the last bar", doc: DOC, range: { from: at(0, 0), to: at(5, 0) } },
    { name: "ends past the end of its bar", doc: SHORT, range: { from: at(1, 0), to: at(1, 4) } },
    { name: "has its ends the wrong way round", doc: DOC, range: { from: at(1, 0), to: at(0, 3) } },
    { name: "starts before the first beat", doc: DOC, range: { from: at(0, -1), to: at(0, 3) } },
  ];

  it.each(STRANDED)("is not whole bars, holds no beats and has no size: it $name", ({ doc, range }) => {
    expect(stillValid(doc, range)).toBe(false);
    expect(isWholeBars(doc, range)).toBe(false);
    expect(positionsIn(doc, range)).toEqual([]);
    expect(sizeOf(doc, range)).toEqual({ wholeBars: false, bars: 0, beats: 0 });
  });

  it("is told apart from a range that is only odd: whole bars either side of an empty bar are listed, not dropped", () => {
    const either = { from: at(0, 0), to: at(2, 1) };
    expect(stillValid(GAP, either)).toBe(true);
    expect(isWholeBars(GAP, either)).toBe(true);
    expect(positionsIn(GAP, either)).toEqual([at(0, 0), at(0, 1), at(2, 0), at(2, 1)]);
    expect(sizeOf(GAP, either)).toEqual({ wholeBars: true, bars: 3, beats: 4 });
  });
});
