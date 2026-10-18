/* eslint-disable @typescript-eslint/no-explicit-any --
 * The property test reads alphaTab's model, whose types are only reachable
 * through namespaces that cannot be imported as types.
 */
import { describe, it, expect } from "vitest";
import { copyRange, pinFirstBeat, readClip, type CopyOutcome } from "./clip";
import { parseTex } from "./parse";

const tex = (body: string) => `\\tempo 120\n.\n${body}\n`;
const at = (barIndex: number, beatIndex: number) => ({ barIndex, beatIndex });
const range = (from: [number, number], to: [number, number]) => ({ from: at(...from), to: at(...to) });
const copied = (outcome: CopyOutcome) => {
  if (outcome.kind !== "copied") throw new Error(`expected a clip, got ${JSON.stringify(outcome)}`);
  return outcome.clip;
};
const copy = (body: string, from: [number, number], to: [number, number]) => copied(copyRange(tex(body), range(from, to)));

describe("copyRange", () => {
  it("writes the first beat's duration out, and later beats as they are", () => {
    expect(copy("3.6.8 5.6 7.6.16 8.6", [0, 1], [0, 3]).text).toBe("5.6.8 7.6.16 8.6");
  });

  it("lifts a dot that sat on the first beat's note onto the beat as it pins it", () => {
    expect(copy("3.6.8 5.6{d} 7.6.16 r", [0, 1], [0, 2]).text).toBe("5.6.8{d} 7.6.16");
  });

  it("joins bars with ` | `, and ends whole bars with ` |`", () => {
    const clip = copy("3.6.4 5.6 7.6 8.6 | 3.6.8 r r r r r r r | 5.6.2 r", [0, 0], [1, 7]);
    expect(clip.text).toBe("3.6.4 5.6 7.6 8.6 | 3.6.8 r r r r r r r |");
    expect(clip).toMatchObject({ wholeBars: true, bars: 2, beats: 12 });
  });

  it("never ends beats with `|`, even across a bar line", () => {
    const clip = copy("3.6.4 5.6 7.6 8.6 | 3.6.8 r r r r r r r", [0, 2], [1, 1]);
    expect(clip.text).toBe("7.6.4 8.6 | 3.6.8 r");
    expect(clip).toMatchObject({ wholeBars: false, bars: 2, beats: 4 });
  });

  it("leaves the bars' directives behind", () => {
    const text = '\\title "Riff"\n\\tempo 90\n.\n\\ro 3.6.4 5.6 7.6 8.6 | \\ts 3 4 \\section A 5.6.4 r r \\rc 2 |';
    const clip = copied(copyRange(text, range([0, 0], [1, 2])));
    expect(clip.text).toBe("3.6.4 5.6 7.6 8.6 | 5.6.4 r r |");
  });

  it("makes a leading tie the fret it sounds, and keeps a tie whose origin is in the clip", () => {
    expect(copy("7.6.4 -.6 -.6 r", [0, 1], [0, 2]).text).toBe("7.6.4 -.6");
    expect(copy("(7.6 5.5).4 (-.6 -.5) r r", [0, 1], [0, 2]).text).toBe("(7.6 5.5).4 r");
    expect(copy("7.6.4 r | -.6 r", [1, 0], [1, 0]).text).toBe("7.6.4");
  });

  it("writes an orphan tie as the open string alphaTab plays", () => {
    expect(copy("r.4 -.6 r r", [0, 1], [0, 1]).text).toBe("0.6.4");
  });

  it("resolves a leading tie as far back as alphaTab binds one: three bars, not four", () => {
    expect(copy("3.6.4 r r r | r r r r | r r r r | -.6.4 r r r", [3, 0], [3, 3]).text).toBe("3.6.4 r r r |");
    expect(copy("3.6.4 r r r | r r r r | r r r r | r r r r | -.6.4 r r r", [4, 0], [4, 3]).text).toBe("0.6.4 r r r |");
  });

  it("measures that reach from the tie's own bar, not from the first bar of the clip", () => {
    // the tie is three bars from the clip's first bar, but four from the 3
    const body = "3.6.4 r r r | r r r r | r r r r | r r r r | -.6.4 r r r";
    expect(copy(body, [1, 0], [4, 3]).text).toBe("r.4 r r r | r r r r | r r r r | 0.6.4 r r r |");
  });

  it("follows a chain of ties back to the note, each tie looking three bars back from its own bar", () => {
    const chain = "3.6.4 r r r | r r r r | r r r r | -.6.4 r r r | r r r r | r r r r | -.6.4 r r r";
    expect(copy(chain, [6, 0], [6, 3]).text).toBe("3.6.4 r r r |");
  });

  it("drops the hammer-on or slide on each string's last note, and keeps one that binds inside the clip", () => {
    expect(copy("5.6{h}.4 7.6{sl} 9.6 r", [0, 0], [0, 1]).text).toBe("5.6{h}.4 7.6");
    expect(copy("5.6{pm h}.4 r 5.5{ss} r", [0, 0], [0, 2]).text).toBe("5.6{pm}.4 r 5.5");
  });

  it("is refused, naming the bar, when a bar of the range is one the commands cannot read", () => {
    expect(copyRange(tex("3.6.4 5.6 r r | x.6.4 r r r"), range([0, 2], [1, 1]))).toEqual({ kind: "refused", barIndex: 1 });
    expect(copyRange(tex("((("), range([0, 0], [0, 0]))).toEqual({ kind: "refused", barIndex: 0 });
  });

  it("is refused, naming the bar, for a bar the commands would misread though each beat parses", () => {
    expect(copyRange(tex('3.6.4 5.6 r r | 3.6.4{ch "Am"} r r r'), range([0, 2], [1, 1]))).toEqual({ kind: "refused", barIndex: 1 });
    expect(copyRange(tex("3.6.4 5.6 r r | 5.6.4 3.6{t}.4 r r"), range([0, 2], [1, 1]))).toEqual({ kind: "refused", barIndex: 1 });
  });

  it("is refused, naming the bar, when a bar of the range has no beats", () => {
    expect(copyRange(tex("3.6.4 5.6 r r | | 5.6.4 r r r"), range([0, 0], [2, 3]))).toEqual({ kind: "refused", barIndex: 1 });
  });

  it("is refused when the range names a beat that is not there", () => {
    expect(copyRange(tex("3.6.4 5.6 r r"), range([0, 1], [0, 9]))).toEqual({ kind: "refused", barIndex: 0 });
  });

  it("is refused rather than change a length the beats' own text does not say", () => {
    // a sticky `:8{tu 3}` makes bar 2's bare beats triplets too; a clip of their text would be plain 8ths
    const text = "\\tempo 120\n.\n:8{tu 3} 3.6 5.6 7.6 | 3.6 5.6 7.6";
    expect(copyRange(text, range([1, 0], [1, 2]))).toEqual({ kind: "refused", barIndex: 1 });
  });
});

