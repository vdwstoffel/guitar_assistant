import { describe, it, expect } from "vitest";
import { insertBeat, deleteBeat, addBar, deleteBar, extendScore } from "./structure";
import { parseTex } from "../parse";
import { countBars, countBeats, type Caret } from "../locate";
import { barState } from "../barFill";
import { setFret } from "./setFret";
import { scaleDuration } from "./duration";
import { moveBeat } from "./navigate";

const TEX = "\\tempo 120\n.\n3.6.8 5.6 7.6 | 7.6.4 r.4\n";
const at = (barIndex: number, beatIndex: number, string = 6) => ({ barIndex, beatIndex, string });
const shape = (t: string) => {
  const { scoreNode } = parseTex(t);
  return { bars: countBars(scoreNode), beats: countBeats(scoreNode) };
};

describe("insertBeat", () => {
  it("adds a rest after the caret and moves the caret onto it", () => {
    const r = insertBeat(TEX, at(0, 0))!;
    expect(shape(r.text)).toEqual({ bars: 2, beats: 6 });
    expect(r.caret).toEqual(at(0, 1));
  });
});

describe("deleteBeat", () => {
  it("removes the beat and keeps the caret in range", () => {
    const r = deleteBeat(TEX, at(0, 1))!;
    expect(shape(r.text)).toEqual({ bars: 2, beats: 4 });
  });

  it("CLAMPS the caret when the last beat in a bar is deleted", () => {
    const r = deleteBeat(TEX, at(1, 1))!;      // bar 1 had 2 beats; caret was on the last
    expect(shape(r.text)).toEqual({ bars: 2, beats: 4 });
    expect(r.caret).toEqual(at(1, 0));          // not left pointing at index 1
  });

  it("refuses to empty a bar completely", () => {
    const one = "\\tempo 120\n.\n3.6.8\n";
    expect(deleteBeat(one, at(0, 0))).toBeNull();
  });

  it("deletes a beat cleanly when separators are wider than one space", () => {
    const multi = "\\tempo 120\n.\n3.6.8   5.6   7.6 | 7.6.4 r.4\n";
    const r = deleteBeat(multi, at(0, 1))!;
    expect(r.text).toBe("\\tempo 120\n.\n3.6.8   7.6 | 7.6.4 r.4\n");
  });
});

describe("a bar line written straight after a bar's last beat", () => {
  const BUTTED = "\\tempo 120\n.\n3.6.8 5.6|7.6.4 r\n";

  it("stays where it is when a beat is inserted after that beat", () => {
    expect(insertBeat(BUTTED, at(0, 1))!.text).toBe("\\tempo 120\n.\n3.6.8 5.6 r|7.6.4 r\n");
  });

  it("stays where it is when that beat is deleted", () => {
    expect(deleteBeat(BUTTED, at(0, 1))!.text).toBe("\\tempo 120\n.\n3.6.8|7.6.4 r\n");
  });

  it("goes with the bar after it when that bar, the last, is deleted", () => {
    expect(deleteBar(BUTTED, at(1, 0))!.text).toBe("\\tempo 120\n.\n3.6.8 5.6\n");
  });
});

describe("addBar", () => {
  it("appends a bar of rests", () => {
    const r = addBar(TEX, at(1, 1))!;
    expect(shape(r.text).bars).toBe(3);
    expect(r.caret.barIndex).toBe(2);
  });
});

