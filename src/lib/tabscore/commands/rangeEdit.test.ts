/* eslint-disable @typescript-eslint/no-explicit-any --
 * The locality invariant reads alphaTab's model, whose types are only
 * reachable through namespaces that cannot be imported as types.
 */
import { describe, it, expect } from "vitest";
import { clearRange, removeRange } from "./rangeEdit";
import { parseTex } from "../parse";
import type { EditOutcome } from "../apply";
import type { Range } from "../selection";
import { bindings, read } from "./testSupport";

const tex = (body: string) => `\\tempo 120\n.\n${body}\n`;
const caret = (barIndex: number, beatIndex: number, string = 6) => ({ barIndex, beatIndex, string });
const range = (from: [number, number], to: [number, number]): Range => ({
  from: { barIndex: from[0], beatIndex: from[1] },
  to: { barIndex: to[0], beatIndex: to[1] },
});
const body = (outcome: EditOutcome) => {
  if (outcome.kind !== "ok") throw new Error(`expected ok, got ${JSON.stringify(outcome)}`);
  return outcome.result.text.split("\n")[2];
};
const clear = (b: string, from: [number, number], to: [number, number]) => clearRange(tex(b), caret(...from), range(from, to));
const remove = (b: string, from: [number, number], to: [number, number]) => removeRange(tex(b), caret(...from), range(from, to));

describe("clearRange", () => {
  it("turns every selected beat into a rest of the same length, unbinding what crossed it", () => {
    expect(body(clear("3.6.8 5.6{h} 7.6 r | -.6.4 r r r", [0, 1], [0, 2]))).toBe("3.6.8 r r r | 7.6.4 r r r");
  });

  it("unbinds a later tie that held a tie bound to nothing: it becomes the open string it sounded", () => {
    // left a tie, it would reach past the new rest to the first `-.6` and hold that across it
    expect(body(clear("r.4 -.6 -.6 -.6", [0, 2], [0, 2]))).toBe("r.4 -.6 r 0.6");
  });

  it("keeps a length marker that sat on a note, as `r` does", () => {
    expect(body(clear("3.6.8 5.6{d} 7.6.4 r", [0, 1], [0, 1]))).toBe("3.6.8 r{d} 7.6.4 r");
  });

  it("drops the hammer-on before the range that would reach across it", () => {
    expect(body(clear("3.6{h}.4 5.6 7.6 9.6 | 5.6.4 r r r", [0, 1], [0, 3]))).toBe("3.6.4 r r r | 5.6.4 r r r");
  });

  it("unbinds a tie within three bars of the range's last bar, however far its first bar is", () => {
    // The tie holds the 5, two bars on from the range's last bar and six from
    // its first: measured from the first, it would be out of the walk's reach.
    const b = "3.6.4 r r r | r r r r | r r r r | r r r r | 5.6.4 r r r | r r r r | -.6.4 r r r";
    expect(body(clear(b, [0, 0], [4, 0]))).toBe("r.4 r r r | r r r r | r r r r | r r r r | r.4 r r r | r r r r | 5.6.4 r r r");
  });

  it("keeps the caret where it is", () => {
    const out = clearRange(tex("3.6.4 5.6 7.6 8.6"), caret(0, 3, 2), range([0, 1], [0, 3]));
    expect(out.kind === "ok" && out.result.caret).toEqual(caret(0, 3, 2));
  });

  it("changes nothing over rests", () => {
    expect(clear("3.6.4 r r r", [0, 1], [0, 3])).toEqual({ kind: "noop", reason: "alreadyRest" });
  });

  it("is refused, naming the bar, over a bar the commands cannot read", () => {
    expect(clear("3.6.4 r r r | x.6.4 r r r", [0, 0], [1, 1])).toEqual({ kind: "refused", barIndex: 1 });
  });

  it("is refused, naming its first bar, when a beat it cannot read stands where an edge walk must look", () => {
    // the tie would hold nothing once the 5 is a rest, and the way to it passes `x.1.4`, which might hold the string
    expect(clear("5.6.4 r r r | x.1.4 r r r | -.6.4 r r r", [0, 0], [0, 0])).toEqual({ kind: "refused", barIndex: 0 });
  });
});

