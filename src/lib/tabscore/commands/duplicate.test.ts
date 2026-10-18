/* eslint-disable @typescript-eslint/no-explicit-any --
 * The invariant reads alphaTab's model, whose types are only reachable
 * through namespaces that cannot be imported as types.
 */
import { describe, it, expect } from "vitest";
import { duplicate } from "./duplicate";
import { parseTex } from "../parse";
import type { EditOutcome } from "../apply";
import { rangeOf, type Range } from "../selection";
import { bindings, model, read, type ModelBeat } from "./testSupport";

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

describe("duplicate", () => {
  it("with nothing selected repeats the caret's bar right after it, and selects the copy", () => {
    const out = duplicate(tex("3.6.4 5.6 7.6 8.6 | 9.6.2 r"), caret(0, 2), null);
    expect(body(out)).toBe("3.6.4 5.6 7.6 8.6 | 3.6.4 5.6 7.6 8.6 | 9.6.2 r");
    expect(out.kind === "ok" && out.selection).toEqual(range([1, 0], [1, 3]));
    expect(out.kind === "ok" && out.result.caret).toEqual(caret(1, 0));
  });

  it("repeats the last bar at the end of the score", () => {
    expect(body(duplicate(tex("3.6.4 r r r | 5.6.8 r r r r r r r"), caret(1, 0), null))).toBe(
      "3.6.4 r r r | 5.6.8 r r r r r r r | 5.6.8 r r r r r r r",
    );
  });

  it("repeats selected whole bars after the last of them", () => {
    const out = duplicate(tex("3.6.4 r r r | 5.6.4 r r r | 7.6.4 r r r"), caret(0, 0), range([0, 0], [1, 3]));
    expect(body(out)).toBe("3.6.4 r r r | 5.6.4 r r r | 3.6.4 r r r | 5.6.4 r r r | 7.6.4 r r r");
    expect(out.kind === "ok" && out.selection).toEqual(range([2, 0], [3, 3]));
  });

  it("puts a copy of selected beats right after them; the bar grows, nothing after is re-timed", () => {
    const out = duplicate(tex("3.6.8 5.6 7.6 8.6 r r r r"), caret(0, 1), range([0, 1], [0, 2]));
    expect(body(out)).toBe("3.6.8 5.6 7.6 5.6.8 7.6 8.6 r r r r");
    expect(out.kind === "ok" && out.selection).toEqual(range([0, 3], [0, 4]));
  });

  it("drops the original's hammer-on that would now reach into the copy", () => {
    expect(body(duplicate(tex("3.6.4 5.6{h} 7.6 r"), caret(0, 1), range([0, 1], [0, 1])))).toBe("3.6.4 5.6 5.6.4 7.6 r");
  });

  // A hammer-on binds to a left-hand tap on another string. A paste of a tap
  // drops an earlier one on any string, since the tap could capture it. A copy
  // of beats lands right after them: a hammer-on before them was bound by them
  // or passed them, and binds the same past their copy — so duplicate looks back
  // on the copy's own strings only, and keeps the rest.
  it("keeps an earlier hammer-on or slide on another string when the copy holds a left-hand tap: it binds as before", () => {
    const hammer = duplicate(tex("3.5{h}.4 7.6{lht}.4 r r"), caret(0, 1), range([0, 1], [0, 1]));
    expect(body(hammer)).toBe("3.5{h}.4 7.6{lht}.4 7.6{lht}.4 r r");
    expect(hammer.kind === "ok" && hammer.selection).toEqual(range([0, 2], [0, 2]));
    const slide = duplicate(tex("3.4{sl}.4 r 7.6{lht}.4 5.4.4"), caret(0, 2), range([0, 2], [0, 2]));
    expect(body(slide)).toBe("3.4{sl}.4 r 7.6{lht}.4 7.6{lht}.4 5.4.4");
    // and with no tap among the beats copied, as before
    expect(body(duplicate(tex("3.5{h}.4 r 7.6.4 r"), caret(0, 2), range([0, 2], [0, 2])))).toBe("3.5{h}.4 r 7.6.4 7.6.4 r");
  });

  it("binds the kept hammer-on to the original tap, and the slide to its note, as before the copy", () => {
    const beat0 = (outcome: EditOutcome) =>
      parseTex(outcome.kind === "ok" ? outcome.result.text : "").score.tracks[0].staves[0].bars[0].voices[0].beats[0];
    const hammer = beat0(duplicate(tex("3.5{h}.4 7.6{lht}.4 r r"), caret(0, 1), range([0, 1], [0, 1])));
    expect(hammer.notes[0].hammerPullDestination?.beat.index).toBe(1);
    const slide = beat0(duplicate(tex("3.4{sl}.4 r 7.6{lht}.4 5.4.4"), caret(0, 2), range([0, 2], [0, 2])));
    expect(slide.notes[0].slideTarget?.beat.index).toBe(4);
  });

  it("leaves a repeat sign on the original: the copy is outside the repeat", () => {
    const out = duplicate(tex("\\ro 3.6.4 r r r | \\rc 2 5.6.4 r r r | 7.6.4 r r r"), caret(1, 0), null);
    expect(body(out)).toBe("\\ro 3.6.4 r r r | \\rc 2 5.6.4 r r r | 5.6.4 r r r | 7.6.4 r r r");
    const score = parseTex(out.kind === "ok" ? out.result.text : "").score;
    expect(score.masterBars.map((m: { repeatCount: number }) => m.repeatCount)).toEqual([0, 2, 0, 0]);
  });

  it("refuses beats selected across a bar line, from mid-bar or ending on a bar's last beat", () => {
    const doc = tex("3.6.4 5.6 7.6 8.6 | 9.6.4 r r r");
    expect(duplicate(doc, caret(0, 2), range([0, 2], [1, 1]))).toEqual({ kind: "refused", barIndex: 0, why: "crossesBarLine" });
    expect(duplicate(doc, caret(0, 2), range([0, 2], [1, 3]))).toEqual({ kind: "refused", barIndex: 0, why: "crossesBarLine" });
  });

  it("refuses a bar the commands cannot read", () => {
    expect(duplicate(tex("x.6.4 r r r"), caret(0, 0), null)).toEqual({ kind: "refused", barIndex: 0 });
  });

  // An edit can strand a stored selection. The command declines it as it declines
  // any bar it cannot read, not as beats across a bar line, which says what to do.
  it("refuses a range an edit has stranded, without saying it crosses a bar line", () => {
    const doc = tex("3.6.4 r r r | 5.6.4 r r r");
    expect(duplicate(doc, caret(0, 0), range([0, 0], [9, 0]))).toEqual({ kind: "refused", barIndex: 0 });
    expect(duplicate(doc, caret(1, 0), range([1, 0], [0, 3]))).toEqual({ kind: "refused", barIndex: 1 });
    expect(duplicate(doc, caret(0, 0), range([5, 0], [5, 3]))).toEqual({ kind: "refused", barIndex: 5 });
    expect(duplicate(tex("3.6.4 r r r | | 5.6.4 r r r"), caret(0, 0), range([1, 0], [2, 3]))).toEqual({ kind: "refused", barIndex: 1 });
  });
});