// What a tie sounds is what its origin sounds. When the walk back to the origin
// meets a beat the commands cannot read — it might hold the note — or a note
// marked as a tie, the clip cannot say which fret the tie sounds. Writing an
// older fret, or the open string, would paste a different note, so the copy is
// refused: the tie's bar is named.
describe("copyRange, when a leading tie's origin cannot be named", () => {
  const attempt = (body: string, from: [number, number], to: [number, number]) => copyRange(tex(body), range(from, to));

  it("is refused when an unreadable beat lies between the tie and its origin", () => {
    // the tie binds to the dead note and sounds 40; walking past it to the 5 would paste pitch 45
    expect(attempt("5.6.4 r r r | x.6.4 r r r | -.6.4 r r r", [2, 0], [2, 3])).toEqual({ kind: "refused", barIndex: 2 });
  });

  it("is refused for an unreadable beat on another string too: it might hold the string", () => {
    expect(attempt("5.6.4 r r r | x.1.4 r r r | -.6.4 r r r", [2, 0], [2, 3])).toEqual({ kind: "refused", barIndex: 2 });
  });

  it("is refused when the way back passes a note marked as a tie", () => {
    expect(attempt("5.6.4 r r r | 3.6{t}.4 r r r | -.6.4 r r r", [2, 0], [2, 3])).toEqual({ kind: "refused", barIndex: 2 });
    expect(attempt("5.6.4 r r r | 3.6{-}.4 r r r | -.6.4 r r r", [2, 0], [2, 3])).toEqual({ kind: "refused", barIndex: 2 });
  });

  it("names the bar that holds the tie, not the first bar of the range", () => {
    const body = "5.6.4 r r r | x.6.4 r r r | 3.5.4 r r r | -.6.4 r r r";
    expect(attempt(body, [2, 0], [3, 3])).toEqual({ kind: "refused", barIndex: 3 });
  });

  it("is refused when any one string of a chord is blocked", () => {
    // string 6 is settled by the 5 in the clip's first beat; the tie on string 5 has to look behind it
    const body = "(7.5 2.4).4 r r r | x.1.4 r r r | (5.6 -.5).4 r r r";
    expect(attempt(body, [2, 0], [2, 3])).toEqual({ kind: "refused", barIndex: 2 });
  });

  it("is not stopped by an unreadable beat beyond alphaTab's reach", () => {
    // four bars back: the tie binds to nothing there, and sounds the open string
    const body = "x.6.4 r r r | r r r r | r r r r | r r r r | -.6.4 r r r";
    expect(copy(body, [4, 0], [4, 3]).text).toBe("0.6.4 r r r |");
  });

  it("is not stopped by an unreadable beat when no tie leaves the clip", () => {
    expect(copy("3.6.4 r r r | x.1.4 r r r | 5.6.4 -.6 r r", [2, 0], [2, 3]).text).toBe("5.6.4 -.6 r r |");
  });
});