describe("removeRange: beats", () => {
  it("removes the beats and re-pins the one that followed", () => {
    const out = remove("3.6.8 5.6 7.6 8.6 | r r", [0, 0], [0, 1]);
    expect(body(out)).toBe("7.6.8 8.6 | r r");
    expect(out.kind === "ok" && out.result.caret).toEqual(caret(0, 0));
  });

  it("drops a hammer-on before the gap that would reach across it", () => {
    expect(body(remove("3.6.4 5.6{h} 7.6 9.6", [0, 2], [0, 2]))).toBe("3.6.4 5.6 9.6");
  });

  it("works across a bar line, leaving both bars their other beats", () => {
    const out = remove("3.6.8 5.6 7.6 8.6 | 9.6.4 10.6 r r", [0, 2], [1, 0]);
    expect(body(out)).toBe("3.6.8 5.6 | 10.6.4 r r");
    expect(out.kind === "ok" && out.result.caret).toEqual(caret(1, 0));
  });

  it("puts the caret on the last beat before the range when nothing follows it", () => {
    const out = remove("3.6.4 5.6 7.6 8.6", [0, 2], [0, 3]);
    expect(body(out)).toBe("3.6.4 5.6");
    expect(out.kind === "ok" && out.result.caret).toEqual(caret(0, 1));
  });

  // alphaTab 1.8.1 binds a hammer-on or slide no further than the next bar's
  // first beat, whatever is on it: a rest there, or a beat without that
  // string, leaves it bound to nothing. Removing that beat puts another first.
  it("drops a hammer-on or slide on any string that a bar's new first beat would bind", () => {
    expect(body(remove("3.6.4 r r 5.6{h} | r.4 7.6 r r", [1, 0], [1, 0]))).toBe("3.6.4 r r 5.6 | 7.6 r r");
    expect(body(remove("3.6.4 r r 5.5{sl} | 7.6.4 9.5 r r", [1, 0], [1, 0]))).toBe("3.6.4 r r 5.5 | 9.5 r r");
  });

  it("leaves a tie on a string it did not touch a tie, still holding the same note", () => {
    expect(body(remove("3.5.4 r r r | r -.5 r r", [1, 0], [1, 0]))).toBe("3.5.4 r r r | -.5 r r");
  });

  it("leaves a hammer-on on a string it did not touch, which binds past the beats that go", () => {
    expect(body(remove("5.5{h}.4 r 7.6 7.5", [0, 2], [0, 2]))).toBe("5.5{h}.4 r 7.5");
  });

  // A bar's new first beat can bind legato from the bar before only on the
  // strings it plays (left-hand taps aside, below). Walking back on the others
  // refuses for no reason — a beat it cannot read, within three bars — and
  // rewrites a hammer-on that binds to nothing either way.
  it("looks back for legato only on the strings of the beat that comes first", () => {
    // a rest comes first: nothing before it can bind to it, so the dead note three bars back is not in the way
    expect(body(remove("x.6.4 r r r | r r r r | r r r r | r.4 r r r", [3, 0], [3, 0]))).toBe(
      "x.6.4 r r r | r r r r | r r r r | r r r",
    );
    // string 5 comes first: the hammer-on before it is dropped, and the walk ends at it, never reaching the dead note on string 6
    expect(body(remove("x.6.4 r r r | r r r r | r.4 r r 3.5{h} | r.4 5.5 r r", [3, 0], [3, 0]))).toBe(
      "x.6.4 r r r | r r r r | r.4 r r 3.5 | 5.5 r r",
    );
    // a slide on it is no tap: still string 5 alone
    expect(body(remove("x.6.4 r r r | r r r r | r.4 r r 3.5{h} | r.4 5.5{sl} r r", [3, 0], [3, 0]))).toBe(
      "x.6.4 r r r | r r r r | r.4 r r 3.5 | 5.5{sl} r r",
    );
  });

  it("is still refused when a beat it cannot read stands on the way back for a string the beat that comes first plays", () => {
    expect(remove("x.6.4 r r r | r r r r | r r r r | r.4 3.6 r r", [3, 0], [3, 0])).toEqual({ kind: "refused", barIndex: 3 });
  });

  it("leaves a hammer-on on a string the beat that comes first does not play: it binds to nothing either way", () => {
    expect(body(remove("3.5.4 r r 5.5{h} | r.4 7.6 r r", [1, 0], [1, 0]))).toBe("3.5.4 r r 5.5{h} | 7.6 r r");
  });

  it("looks back on every string when the beat that comes first holds a left-hand tap, which a hammer-on binds to from another string", () => {
    expect(body(remove("3.6.4 r r 5.5{h} | r.4 3.6{lht} r r", [1, 0], [1, 0]))).toBe("3.6.4 r r 5.5 | 3.6{lht} r r");
    // on any note of a chord
    expect(body(remove("3.6.4 r r 5.5{h} | r.4 (3.6 3.4{lht}) r r", [1, 0], [1, 0]))).toBe(
      "3.6.4 r r 5.5 | (3.6 3.4{lht}) r r",
    );
  });

  // alphaTab 1.8.1 binds a slide to the next note on its own string only (nextNoteOnSameLine): a tap on
  // another string never takes one, so on the strings the tap alone brings in, only a hammer-on goes.
  it("leaves a slide on another string than the tap's: only a hammer-on binds to a tap across strings", () => {
    expect(body(remove("3.6.4 r r 5.5{sl} | r.4 3.6{lht} r r", [1, 0], [1, 0]))).toBe("3.6.4 r r 5.5{sl} | 3.6{lht} r r");
    expect(body(remove("3.6.4 r r 5.5{ss} | r.4 3.6{lht} r r", [1, 0], [1, 0]))).toBe("3.6.4 r r 5.5{ss} | 3.6{lht} r r");
    // a note with both keeps its slide and loses its hammer-on
    expect(body(remove("3.6.4 r r 5.5{pm h} | r.4 3.6{lht} r r", [1, 0], [1, 0]))).toBe("3.6.4 r r 5.5{pm} | 3.6{lht} r r");
    // on the tap's own string a slide binds to it as to any note there, and goes
    expect(body(remove("3.6.4 r r 5.6{sl} | r.4 3.6{lht} r r", [1, 0], [1, 0]))).toBe("3.6.4 r r 5.6 | 3.6{lht} r r");
  });

  it("finds the tap by its property, however it is spelled: alphaTab ignores an empty argument list", () => {
    expect(body(remove("3.6.4 r r 5.5{h} | r.4 3.6{lht()} r r", [1, 0], [1, 0]))).toBe("3.6.4 r r 5.5 | 3.6{lht()} r r");
    expect(body(remove("3.6.4 r r 5.5{h} | r.4 (3.6 3.4{lht ()}) r r", [1, 0], [1, 0]))).toBe(
      "3.6.4 r r 5.5 | (3.6 3.4{lht ()}) r r",
    );
    expect(body(remove("3.6.4 r r 5.5{h} | r.4 3.6{pm lht()} r r", [1, 0], [1, 0]))).toBe(
      "3.6.4 r r 5.5 | 3.6{pm lht()} r r",
    );
  });

  it("is refused when a bar would be left empty — whole bars go only as whole bars", () => {
    expect(remove("3.6.4 r r r | 5.6.4 r r r | 7.6.4 r r r", [0, 2], [2, 1])).toEqual({
      kind: "refused",
      barIndex: 1,
      why: "wouldEmptyBar",
    });
  });
});