describe("duplicate: ties", () => {
  const pitchAt = (text: string, barIndex: number, beatIndex = 0): number =>
    parseTex(text).score.tracks[0].staves[0].bars[barIndex].voices[0].beats[beatIndex].notes[0].realValue;

  it("makes a tie that opens the copied bar the fret it sounds, as copying does", () => {
    expect(body(duplicate(tex("5.6.4 r r r | -.6.4 r r r"), caret(1, 0), null))).toBe("5.6.4 r r r | -.6.4 r r r | 5.6.4 r r r");
  });

  it("writes the open string for it only when nothing on its string is within alphaTab's three bars", () => {
    expect(body(duplicate(tex("r.4 r r r | -.6.4 r r r"), caret(1, 0), null))).toBe("r.4 r r r | -.6.4 r r r | 0.6.4 r r r");
    // three bars back it still binds to the 3; four bars back it binds to nothing, and sounds the open E
    const near = duplicate(tex("3.6.4 r r r | r r r r | r r r r | -.6.4 r r r"), caret(3, 0), null);
    expect(body(near).endsWith("| -.6.4 r r r | 3.6.4 r r r")).toBe(true);
    const far = duplicate(tex("3.6.4 r r r | r r r r | r r r r | r r r r | -.6.4 r r r"), caret(4, 0), null);
    expect(body(far).endsWith("| -.6.4 r r r | 0.6.4 r r r")).toBe(true);
  });

  it("is refused, changing nothing, when the tie's origin cannot be read: no guessed fret", () => {
    // the x.6.4 might hold the note the tie sounds: the 5 behind it would be written as pitch 45 where the source sounds 40
    expect(duplicate(tex("5.6.4 r r r | x.6.4 r r r | -.6.4 r r r"), caret(2, 0), null)).toEqual({ kind: "refused", barIndex: 2 });
  });

  it("is refused on the tie alone: no edge walk reaches the beat that hides its origin", () => {
    // The walks look three bars back from the copy and stop at the tie's own string; only the chain behind
    // the tie meets the x.6.4, one bar before it. The copy of the beats, and of the three bars, must say no.
    const beats = tex("5.6.4 r r r | x.6.4 r r r | -.6.4 5.5 r r");
    expect(duplicate(beats, caret(2, 1), range([2, 0], [2, 1]))).toEqual({ kind: "refused", barIndex: 2 });
    // the tie alone, a beat of its bar: its string meets nothing but the x.6.4 behind it
    const lone = tex("5.6.4 r r r | x.6.4 r r r | 3.5.4 -.6.4 r r");
    expect(duplicate(lone, caret(2, 1), range([2, 1], [2, 1]))).toEqual({ kind: "refused", barIndex: 2 });
    const bars = tex("5.6.4 r r r | x.6.4 r r r | -.6.4 r r r | r r r r | r r r r");
    expect(duplicate(bars, caret(4, 3), range([2, 0], [4, 3]))).toEqual({ kind: "refused", barIndex: 2 });
  });

  it("is refused, naming the bar it copies, when a tie after the copy cannot be followed back to its note", () => {
    // the copy of bar 4 would stand between that bar and the tie in bar 5; the chain behind the tie ends at x.1.4
    const doc = tex("5.6.4 r r r | x.1.4 r r r | -.6.4 r r r | (3.5 2.4 1.3 0.2 0.1).4 r r r | -.6.4 r r r");
    expect(duplicate(doc, caret(3, 0), null)).toEqual({ kind: "refused", barIndex: 3 });
    expect(duplicate(doc, caret(3, 0), range([3, 0], [3, 3]))).toEqual({ kind: "refused", barIndex: 3 });
  });

  it("writes a tie the copy pushes out of alphaTab's reach as the fret it sounded", () => {
    // bar 4's tie binds to the 3 three bars back; one bar more and it would sound the open E
    const doc = tex("3.6.4 r r r | r r r r | r r r r | -.6.4 r r r");
    const one = duplicate(doc, caret(1, 0), null);
    expect(body(one)).toBe("3.6.4 r r r | r r r r | r.4 r r r | r r r r | 3.6.4 r r r");
    expect(one.kind === "ok" && pitchAt(one.result.text, 4)).toBe(pitchAt(doc, 3));
    const two = duplicate(doc, caret(1, 0), range([1, 0], [2, 3]));
    expect(body(two)).toBe("3.6.4 r r r | r r r r | r r r r | r.4 r r r | r r r r | 3.6.4 r r r");
    expect(two.kind === "ok" && pitchAt(two.result.text, 5)).toBe(pitchAt(doc, 3));
  });

  it("reaches a tie three bars past the copy of several bars, more than three bars from where they start", () => {
    // The tie holds the 7 from bar 3, the last bar copied; it is the farthest tie the copy can come between.
    const doc = tex("3.6.4 r r r | 5.6.4 r r r | 7.6.4 r r r | r r r r | r r r r | -.6.4 r r r");
    const out = duplicate(doc, caret(2, 0), range([0, 0], [2, 3]));
    expect(body(out)).toBe(
      "3.6.4 r r r | 5.6.4 r r r | 7.6.4 r r r | 3.6.4 r r r | 5.6.4 r r r | 7.6.4 r r r | r r r r | r r r r | 7.6.4 r r r",
    );
    expect(out.kind === "ok" && pitchAt(out.result.text, 8)).toBe(pitchAt(doc, 5));
  });

  it("leaves a tie that was bound to nothing sounding the open string it sounded", () => {
    const doc = tex("3.6.4 r r r | r r r r | r r r r | r r r r | -.6.4 r r r");
    const out = duplicate(doc, caret(2, 0), null);
    expect(body(out)).toBe("3.6.4 r r r | r r r r | r r r r | r.4 r r r | r r r r | 0.6.4 r r r");
    expect(out.kind === "ok" && pitchAt(out.result.text, 5)).toBe(pitchAt(doc, 4));
  });

  it("writes the tie after a copy of beats as the fret it sounded, which is the copy's last note", () => {
    const out = duplicate(tex("3.6.4 5.6 7.6 8.6 | -.6.4 r r r"), caret(0, 3), range([0, 2], [0, 3]));
    expect(body(out)).toBe("3.6.4 5.6 7.6 8.6 7.6.4 8.6 | 8.6.4 r r r");
  });
});