describe("pinFirstBeat", () => {
  it("writes the base out even when the beat would inherit it anyway", () => {
    expect(pinFirstBeat("5.6", 4)).toBe("5.6.4");
    expect(pinFirstBeat("(5.6 7.5){d}", 8)).toBe("(5.6 7.5).8{d}");
  });

  it("leaves a beat that has its own suffix", () => {
    expect(pinFirstBeat("5.6.16", 4)).toBe("5.6.16");
  });

  it("is null for a beat it cannot read", () => {
    expect(pinFirstBeat("x.6", 4)).toBeNull();
  });
});

describe("readClip", () => {
  it("reads an editor clip back as it was written", () => {
    const clip = readClip("7.6.4 8.6 | 3.6.8 r");
    expect(clip).toMatchObject({ text: "7.6.4 8.6 | 3.6.8 r", wholeBars: false, bars: 2, beats: 4 });
    expect(clip!.beatsByBar).toEqual([["7.6.4", "8.6"], ["3.6.8", "r"]]);
    expect(clip!.lastBase).toBe(8);
  });

  it("knows whole bars by the trailing `|`, whatever is around it", () => {
    expect(readClip("  3.6.4 5.6 7.6 8.6 |\n")).toMatchObject({ wholeBars: true, bars: 1, text: "3.6.4 5.6 7.6 8.6 |" });
  });

  it("pins a bare Source-pane fragment with the quarter a standalone parse gives it", () => {
    const clip = readClip("5.6 7.6");
    expect(clip!.text).toBe("5.6.4 7.6");
    expect(clip!.lengthsByBar).toEqual([[{ n: 1, d: 4 }, { n: 1, d: 4 }]]);
  });

  it("normalises a fragment like a copy: a leading tie sounds the open string, trailing legato goes", () => {
    expect(readClip("-.6.8 5.6{h}")!.text).toBe("0.6.8 5.6");
  });

  it("drops trailing legato however its property is spelled: alphaTab ignores an empty argument list", () => {
    expect(readClip("5.6.8 7.5{h()} 9.6{sl ()} 3.4{ss()}")!.text).toBe("5.6.8 7.5 9.6 3.4");
  });

  it("counts the strings its notes are on, and the base after its last beat", () => {
    const clip = readClip("(3.6 5.5).8 r 7.1.16");
    expect(clip!.strings.sort()).toEqual([1, 5, 6]);
    expect(clip!.lastBase).toBe(16);
  });

  // parseTex reads CRLF as one line end, but the clip is sliced from the text as
  // given: left alone, each CRLF would shift the offsets by one and put a
  // stray newline into the first beat after it.
  it("reads a Windows clipboard's CRLF line ends, and a lone CR, as it reads LF", () => {
    const lf = "3.6.4 5.6\n7.6 8.6 |\n3.6.8 r r r r r r r |\n5.6.2 r |\n";
    const clip = readClip(lf);
    expect(clip).toMatchObject({
      text: "3.6.4 5.6 7.6 8.6 | 3.6.8 r r r r r r r | 5.6.2 r |",
      wholeBars: true,
      bars: 3,
      beats: 14,
    });
    expect(clip!.beatsByBar[0]).toEqual(["3.6.4", "5.6", "7.6", "8.6"]);
    expect(readClip(lf.replace(/\n/g, "\r\n"))).toEqual(clip);
    expect(readClip(lf.replace(/\n/g, "\r"))).toEqual(clip);
  });

  it.each([
    ["nothing", ""],
    ["blank space", "  \n "],
    ["prose", "hello world"],
    ["a number", "3"],
    ["a directive", "\\ts 3 4 3.6.4"],
    ["a header", "\\tempo 120\n.\n3.6.4"],
    ["a second voice", "3.6.4 \\voice 5.6.4"],
    ["a beat the commands cannot read", "x.6.4 5.6"],
    ["a quoted argument", '3.6.4{ch "Am"}'],
    ["a two-number tuplet", "3.6.8{tu 3 2} 5.6 7.6"],
    ["a repeated beat", "3.6.4*4"],
    ["a leading `|`", "| 3.6.4"],
    ["an empty bar", "3.6.4 | | 5.6"],
    ["a lone `|`", "|"],
  ])("refuses %s", (_label, raw) => {
    expect(readClip(raw)).toBeNull();
  });
});