describe("removeRange: whole bars", () => {
  it("makes a later tie whose origin went the fret it sounded", () => {
    const out = remove("3.6 | 7.6 | -.6", [1, 0], [1, 0]);
    expect(body(out)).toBe("3.6 | 7.6");
    expect(out.kind === "ok" && out.result.caret).toEqual(caret(1, 0));
  });

  it("removes several bars and keeps the header", () => {
    const out = remove("3.6.4 r r r | 5.6.4 r r r | 7.6.4 r r r", [0, 0], [1, 3]);
    expect(out.kind === "ok" && out.result.text).toBe("\\tempo 120\n.\n7.6.4 r r r\n");
  });

  it("lands on the last beat before them when the score's last bars go", () => {
    const out = remove("3.6.4 r r r | 5.6.4 r r r | 7.6.4 r r r", [1, 0], [2, 3]);
    expect(body(out)).toBe("3.6.4 r r r");
    expect(out.kind === "ok" && out.result.caret).toEqual(caret(0, 3));
  });

  it("is refused for every bar — a tab needs one", () => {
    expect(remove("3.6.4 r r r | 5.6.4 r r r", [0, 0], [1, 3])).toEqual({
      kind: "refused",
      barIndex: 0,
      why: "wouldRemoveAll",
    });
  });

  it("is refused for every bar that has beats, though a `|` with nothing after or before it is a bar to the text", () => {
    // those bars hold no music: alphaTab drops an empty bar at the end and keeps one before or between bars as a
    // single empty beat, so the tab would be left with no music at all
    const all = { kind: "refused", why: "wouldRemoveAll" };
    expect(remove("3.6.4 r r r | |", [0, 0], [0, 3])).toEqual({ ...all, barIndex: 0 });
    expect(remove("3.6.4 r r r | 5.6.4 r r r | |", [0, 0], [1, 3])).toEqual({ ...all, barIndex: 0 });
    expect(remove("| 3.6.4 r r r", [1, 0], [1, 3])).toEqual({ ...all, barIndex: 1 });
    expect(remove("| 3.6.4 r r r | 5.6.4 r r r", [1, 0], [2, 3])).toEqual({ ...all, barIndex: 1 });
  });

  it("goes ahead while another bar has beats, whatever empty bars stand about it", () => {
    expect(body(remove("3.6.4 r r r | | 5.6.4 r r r", [0, 0], [0, 3]))).toBe("| 5.6.4 r r r");
    expect(body(remove("3.6.4 r r r | 5.6.4 r r r | |", [1, 0], [1, 3]))).toBe("3.6.4 r r r | |");
  });

  // The bars of the text are every track's, staff's and voice's in turn: one
  // going leaves the others out of step, and a tie in the next track could
  // find its origin in the bar that went (and sound another note).
  it.each([
    [
      "track",
      '\\tempo 120\n\\track "A"\n.\n3.6.4 r r r | 5.6.4 r r r\n\\track "B"\n.\n-.6.4 r r r | 7.6.4 r r r\n',
    ],
    ["staff", "\\tempo 120\n\\staff\n.\n3.6.4 r r r | 5.6.4 r r r\n\\staff\n3.6.4 r r r | 7.6.4 r r r\n"],
    [
      "voice",
      "\\tempo 120\n.\n\\voice\n3.6.4 5.6 7.6 8.6 | 3.6.4 5.6 7.6 8.6\n\\voice\n0.1.2 0.1.2 | 0.1.2 0.1.2\n",
    ],
  ])("is refused in a tab of more than one %s, naming its first bar and why", (_kind, text) => {
    expect(removeRange(text, caret(1, 0), range([1, 0], [1, 3]))).toEqual({
      kind: "refused",
      barIndex: 1,
      why: "severalTracks",
    });
  });

  it("is refused for a bar that carries a sign of its own, but not for the header above bar 1", () => {
    expect(remove("3.6.4 r r r | \\ro 5.6.4 r r r | 7.6.4 r r r", [1, 0], [1, 3])).toEqual({
      kind: "refused",
      barIndex: 1,
      why: "barsCarrySigns",
    });
    expect(body(remove("3.6.4 r r r | 5.6.4 r r r", [0, 0], [0, 3]))).toBe("5.6.4 r r r");
  });
});