describe("duplicate: what stays where it was", () => {
  const masterBars = (outcome: EditOutcome) => parseTex(outcome.kind === "ok" ? outcome.result.text : "").score.masterBars;

  it("puts the copy in front of the next bar's directives, so a repeat that starts there still starts there", () => {
    const out = duplicate(tex("3.6.4 r r r | \\ro 5.6.4 r r r | \\rc 2 7.6.4 r r r"), caret(0, 0), null);
    expect(body(out)).toBe("3.6.4 r r r | 3.6.4 r r r | \\ro 5.6.4 r r r | \\rc 2 7.6.4 r r r");
    expect(masterBars(out).map((m: any) => m.isRepeatStart)).toEqual([false, false, true, false]);
    expect(masterBars(out).map((m: any) => m.repeatCount)).toEqual([0, 0, 0, 2]);
  });

  it("gives the copy none of the bar's own directives: its section stays on the original", () => {
    const out = duplicate(tex("\\section A 3.6.4 r r r | 5.6.4 r r r"), caret(0, 0), null);
    expect(body(out)).toBe("\\section A 3.6.4 r r r | 3.6.4 r r r | 5.6.4 r r r");
    expect(masterBars(out).map((m: any) => m.section?.text ?? null)).toEqual(["A", null, null]);
  });

  it("repeats the last bar of a text that ends in a bar line", () => {
    expect(body(duplicate(tex("3.6.4 r r r | 5.6.4 r r r |"), caret(1, 0), null))).toBe("3.6.4 r r r | 5.6.4 r r r | 5.6.4 r r r");
  });

  it("repeats a bar with an empty bar after it right after it, not after the empty one", () => {
    expect(body(duplicate(tex("3.6.4 r r r | | 5.6.4 r r r"), caret(0, 0), null))).toBe("3.6.4 r r r | 3.6.4 r r r | | 5.6.4 r r r");
  });

  it("keeps the caret's string, and puts the caret on the copy's first beat", () => {
    const out = duplicate(tex("3.6.4 r r r | 5.6.4 r r r"), caret(1, 3, 2), range([0, 0], [1, 3]));
    expect(out.kind === "ok" && out.result.caret).toEqual(caret(2, 0, 2));
  });
});