describe("deleteBar", () => {
  it("removes a bar and clamps the caret", () => {
    const r = deleteBar(TEX, at(1, 1))!;
    expect(shape(r.text).bars).toBe(1);
    expect(r.caret).toEqual(at(0, 2));
  });

  it("refuses to delete the only bar", () => {
    const one = "\\tempo 120\n.\n3.6.8\n";
    expect(deleteBar(one, at(0, 0))).toBeNull();
  });

  it("deletes a non-last bar without leaving whitespace artifacts", () => {
    const r = deleteBar(TEX, at(0, 0))!;
    expect(shape(r.text)).toEqual({ bars: 1, beats: 2 });
    expect(r.text).toBe("\\tempo 120\n.\n7.6.4 r.4\n");
    expect(r.caret).toEqual(at(0, 0));
  });

  it("deletes a middle bar without leaving a doubled separator", () => {
    const three = "\\tempo 120\n.\n3.6.8 5.6 7.6 | 7.6.4 r.4 | 9.6 8.6\n";
    const r = deleteBar(three, at(1, 0))!;
    expect(shape(r.text)).toEqual({ bars: 2, beats: 5 });
    // `9.6` inherited a quarter from the deleted `r.4`; it keeps it, rather
    // than becoming an 8th behind `7.6` (re-pinning).
    expect(r.text).toBe("\\tempo 120\n.\n3.6.8 5.6 7.6 | 9.6.4 8.6\n");
    expect(r.caret).toEqual(at(1, 0));
  });

  it("deletes the last bar cleanly when spacing around the pipe is irregular", () => {
    const wide = "\\tempo 120\n.\n3.6.8 5.6 7.6   |   7.6.4 r.4\n";
    const r = deleteBar(wide, at(1, 0))!;
    expect(r.text).toBe("\\tempo 120\n.\n3.6.8 5.6 7.6\n");
  });

  it("keeps the next bar's own directives on it: the repeat it closes stays closed", () => {
    // `\\rc 2` belongs to the bar after the one going; the deleted bar's `\\ro`
    // stays too, so the repeat now opens and closes on that bar
    const text = "\\tempo 120\n.\n3.6.4 5.6 | \\ro 7.6 8.6 | \\rc 2 9.6 5.6\n";
    const r = deleteBar(text, at(1, 0))!;
    expect(r.text).toBe("\\tempo 120\n.\n3.6.4 5.6 | \\ro \\rc 2 9.6 5.6\n");
    const bar = parseTex(r.text).score.masterBars[1];
    expect([bar.isRepeatStart, bar.repeatCount]).toEqual([true, 2]);
  });

  it("keeps the next bar's directives when the first bar goes", () => {
    const r = deleteBar("\\tempo 120\n.\n3.6.4 5.6 | \\section \"B\" 7.6 8.6\n", at(0, 0))!;
    expect(r.text).toBe("\\tempo 120\n.\n\\section \"B\" 7.6 8.6\n");
  });

  it("returns null rather than throwing when the adjacent bar has no beats", () => {
    const zero = "\\tempo 120\n.\n3.6.8 | | 5.6\n";
    expect(deleteBar(zero, at(0, 0))).toBeNull();
  });
});

// What → does past the last beat of the score: the decision TabEditor takes,
// asked of the function it calls. The new bar's own contents are addBar's
// business; these tests pin only which command runs, so each compares with
// the command it should have delegated to and with the shape that proves it.
describe("extendScore", () => {
  const doc = (body: string, head = "") => `\\tempo 120\n${head}.\n${body}\n`;

  it("starts a new bar when the bar holds exactly its time signature", () => {
    const text = doc("3.6.4 5.6 7.6 8.6");
    const r = extendScore(text, at(0, 3))!;
    expect(r).toEqual(addBar(text, at(0, 3)));
    expect(shape(r.text).bars).toBe(2);
    expect(r.caret).toEqual(at(1, 0));
  });

  it("starts a new bar after eight 8ths, the case a beat count would have got wrong", () => {
    const text = doc("0.6.8 0.6 5.6 0.6 3.6 5.6 0.6 3.6");
    const r = extendScore(text, at(0, 7))!;
    expect(r).toEqual(addBar(text, at(0, 7)));
    expect(shape(r.text).bars).toBe(2);
    expect(r.caret).toEqual(at(1, 0));
  });

  it("starts a new bar after seven septuplets, which a tick count calls two ticks short", () => {
    const seven = Array.from({ length: 7 }, () => "3.6.16{tu 7}").join(" ");
    const text = doc(`${seven} r.4 r.2`);
    const r = extendScore(text, at(0, 8))!;
    expect(r).toEqual(addBar(text, at(0, 8)));
    expect(shape(r.text).bars).toBe(2);
    expect(r.caret).toEqual(at(1, 0));
  });

  it("respects the time signature", () => {
    const three = doc("3.6.4 5.6 7.6", "\\ts 3 4\n");
    expect(extendScore(three, at(0, 2))).toEqual(addBar(three, at(0, 2)));
    expect(shape(extendScore(three, at(0, 2))!.text).bars).toBe(2);

    const two = doc("3.6.4 5.6", "\\ts 3 4\n");
    expect(extendScore(two, at(0, 1))).toEqual(insertBeat(two, at(0, 1)));
    expect(shape(extendScore(two, at(0, 1))!.text)).toEqual({ bars: 1, beats: 3 });
  });

  it("takes one more beat while the bar is short", () => {
    const text = doc("3.6.4 5.6");
    const r = extendScore(text, at(0, 1))!;
    expect(r).toEqual(insertBeat(text, at(0, 1)));
    expect(shape(r.text)).toEqual({ bars: 1, beats: 3 });
    expect(r.caret).toEqual(at(0, 2));
  });

  it("starts a new bar when the bar is long, rather than piling more on", () => {
    const text = doc("0.6.8 0.6 5.6 0.6 3.6 5.6 0.6 3.6 9.6 9.6");
    const r = extendScore(text, at(0, 9))!;
    expect(r).toEqual(addBar(text, at(0, 9)));
    expect(shape(r.text).bars).toBe(2);
    expect(r.caret).toEqual(at(1, 0));
  });

  it("starts a new bar after a pickup bar, however little it holds", () => {
    const text = doc("\\ac 3.6.4");
    const r = extendScore(text, at(0, 0))!;
    expect(r).toEqual(addBar(text, at(0, 0)));
    expect(shape(r.text).bars).toBe(2);
    expect(r.caret).toEqual(at(1, 0));
  });

  it("starts a new bar after a bar with no beats, which is exempt too", () => {
    // reachable by emptying the Source pane below the header
    const text = "\\tempo 120\n.\n";
    const r = extendScore(text, at(0, 0))!;
    expect(r).toEqual(addBar(text, at(0, 0)));
    expect(r.text).toBe("\\tempo 120\n. | r r r r\n");
    expect(r.caret).toEqual(at(1, 0));
  });

  it("asks about the caret's own bar", () => {
    const text = doc("3.6.4 | 3.6.4 5.6 7.6 8.6");
    // bar 0 is short: another beat after the caret, not a new bar
    expect(extendScore(text, at(0, 0))).toEqual(insertBeat(text, at(0, 0)));
    expect(shape(extendScore(text, at(0, 0))!.text)).toEqual({ bars: 2, beats: 6 });
    // bar 1 is exact: a new bar
    expect(extendScore(text, at(1, 3))).toEqual(addBar(text, at(1, 3)));
    expect(shape(extendScore(text, at(1, 3))!.text).bars).toBe(3);
  });

  it("returns null for a document that does not parse", () => {
    expect(extendScore("\\tempo 120\n.\n(((\n", at(0, 0))).toBeNull();
  });
});