// The beat right after the bars that go is where removing them could re-time
// or re-pitch music outside the selection: it may inherit its duration from
// them, tie to them, or be what a hammer-on before them would reach next.
describe("removeRange: the beat after whole bars", () => {
  it("keeps the duration it inherited from the bars that went", () => {
    const out = remove("3.6.4 r r r | 5.6.8 r r r r r r r | 7.6 r r r r r r r", [1, 0], [1, 7]);
    expect(body(out)).toBe("3.6.4 r r r | 7.6.8 r r r r r r r");
    expect(out.kind === "ok" && out.result.caret).toEqual(caret(1, 0));
  });

  it("keeps it when that beat is also a tie to the bars that went", () => {
    expect(body(remove("3.6.4 r r r | 5.6.8 r r r r r r 7.6 | -.6 r r r r r r r", [1, 0], [1, 7]))).toBe(
      "3.6.4 r r r | 7.6.8 r r r r r r r",
    );
  });

  it("is not reached by a hammer-on before the bars that went, however many went", () => {
    // left alone, the 5's hammer-on would bind to the 9, the next bar's first note now
    expect(body(remove("3.6.4 r r 5.6{h} | 7.6.4 r r r | 9.6.4 r r r", [1, 0], [1, 3]))).toBe("3.6.4 r r 5.6 | 9.6.4 r r r");
    // the walk back reaches from the first bar that goes, not the last
    expect(body(remove("3.6.4 r r 5.6{h} | 7.6.4 r r r | r r r r | r r r r | r r r r | 9.6.4 r r r", [1, 0], [4, 3]))).toBe(
      "3.6.4 r r 5.6 | 9.6.4 r r r",
    );
  });

  it("keeps sounding the open string when it was a tie alphaTab bound to nothing", () => {
    // Four bars from the 3, the tie sounds the open string. With a bar gone it
    // would be three bars from it, and bind: it is written as the fret it sounded.
    expect(body(remove("3.6.4 r r r | r r r r | r r r r | r r r r | -.6.4 r r r", [1, 0], [1, 3]))).toBe(
      "3.6.4 r r r | r r r r | r r r r | 0.6.4 r r r",
    );
  });

  it("is found within three bars of the last bar that went, however far the first one was", () => {
    // the tie holds the 5 two bars on from the last bar going, five bars on from the first
    const b = "3.6.4 r r r | r r r r | r r r r | r r r r | 5.6.4 r r r | r r r r | -.6.4 r r r";
    expect(body(remove(b, [1, 0], [4, 3]))).toBe("3.6.4 r r r | r r r r | 5.6.4 r r r");
  });
});