describe("duplicate: what it cannot do", () => {
  it("refuses a document that does not parse, naming the caret's bar", () => {
    expect(duplicate(tex("((("), caret(1, 0), null)).toEqual({ kind: "refused", barIndex: 1 });
    expect(duplicate(tex("((("), caret(1, 0), range([0, 0], [0, 1]))).toEqual({ kind: "refused", barIndex: 1 });
  });

  it("refuses a bar with no beats, and whole bars with one among them, naming it", () => {
    const doc = tex("3.6.4 r r r | | 5.6.4 r r r");
    expect(duplicate(doc, caret(1, 0), null)).toEqual({ kind: "refused", barIndex: 1 });
    expect(duplicate(doc, caret(0, 0), range([0, 0], [2, 3]))).toEqual({ kind: "refused", barIndex: 1 });
  });

  it("refuses a tab of more than one track, which a new bar would put out of step, saying so", () => {
    const doc = tex('3.6.4 r r r | 5.6.4 r r r \\track "B" . 7.6.4 r r r | 8.6.4 r r r');
    const severalTracks = { kind: "refused", barIndex: 1, why: "severalTracks" };
    expect(duplicate(doc, caret(1, 2), null)).toEqual(severalTracks);
    expect(duplicate(doc, caret(1, 3), range([0, 0], [1, 3]))).toEqual(severalTracks);
    // beats go into their own bar, which is refused as a bar the commands cannot read
    expect(duplicate(doc, caret(1, 1), range([1, 0], [1, 1]))).toEqual({ kind: "refused", barIndex: 1 });
  });

  it("refuses a bar whose beats take a length from before it, as copying does: no length is guessed", () => {
    // a sticky `:8{tu 3}` makes every bare beat after it a triplet; the copy's would be plain 8ths
    const doc = "\\tempo 120\n.\n:8{tu 3} 3.6 5.6 7.6 | 3.6 5.6 7.6\n";
    expect(duplicate(doc, caret(0, 0), null)).toEqual({ kind: "refused", barIndex: 0 });
    expect(duplicate(doc, caret(1, 0), null)).toEqual({ kind: "refused", barIndex: 1 });
  });

  it("refuses, naming the bar it copies, when an unreadable beat stands where an edge must look", () => {
    expect(duplicate(tex("3.6.4 r r r | x.6.4 r r r"), caret(0, 0), null)).toEqual({ kind: "refused", barIndex: 0 });
    expect(duplicate(tex("3.6.4 r r r | x.1.4 r r r | -.6.4 r r r"), caret(0, 0), null)).toEqual({ kind: "refused", barIndex: 0 });
  });
});