describe("a clip keeps every beat's length and pitch (the invariants corpus)", () => {
  const CORPUS = [
    "3.6.4 5.6 7.6 8.6 | 3.6.8 r r r r r r r",
    "3.6.8 5.6 7.6 8.6 3.6 5.6 7.6 8.6 | 3.6 5.6 7.6 8.6 3.6 5.6 7.6 8.6",
    "3.6.4 r r r | 5.6.4 5.6 r r | r.2 7.6.8 r r r",
    "3.6.8{tu 3} 5.6.8{tu 3} 7.6.8{tu 3} r.4 r.2 | 3.6.4{d} 5.6.8 r.2",
    "5.6.4 -.6 r r | -.6.8 7.6{h} 9.6 r r.4 r.4",
    "3.6.16 5.6 7.6 8.6 r.4 r.2 | 3.6.2 5.6.2 7.6.4 | (0.6 2.5).8 r r r",
    "(5.6 7.5).4 (-.6 9.5{h}) 10.5 -.5 | -.5.8 5.6{sl} 7.6 r r.2",
    // ties three and four bars from the note they hold: one binds, the other sounds the open string
    "3.6.2 r | r r | r r | -.6.2 r | r r | r r | r r | -.6.2 r",
  ].map(tex);

  type Beat = { length: string; pitch: string };
  const read = (text: string): Beat[] =>
    parseTex(text).score.tracks[0].staves[0].bars.flatMap((bar: any) =>
      bar.voices[0].beats.map((b: any) => ({
        length: `${b.duration}/${b.dots}/${b.tupletNumerator}/${b.graceType}`,
        pitch: b.notes.map((n: any) => n.realValue).sort().join(","),
      })),
    );

  it("for every range of every corpus tab", () => {
    let checked = 0;
    for (const text of CORPUS) {
      const source = read(text);
      const bars: number[] = parseTex(text).scoreNode.bars.map((bar: any) => bar.beats.length);
      const flat = bars.flatMap((count, barIndex) => Array.from({ length: count }, (_, beatIndex) => at(barIndex, beatIndex)));
      flat.forEach((from, i) =>
        flat.slice(i).forEach((to, j) => {
          const clip = copied(copyRange(text, { from, to }));
          expect(read(clip.text), `${clip.text}`).toEqual(source.slice(i, i + j + 1));
          expect(read(`r.16 ${clip.text}`).slice(1), `${clip.text} after another base`).toEqual(source.slice(i, i + j + 1));
          expect(readClip(clip.text)!.text, "reading a clip back changes nothing").toBe(clip.text);
          checked++;
        }),
      );
    }
    expect(checked).toBeGreaterThan(500);
  });
});