describe("removeRange: bars the commands cannot read", () => {
  it("removes whole bars without reading them, as − Bar does", () => {
    expect(body(remove("3.6.4 r r r | x.6.4 r r r | 7.6.4 r r r", [1, 0], [1, 3]))).toBe("3.6.4 r r r | 7.6.4 r r r");
  });

  it("is refused, naming the bar, when the beats to remove sit in one", () => {
    expect(remove("3.6.4 r r r | x.6.4 r r r", [1, 1], [1, 2])).toEqual({ kind: "refused", barIndex: 1 });
  });

  it("is refused, naming its first bar, when a beat it cannot read stands where an edge walk must look", () => {
    // a tie after the bar going would sound a different note, and the way back to its origin passes `x.6`
    expect(remove("5.6.4 r r r | x.6.4 r r r | 3.5.4 r r r | -.6.4 r r r", [2, 0], [2, 3])).toEqual({
      kind: "refused",
      barIndex: 2,
    });
  });
});

describe("clearRange and removeRange", () => {
  it("are refused when the range no longer names beats", () => {
    expect(clear("3.6.4 r r r", [0, 2], [0, 9])).toEqual({ kind: "refused", barIndex: 0 });
    expect(remove("3.6.4 r r r", [0, 2], [0, 9])).toEqual({ kind: "refused", barIndex: 0 });
    // plainly: not for a reason the stale range only seems to give (it would empty bar 1)
    expect(remove("3.6.4 r r r | 5.6.4 r", [0, 0], [1, 3])).toEqual({ kind: "refused", barIndex: 0 });
  });
});