describe("invariant: a duplicate sounds like the music it repeats and changes nothing else", () => {
  const CORPUS = [
    "5.6.4 -.6 r r | -.6.8 7.6{h} 9.6 r r.4 r.4",
    "(5.6 7.5).4 (-.6 9.5{h}) 10.5 -.5 | -.5.8 5.6{sl} 7.6 r r.2",
    "3.6{h}.8 5.6 r 5.5{ss} 7.5 r.4 | -.5.4 3.6.8 r r.2 | 7.6.4 -.6 -.6 -.6",
    "3.6.8{tu 3} 5.6.8{tu 3} 7.6.8{tu 3} r.4 r.2 | -.6.4{d} 5.6.8 r.2",
    // bars that start without a duration of their own, one a tie across the bar line
    "3.6.4 5.6{h} 7.6 r | 5.5.8 r r -.5 7.6 r r r | r.4 r 9.6 r | -.6 r r r",
    // a tie four bars from its note: alphaTab binds it to nothing, and a copy must not give it one
    "3.6.4 r r r | r r r r | r r r r | r r r r | -.6.4 r r r",
    // bars that inherit a 16th from the bar before them: the bar after a copy must keep its lengths
    "3.6.16 r r r r r r r r r r r r r r r | 5.6 7.6 8.6 9.6 | 7.6.4 r r r",
    // legato at a bar's end, before a bar that starts with a rest or another string
    "3.6.4 r r 5.6{h} | r.4 7.6 r 5.5{sl} | 2.4.4 9.5 r r",
    // a chain of ties bound to nothing, across a rest and a bar line
    "-.6.4 -.6 r -.6 | -.6.4 r r r",
    "\\ro 3.6.4 r r r | 5.6.4 -.6 r r | \\rc 2 -.6.4 r r r | 7.6.4 r r r",
    "3.6.4 r r r | \\ts 3 4 5.6.4 r r | -.6.4 r r",
    // hammer-ons that bind across strings, to a left-hand tap, in a bar and onto the next bar's first beat
    "3.5{h}.4 7.6{lht}.4 r 9.5.4 | 5.5{h}.4 r r r | 3.6{lht}.4 r 7.5 r",
    "3.5{h}.4 r r 5.4{h} | r.4 7.6{lht} r r | 3.6.4 (7.5 5.4{lht}) r 9.4",
  ].map(tex);

  type Pos = [number, number];
  /**
   * What a duplicate that acted must have made of `text`: the `expected` beats,
   * bar by bar (the original's, with a copy of the repeated music after it, as
   * alphaTab reads them: lengths and pitches), the copy selected and the caret
   * on its first beat in the caret's string, and every binding either inside the
   * copy or what it was before — `moved` saying where each old beat went.
   */
  const verify = (
    text: string,
    out: EditOutcome,
    string: number,
    layout: {
      expected: ModelBeat[][];
      copy: { from: Pos; to: Pos };
      moved: (barIndex: number, beatIndex: number) => Pos;
    },
  ): void => {
    if (out.kind !== "ok") throw new Error(`expected ok, got ${JSON.stringify(out)} for ${JSON.stringify(text)}`);
    const { expected, copy, moved } = layout;
    expect(read(out.result.text)).toEqual(expected);
    expect(out.selection).toEqual({
      from: { barIndex: copy.from[0], beatIndex: copy.from[1] },
      to: { barIndex: copy.to[0], beatIndex: copy.to[1] },
    });
    expect(out.result.caret).toEqual({ barIndex: copy.from[0], beatIndex: copy.from[1], string });
    // What TabEditor draws: anchored on the copy's last beat, to the caret on its first.
    expect(rangeOf(out.selection!.to, out.result.caret)).toEqual(out.selection);
    const inCopy = ([b, i]: Pos) =>
      (b > copy.from[0] || (b === copy.from[0] && i >= copy.from[1])) && (b < copy.to[0] || (b === copy.to[0] && i <= copy.to[1]));
    const old = bindings(text);
    const was = new Map<string, string>();
    model(text).forEach((beats, b) => beats.forEach((_, i) => was.set(moved(b, i).join(":"), `${b}:${i}`)));
    for (const [key, to] of bindings(out.result.text)) {
      const [pos, bound, kind] = key.split("/");
      const here = pos.split(":").map(Number) as Pos;
      if (inCopy(here)) {
        expect(inCopy(to.split(":").map(Number) as Pos), `${key} -> ${to} reaches out of the copy`).toBe(true);
      } else {
        const before = old.get(`${was.get(pos)}/${bound}/${kind}`);
        expect(before && moved(...(before.split(":").map(Number) as Pos)).join(":"), `${key} -> ${to}`).toBe(to);
      }
    }
  };

  it("bars: the copy after the last of them sounds as they did, and every bar outside is as it was", () => {
    let acted = 0;
    for (const text of CORPUS) {
      const before = read(text);
      for (let a = 0; a < before.length; a++) {
        for (let b = a; b < Math.min(a + 2, before.length); b++) {
          const n = b - a + 1;
          const string = 1 + ((a + b) % 6);
          // a lone even bar is duplicated with nothing selected, every other run as a selection of whole bars
          const selected = a === b && a % 2 === 0 ? null : range([a, 0], [b, before[b].length - 1]);
          const out = duplicate(text, caret(b, 0, string), selected);
          verify(text, out, string, {
            expected: [...before.slice(0, b + 1), ...before.slice(a, b + 1), ...before.slice(b + 1)],
            copy: { from: [b + 1, 0], to: [b + n, before[b].length - 1] },
            moved: (barIndex, beatIndex) => [barIndex > b ? barIndex + n : barIndex, beatIndex],
          });
          acted++;
        }
      }
    }
    expect(acted).toBeGreaterThan(20);
  });

  it("beats: the copy after the last of them sounds as they did, and everything else is as it was", () => {
    let acted = 0;
    for (const text of CORPUS) {
      const before = read(text);
      before.forEach((beats, bar) => {
        for (let i = 0; i < beats.length; i++) {
          for (let j = i; j < beats.length; j++) {
            if (i === 0 && j === beats.length - 1) continue; // that is the whole bar
            const len = j - i + 1;
            const string = 1 + ((i + j) % 6);
            const out = duplicate(text, caret(bar, j, string), range([bar, i], [bar, j]));
            verify(text, out, string, {
              expected: before.map((b, x) => (x === bar ? [...b.slice(0, j + 1), ...b.slice(i, j + 1), ...b.slice(j + 1)] : b)),
              copy: { from: [bar, j + 1], to: [bar, j + len] },
              moved: (barIndex, beatIndex) => [barIndex, barIndex === bar && beatIndex > j ? beatIndex + len : beatIndex],
            });
            acted++;
          }
        }
      });
    }
    expect(acted).toBeGreaterThan(100);
  });

  it("refuses every run of beats across a bar line that is not whole bars, and changes nothing", () => {
    let refused = 0;
    for (const text of CORPUS) {
      const before = read(text);
      for (let bar = 0; bar + 1 < before.length; bar++) {
        for (let i = 0; i < before[bar].length; i++) {
          for (let j = 0; j < before[bar + 1].length; j++) {
            if (i === 0 && j === before[bar + 1].length - 1) continue; // whole bars
            expect(duplicate(text, caret(bar, i), range([bar, i], [bar + 1, j]))).toEqual({
              kind: "refused",
              barIndex: bar,
              why: "crossesBarLine",
            });
            refused++;
          }
        }
      }
    }
    expect(refused).toBeGreaterThan(50);
  });
});