describe("addBar fills the new bar", () => {
  const added = (head: string, body: string) => {
    const r = addBar(`\\tempo 120\n${head}.\n${body}\n`, at(0, 0))!;
    return { last: r.text.split("\n")[head ? 3 : 2].split(" | ").pop(), state: barState(parseTex(r.text).score, r.caret.barIndex) };
  };

  it("with eight 8ths after 8ths in 4/4", () => {
    expect(added("", "3.6.8 5.6 7.6 8.6 3.6 5.6 7.6 8.6")).toEqual({ last: "r r r r r r r r", state: { kind: "exact" } });
  });

  it("with sixteen 16ths after 16ths", () => {
    expect(added("", "3.6.16 r r r").last).toBe(Array.from({ length: 16 }, () => "r").join(" "));
  });

  it("with three quarters in 3/4", () => {
    expect(added("\\ts 3 4\n", "3.6.4 5.6 7.6")).toEqual({ last: "r r r", state: { kind: "exact" } });
  });

  it("with plain values from the beat unit when the value in force does not divide the bar", () => {
    // three quarters do not come out of halves
    expect(added("\\ts 3 4\n", "3.6.4 5.6.2")).toEqual({ last: "r.4 r r", state: { kind: "exact" } });
  });

  it("with the duration in force at the end of the score, carried over from an earlier bar", () => {
    // the last bar writes no duration of its own: its 8ths come from the bar before it
    expect(added("", "3.6.4 5.6 7.6 8.6 | 3.6.8 5.6 7.6 8.6 3.6 5.6 7.6 8.6 | 3.6 5.6 7.6 8.6 3.6 5.6 7.6 8.6")).toEqual({
      last: "r r r r r r r r",
      state: { kind: "exact" },
    });
  });

  it("with plain rests after a dotted last beat: a dot is not inherited, only the 8th is", () => {
    expect(added("", "3.6.2 5.6.4 7.6.16 8.6.8{d}")).toEqual({ last: "r r r r r r r r", state: { kind: "exact" } });
  });

  it("with plain rests after a triplet last beat: a tuplet is not inherited either", () => {
    expect(added("", "3.6.2 5.6.4 7.6.8{tu 3} 8.6{tu 3} 9.6{tu 3}")).toEqual({
      last: "r r r r r r r r",
      state: { kind: "exact" },
    });
  });

  it("with the time signature the last bar is in", () => {
    expect(added("", "3.6.4 5.6 7.6 8.6 | \\ts 3 4 3.6 5.6 7.6")).toEqual({ last: "r r r", state: { kind: "exact" } });
  });
});