describe("invariant: a range edit changes nothing outside the range", () => {
  // Ties and legato across rests and bar lines, chords, tuplets and dots.
  const CORPUS = [
    "5.6.4 -.6 r r | -.6.8 7.6{h} 9.6 r r.4 r.4",
    "(5.6 7.5).4 (-.6 9.5{h}) 10.5 -.5 | -.5.8 5.6{sl} 7.6 r r.2",
    "3.6{h}.8 5.6 r 5.5{ss} 7.5 r.4 | -.5.4 3.6.8 r r.2 | 7.6.4 -.6 -.6 -.6",
    "0.6.4 2.5{h} 4.5 r | 2.5.4 -.5 0.6{sl} 2.6 | -.6.2 5.4 r",
    "3.6.8{tu 3} 5.6.8{tu 3} 7.6.8{tu 3} r.4 r.2 | -.6.4{d} 5.6.8 r.2",
    // Bars that start without a duration of their own, inheriting the last
    // bar's, one a tie across the bar line: the beat after a removed range
    // must be re-pinned (H01).
    "3.6.4 5.6{h} 7.6 r | 5.5.8 r r -.5 7.6 r r r | r.4 r 9.6 r | -.6 r r r",
    // A tie four bars from the note before it: alphaTab binds it to nothing,
    // and removing a bar between them must not let it bind.
    "3.6.4 r r r | r r r r | r r r r | r r r r | -.6.4 r r r",
    // Legato at a bar's end before a bar that starts with a rest: it binds to
    // nothing, and must not once the rest is gone.
    "3.6.4 r r 5.6{h} | r.4 7.6 r 5.5{sl} | r.4 9.5 r r",
    // A chain of ties bound to nothing (the open string), across a rest and a bar line.
    "-.6.4 -.6 r -.6 | -.6.4 r r r",
    // A hammer-on that binds across strings, to a left-hand tap on a bar's first beat: with a rest
    // there it binds to nothing, and must not bind to the tap once the rest is gone.
    "3.6.4 r r 5.5{h} | r.4 3.6{lht} r r | 7.6.4 r r r",
  ].map(tex);

  const inRange = (r: Range, barIndex: number, beatIndex: number) =>
    (barIndex > r.from.barIndex || (barIndex === r.from.barIndex && beatIndex >= r.from.beatIndex)) &&
    (barIndex < r.to.barIndex || (barIndex === r.to.barIndex && beatIndex <= r.to.beatIndex));
  const ranges = (text: string): Range[] => {
    const flat = parseTex(text).scoreNode.bars.flatMap((bar: any, barIndex: number) =>
      bar.beats.map((_: unknown, beatIndex: number) => ({ barIndex, beatIndex })),
    );
    return flat.flatMap((from: Range["from"], i: number) => flat.slice(i).map((to: Range["to"]) => ({ from, to })));
  };

  it("clearRange: every beat keeps its length; outside the range, its pitch too", () => {
    let acted = 0;
    for (const text of CORPUS) {
      const before = read(text);
      for (const r of ranges(text)) {
        const out = clearRange(text, caret(r.from.barIndex, r.from.beatIndex), r);
        if (out.kind !== "ok") continue;
        acted++;
        const after = read(out.result.text);
        before.forEach((bar, barIndex) =>
          bar.forEach((beat, beatIndex) => {
            const now = after[barIndex][beatIndex];
            expect(now.length).toBe(beat.length);
            if (!inRange(r, barIndex, beatIndex)) expect(now.pitch, `${barIndex}:${beatIndex}`).toBe(beat.pitch);
          }),
        );
      }
    }
    expect(acted).toBeGreaterThan(100);
  });

  it("removeRange: what is left is everything outside the range, unchanged", () => {
    let acted = 0;
    for (const text of CORPUS) {
      const before = read(text);
      for (const r of ranges(text)) {
        const out = removeRange(text, caret(r.from.barIndex, r.from.beatIndex), r);
        if (out.kind !== "ok") continue;
        acted++;
        const kept = before.flatMap((bar, barIndex) => bar.filter((_, beatIndex) => !inRange(r, barIndex, beatIndex)));
        expect(read(out.result.text).flat()).toEqual(kept);
      }
    }
    expect(acted).toBeGreaterThan(50);
  });

  // The edge rules strip a hammer-on or slide, and untie a tie, whose note
  // went; nothing outside the range may bind to anything it did not bind to.
  it("neither binds a note outside the range to anything it was not bound to", () => {
    let checked = 0;
    for (const text of CORPUS) {
      const before = bindings(text);
      const flat = read(text).flatMap((bar, barIndex) => bar.map((_, beatIndex) => [barIndex, beatIndex]));
      for (const r of ranges(text)) {
        const cleared = clearRange(text, caret(r.from.barIndex, r.from.beatIndex), r);
        if (cleared.kind === "ok") {
          for (const [key, to] of bindings(cleared.result.text)) {
            const [barIndex, beatIndex] = key.split("/")[0].split(":").map(Number);
            if (!inRange(r, barIndex, beatIndex)) expect(before.get(key), `clear ${key}`).toBe(to);
          }
          checked++;
        }
        const removed = removeRange(text, caret(r.from.barIndex, r.from.beatIndex), r);
        if (removed.kind === "ok") {
          // where each beat outside the range is now, and was
          const now = read(removed.result.text).flatMap((bar, barIndex) => bar.map((_, beatIndex) => `${barIndex}:${beatIndex}`));
          const was = flat.filter(([barIndex, beatIndex]) => !inRange(r, barIndex, beatIndex)).map(([b, i]) => `${b}:${i}`);
          const moved = new Map(was.map((pos, i) => [pos, now[i]]));
          for (const [key, to] of bindings(removed.result.text)) {
            const [pos, ...rest] = key.split("/");
            const old = before.get([was[now.indexOf(pos)], ...rest].join("/"));
            expect(old && moved.get(old), `remove ${key}`).toBe(to);
          }
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(300);
  });
});