describe("deleting re-pins what followed", () => {
  it("a suffixed beat: the next one keeps the value it inherited", () => {
    expect(deleteBeat(TEX, at(0, 0))!.text).toBe("\\tempo 120\n.\n5.6.8 7.6 | 7.6.4 r.4\n");
  });

  it("the last beat of a bar: the next bar's first beat keeps its value", () => {
    const r = deleteBeat("\\tempo 120\n.\n3.6.4 5.6 7.6 8.6.8 | r r\n", at(0, 3))!;
    expect(r.text).toBe("\\tempo 120\n.\n3.6.4 5.6 7.6 | r.8 r\n");
  });

  it("a bar: the first beat of the bar that followed keeps its value", () => {
    expect(deleteBar("\\tempo 120\n.\n3.6.8 5.6 | 7.6 r\n", at(0, 0))!.text).toBe("\\tempo 120\n.\n7.6.8 r\n");
  });

  it("a bar: the value is the one in force at the end of the bar that went, not at its start", () => {
    // `7.6` inherited a 16th from `5.6.16`, the second beat of the bar going
    expect(deleteBar("\\tempo 120\n.\n3.6.8 5.6.16 | 7.6 r\n", at(0, 0))!.text).toBe("\\tempo 120\n.\n7.6.16 r\n");
  });
});

describe("deleting refuses what it cannot re-pin", () => {
  // The beat that followed needs its inherited duration written onto it, and
  // the editor will not rewrite a dead note (`x.6`) or a quoted chord name.
  it("a beat: the next one is a dead note", () => {
    expect(deleteBeat("\\tempo 120\n.\n3.6.4 5.6.8 x.6\n", at(0, 1))).toBeNull();
  });

  it("a beat: the next one carries a quoted argument and a dot that would have to be lifted", () => {
    expect(deleteBeat('\\tempo 120\n.\n3.6.8 (5.6{d} 7.5){ch "Am"}\n', at(0, 0))).toBeNull();
  });

  it("but a quoted argument alone is pinned as it is written: no marker has to be lifted", () => {
    expect(deleteBeat('\\tempo 120\n.\n3.6.8 5.6{ch "Am"}\n', at(0, 0))!.text).toBe('\\tempo 120\n.\n5.6{ch "Am"}.8\n');
  });

  it("a bar: the first beat of the next one is a dead note", () => {
    expect(deleteBar("\\tempo 120\n.\n3.6.8 5.6 | x.6 r\n", at(0, 0))).toBeNull();
  });

  it("but not when that beat has a duration of its own, which needs no pinning", () => {
    expect(deleteBeat("\\tempo 120\n.\n3.6.4 5.6.8 x.6.4\n", at(0, 1))!.text).toBe("\\tempo 120\n.\n3.6.4 x.6.4\n");
    expect(deleteBar("\\tempo 120\n.\n3.6.8 5.6 | x.6.4 r\n", at(0, 0))!.text).toBe("\\tempo 120\n.\nx.6.4 r\n");
  });
});

describe("→ at the end of the score", () => {
  // What TabEditor does on →: step to the next beat, and when there is none
  // hand the decision to extendScore (a new bar, or another beat while the bar
  // is short). The decision is extendScore's own; it is asked here, not restated.
  const arrowRight = (text: string, caret: Caret) => {
    const moved = moveBeat(text, caret, 1);
    if (moved.barIndex !== caret.barIndex || moved.beatIndex !== caret.beatIndex) return { text, caret: moved };
    const grown = extendScore(text, caret);
    expect(grown).not.toBeNull();
    return grown!;
  };

  it("in 16ths fills the bar with sixteen of them, then starts a bar of sixteen 16th rests", () => {
    let text = "\\tempo 120\n.\nr r r r\n";
    let caret: Caret = at(0, 0);
    text = setFret(text, caret, 3)!.text;
    text = scaleDuration(text, caret, "halve")!.text;
    text = scaleDuration(text, caret, "halve")!.text;
    for (let typed = 1; typed < 16; typed++) {
      ({ text, caret } = arrowRight(text, caret));
      text = setFret(text, caret, 5)!.text;
    }
    ({ text, caret } = arrowRight(text, caret));

    const score = parseTex(text).score;
    const beats = score.tracks[0].staves[0].bars.map((bar: { voices: Array<{ beats: unknown[] }> }) => bar.voices[0].beats.length);
    expect(beats).toEqual([16, 16]);
    expect([barState(score, 0).kind, barState(score, 1).kind]).toEqual(["exact", "exact"]);
    expect(caret).toEqual(at(1, 0));
  });
});
