import { describe, it, expect } from "vitest";
import { formatRests, isEditableBar, isMarkedTie, nextBeatPos, prevBeatPos, readBar, spliceBeats } from "./barEdit";
import { applySplices, beatSplices, hasBarDirectives, headerDot, insertBars, removeBars, replaceBars } from "./barEdit";
import { deleteBar } from "./structure";
import { plain } from "../durationValues";
import { sliceCp } from "../offsets";
import { parseTex } from "../parse";

const tex = (body: string) => `\\tempo 120\n.\n${body}\n`;
const node = (text: string) => parseTex(text).scoreNode;
const bodyOf = (text: string | null) => text?.split("\n")[2];

describe("readBar", () => {
  it("reads each beat's source and what parseBeatText makes of it", () => {
    const text = tex("3.6.8 x.6 (5.5 7.4).4 | r");
    const beats = readBar(text, node(text), 0)!;
    expect(beats.map((b) => b.source)).toEqual(["3.6.8", "x.6", "(5.5 7.4).4"]);
    expect(beats.map((b) => b.beat !== null)).toEqual([true, false, true]);
    expect(beats[2].pos).toEqual({ barIndex: 0, beatIndex: 2 });
  });

  it("is null for a bar that is not there", () => {
    expect(readBar(tex("r"), node(tex("r")), 3)).toBeNull();
  });
});

describe("isEditableBar", () => {
  const editable = (text: string, barIndex = 0) => isEditableBar(text, parseTex(text), barIndex);

  it("takes a bar the editor writes", () => {
    expect(editable(tex("3.6.8 5.6{h} (7.5 9.4) r.4{tu 3} -.6"))).toBe(true);
  });

  // The readback test must not turn away what the editor itself writes, or a
  // bar that has been edited once could never be edited again.
  it.each([
    ["a hammer-on", "3.6{h}.4 5.6 r r"],
    ["a slide beside a palm mute", "3.6{pm sl}.4 5.6 r r"],
    ["a dead note", "3.6{x}.4 5.6 r r"],
    ["a hand tap", "3.6{lht}.4 5.6 r r"],
    ["each bend the editor writes", "3.6{b (0 4)}.4 5.6{b (0 4 0)} 7.6{b (4 4) h} 8.6{b (0 2)}"],
    ["a harmonic with its fret", "3.6{ah 12}.4 5.6 r r"],
    ["a chord of effect notes", "(3.6{h} 5.5{pm}).4 r r r"],
    ["a dot, a double dot and a tuplet", "3.6.8{d} 5.6.16{dd} 7.6.8{tu 3} r.4"],
    ["a grace note with its type", "3.6.16{gr ob} 5.6.4 7.6 8.6 9.6"],
    ["extra spaces inside the braces", "3.6{  pm   h }.4 5.6 r r"],
    ["a last beat butted against the bar line, `5.6|`", "3.6.8 5.6| r"],
  ])("takes %s", (_label, body) => {
    expect(editable(tex(body))).toBe(true);
  });

  it.each([
    ["a `:8` before a beat", ":8 3.6 5.6"],
    ["a repeat `*4`", "3.6.8*4 r.2"],
    ["a dead note written `x.6`", "x.6.4 5.6 r r"],
    ["a two-number tuplet `{tu 3 2}`", "3.6.8{tu 3 2} 5.6.8{tu 3 2} 7.6.8{tu 3 2} r.4 r.2"],
    ["a `{t}` tie", "3.6.4 3.6{t}.4 r r"],
    ["a `{-}` tie", "3.6.4 3.6{-}.4 r r"],
    ["a quoted argument, which tokensOf would split", '3.6.4{ch "Am"} 5.6 r r'],
    ["a single-quoted argument", "3.6.4{ch 'Am'} 5.6 r r"],
    ["a quoted argument in parentheses, which tokensOf reads whole", '3.6.4{ch ("Am")} 5.6 r r'],
    ["a single-quoted argument in parentheses", "3.6.4{ch ('Am')} 5.6 r r"],
    ["an unquoted word argument", "3.6.4{ch Am} 5.6 r r"],
    ["an upper-case property", "3.6.4{TU 3 2} 5.6 r r"],
    ["an upper-case `{T}` tie", "3.6.4 3.6{T}.4 r r"],
  ])("refuses %s", (_label, body) => {
    expect(editable(tex(body))).toBe(false);
  });

  it("refuses a bar with a second voice, and a second track", () => {
    expect(editable("\\tempo 120\n.\n\\voice\n3.6.4 5.6 7.6 8.6\n\\voice\n0.1.2 0.1.2\n")).toBe(false);
    expect(editable('\\tempo 120\n.\n\\track "A"\n3.6.4 5.6 7.6 8.6\n\\track "B"\n0.1.1\n')).toBe(false);
  });

  it("refuses a document that does not parse", () => {
    expect(editable(tex("((("))).toBe(false);
  });
});

describe("isMarkedTie", () => {
  it.each(["{t}", "{ t }", "{-}", "{- h}", "{h -}", "{pm t}", "{T}", "{ Pm T }"])("is true for %s", (effects) => {
    expect(isMarkedTie(effects)).toBe(true);
  });

  // alphaTab reads each of these as a tie (probed on 1.8.1): an empty argument
  // list, and a tie written straight after another property's arguments.
  it.each(["{t()}", "{-()}", "{b (0 4)-}", "{b (0 4) t}", "{T ()}"])("is true for %s, an argument list beside it", (effects) => {
    expect(isMarkedTie(effects)).toBe(true);
  });

  it.each(["", "{h}", "{pm sl}", "{tu 3}", "{lht}", "{b (0 4)}", "{b (0 -4)}", "{ah 12}", '{ch "Am"}'])(
    "is false for %j",
    (effects) => {
      expect(isMarkedTie(effects)).toBe(false);
    },
  );

  // A `t` or a `-` inside quotes is a chord name or a text, not a tie.
  it.each(['{ch "t"}', "{ch 'T'}", '{txt "a - b"}', '{ch ("t")}'])("is false for %j, a quoted argument", (effects) => {
    expect(isMarkedTie(effects)).toBe(false);
  });
});

describe("spliceBeats", () => {
  const splice = (body: string, ...splices: Parameters<typeof spliceBeats>[2]) => {
    const text = tex(body);
    return bodyOf(spliceBeats(text, node(text), splices));
  };

  it("replaces a run of beats with new ones", () => {
    expect(splice("3.6.8 r r r r", { barIndex: 0, first: 1, last: 3, beats: ["r.4"] })).toBe("3.6.8 r.4 r");
  });

  it("deletes beats with one separator, inside a bar or at its end", () => {
    expect(splice("3.6.8   5.6 7.6 | r", { barIndex: 0, first: 1, last: 1, beats: [] })).toBe("3.6.8   7.6 | r");
    expect(splice("3.6.8   5.6 7.6 | r", { barIndex: 0, first: 1, last: 2, beats: [] })).toBe("3.6.8 | r");
  });

  it("keeps a bar line written straight after the last beat", () => {
    expect(splice("3.6.8 5.6|7.6.4 r", { barIndex: 0, first: 1, last: 1, beats: ["r", "r.4"] })).toBe("3.6.8 r r.4|7.6.4 r");
    expect(splice("3.6.8 5.6|7.6.4 r", { barIndex: 0, first: 1, last: 1, beats: [] })).toBe("3.6.8|7.6.4 r");
  });

  it("deletes the first beat of a bar with its separator", () => {
    expect(splice("3.6.8 5.6 7.6", { barIndex: 0, first: 0, last: 0, beats: [] })).toBe("5.6 7.6");
  });

  it("applies two splices in one bar from one parse", () => {
    expect(
      splice(
        "3.6.8 5.6 7.6 8.6",
        { barIndex: 0, first: 0, last: 0, beats: ["r"] },
        { barIndex: 0, first: 2, last: 2, beats: ["r"] },
      ),
    ).toBe("r 5.6 r 8.6");
  });

  it("applies splices in several bars from one parse", () => {
    expect(
      splice(
        "3.6.8 5.6 | -.6 r",
        { barIndex: 0, first: 1, last: 1, beats: ["r"] },
        { barIndex: 1, first: 0, last: 0, beats: ["5.6"] },
      ),
    ).toBe("3.6.8 r | 5.6 r");
  });

  it("refuses to empty a bar, to overlap, or to touch a beat that is not there", () => {
    expect(splice("3.6.8 5.6 | r", { barIndex: 1, first: 0, last: 0, beats: [] })).toBeUndefined();
    expect(
      splice(
        "3.6.8 5.6 7.6",
        { barIndex: 0, first: 0, last: 1, beats: ["r"] },
        { barIndex: 0, first: 1, last: 2, beats: ["r"] },
      ),
    ).toBeUndefined();
    expect(splice("3.6.8 5.6", { barIndex: 0, first: 1, last: 4, beats: ["r"] })).toBeUndefined();
  });
});

describe("formatRests", () => {
  it("writes a rest of the duration in force bare", () => {
    expect(formatRests([plain(8), plain(8)], 8)).toEqual(["r", "r"]);
  });

  it("writes a new duration once, and the rests after it inherit it", () => {
    expect(formatRests([plain(4), plain(4), plain(8)], 8)).toEqual(["r.4", "r", "r.8"]);
  });

  it("always gives a dotted or tuplet rest its duration", () => {
    expect(formatRests([{ duration: 8, dots: 1, tuplet: null }, { duration: 8, dots: 0, tuplet: 3 }], 8)).toEqual([
      "r.8{d}",
      "r.8{tu 3}",
    ]);
  });
});

describe("nextBeatPos and prevBeatPos", () => {
  const n = node(tex("3.6.8 5.6 | | 7.6"));

  it("step across bar lines, past empty bars", () => {
    expect(nextBeatPos(n, { barIndex: 0, beatIndex: 1 })).toEqual({ barIndex: 2, beatIndex: 0 });
    expect(prevBeatPos(n, { barIndex: 2, beatIndex: 0 })).toEqual({ barIndex: 0, beatIndex: 1 });
    expect(nextBeatPos(n, { barIndex: 0, beatIndex: 0 })).toEqual({ barIndex: 0, beatIndex: 1 });
  });

  it("are null at the ends", () => {
    expect(nextBeatPos(n, { barIndex: 2, beatIndex: 0 })).toBeNull();
    expect(prevBeatPos(n, { barIndex: 0, beatIndex: 0 })).toBeNull();
  });
});

describe("applySplices", () => {
  it("applies replacements and insertions worked out against one text", () => {
    expect(applySplices("abcdef", [{ from: 4, to: 4, text: "E" }, { from: 1, to: 2, text: "" }])).toBe("adEf");
  });

  it("puts an insertion at a replaced range's start in front of the replacement", () => {
    expect(applySplices("abcdef", [{ from: 2, to: 3, text: "CD" }, { from: 2, to: 1, text: "+" }])).toBe("ab+CDef");
  });

  it("counts in codepoints, as the AST does", () => {
    expect(applySplices("\u{1F3B8} 3.6", [{ from: 2, to: 4, text: "5.5" }])).toBe("\u{1F3B8} 5.5");
  });

  it("refuses splices that overlap", () => {
    expect(applySplices("abcdef", [{ from: 1, to: 3, text: "" }, { from: 3, to: 4, text: "" }])).toBeNull();
  });

  it("refuses a splice that ends more than one before it starts: it is neither a range nor an insertion", () => {
    expect(applySplices("abcdef", [{ from: 3, to: 1, text: "X" }])).toBeNull();
    expect(applySplices("abcdef", [{ from: 4, to: 4, text: "E" }, { from: 2, to: 0, text: "+" }])).toBeNull();
    // one before is an insertion, and stays one
    expect(applySplices("abcdef", [{ from: 3, to: 2, text: "+" }])).toBe("abc+def");
  });

  it("takes ranges that only touch, and an insertion just after a replaced range", () => {
    expect(applySplices("abcdef", [{ from: 3, to: 4, text: "Y" }, { from: 1, to: 2, text: "X" }])).toBe("aXYf");
    expect(applySplices("abcdef", [{ from: 3, to: 2, text: "+" }, { from: 1, to: 2, text: "X" }])).toBe("aX+def");
  });

  it("refuses an insertion inside a replaced range", () => {
    expect(applySplices("abcdef", [{ from: 1, to: 3, text: "X" }, { from: 2, to: 1, text: "+" }])).toBeNull();
  });

  it("keeps insertions at one place in the order given, and leaves the text alone with no splices", () => {
    expect(applySplices("abc", [{ from: 1, to: 0, text: "1" }, { from: 1, to: 0, text: "2" }])).toBe("a12bc");
    expect(applySplices("abc", [])).toBe("abc");
  });
});

describe("beatSplices", () => {
  it("works out text splices from beat splices, without applying them", () => {
    const text = tex("3.6.8 5.6 7.6 | r");
    const splices = beatSplices(text, node(text), [
      { barIndex: 0, first: 1, last: 1, beats: ["r", "r.4"] },
      { barIndex: 0, first: 2, last: 2, beats: [] },
    ])!;
    expect(splices.map((s) => [sliceCp(text, s.from, s.to), s.text])).toEqual([
      ["5.6", "r r.4"],
      [" 7.6", ""],
    ]);
  });

  it("leaves a comment written straight after a beat it replaces or deletes", () => {
    const text = tex("3.6.4 r r r// end");
    expect(bodyOf(spliceBeats(text, node(text), [{ barIndex: 0, first: 3, last: 3, beats: ["r.8 r"] }]))).toBe(
      "3.6.4 r r r.8 r// end",
    );
    expect(bodyOf(spliceBeats(text, node(text), [{ barIndex: 0, first: 3, last: 3, beats: [] }]))).toBe("3.6.4 r r// end");
    const inside = tex("3.6.4 r/* c */ r r");
    expect(bodyOf(spliceBeats(inside, node(inside), [{ barIndex: 0, first: 1, last: 1, beats: ["5.6"] }]))).toBe(
      "3.6.4 5.6/* c */ r r",
    );
  });

  it("is null for a beat that is not there, and for a bar it would empty", () => {
    const text = tex("3.6.8 5.6 | r");
    expect(beatSplices(text, node(text), [{ barIndex: 0, first: 1, last: 4, beats: ["r"] }])).toBeNull();
    expect(beatSplices(text, node(text), [{ barIndex: 1, first: 0, last: 0, beats: [] }])).toBeNull();
  });

  it("leaves an overlap to applySplices, which refuses it", () => {
    const text = tex("3.6.8 5.6 7.6");
    const overlapping = beatSplices(text, node(text), [
      { barIndex: 0, first: 0, last: 1, beats: ["r"] },
      { barIndex: 0, first: 1, last: 2, beats: ["r"] },
    ])!;
    expect(overlapping).toHaveLength(2);
    expect(applySplices(text, overlapping)).toBeNull();
  });

  it("goes in one pass with a bar-level splice worked out on the same text", () => {
    // Both start where bar 1 does: the new bar goes in front, and the edit
    // worked out on the unedited text still lands on the old bar's first beat.
    const text = tex("3.6.4 r r r | 5.6.4 r r r");
    const edge = beatSplices(text, node(text), [{ barIndex: 1, first: 0, last: 0, beats: ["r"] }])!;
    const bar = insertBars(text, node(text), 1, ["9.1.4 r r r"])!;
    expect(bodyOf(applySplices(text, [...edge, bar]))).toBe("3.6.4 r r r | 9.1.4 r r r | r r r r");
    expect(bodyOf(applySplices(text, [bar, ...edge]))).toBe("3.6.4 r r r | 9.1.4 r r r | r r r r");
  });
});

describe("headerDot", () => {
  it("finds the structural `.`, past directives and comments that hold dots of their own", () => {
    const text = '// v1.0\n\\title "A.B"\n\\tempo 90\n/* x.y */\n.\n3.6.4 r r r\n';
    expect(text.split("")[headerDot(text, node(text))!]).toBe(".");
    expect(headerDot(text, node(text))).toBe(text.indexOf("\n.\n") + 1);
  });

  it("is null when there is none", () => {
    expect(headerDot("3.6.4 r | r", node("3.6.4 r | r"))).toBeNull();
  });

  it("counts codepoints, past an emoji in the title", () => {
    const text = '\\title "Riff \u{1F3B8}"\n\\tempo 90\n.\n3.6.4 r r r\n';
    expect(headerDot(text, node(text))).toBe(Array.from(text.slice(0, text.indexOf("\n.\n") + 1)).length);
  });
});

describe("hasBarDirectives", () => {
  const text = '\\title "Riff"\n\\tempo 90\n.\n\\ro 3.6.4 r r r | 5.6.4 r r r | \\section A 7.6.4 r r r\n';
  it("counts what is written in a bar, not the header", () => {
    expect([0, 1, 2].map((i) => hasBarDirectives(text, node(text), i))).toEqual([true, false, true]);
    expect(hasBarDirectives(tex("3.6.4 r r r"), node(tex("3.6.4 r r r")), 0)).toBe(false);
  });

  it("counts everything before the first beat as the first bar's own when there is no `.`", () => {
    const bare = '\\title "Riff"\n3.6.4 r r r | 5.6.4 r r r\n';
    expect([0, 1].map((i) => hasBarDirectives(bare, node(bare), i))).toEqual([true, false]);
  });
});

describe("insertBars", () => {
  const insert = (text: string, beforeBar: number, bars: string[]) =>
    applySplices(text, [insertBars(text, node(text), beforeBar, bars)!]);

  it("goes in front of a later bar's directives, which stay on it", () => {
    const text = tex("3.6.4 r r r | \\ro \\ts 3 4 \\section A 5.6.4 r r | \\rc 2 7.6.4 r r");
    const out = insert(text, 1, ["9.1.4 r r r"])!;
    expect(bodyOf(out)).toBe("3.6.4 r r r | 9.1.4 r r r | \\ro \\ts 3 4 \\section A 5.6.4 r r | \\rc 2 7.6.4 r r");
    const score = parseTex(out).score;
    expect(score.masterBars.map((m: { isRepeatStart: boolean }) => m.isRepeatStart)).toEqual([false, false, true, false]);
    expect(score.masterBars.map((m: { timeSignatureNumerator: number }) => m.timeSignatureNumerator)).toEqual([4, 4, 3, 3]);
    expect(score.masterBars[2].section?.text).toBe("A");
  });

  it("goes below the header before bar 0: the tempo stays, the first bar keeps its repeat sign", () => {
    const text = '\\title "Riff"\n\\tempo 90\n\\tuning (E4 B3 G3 D3 A2 E2)\n.\n\\ro 3.6.4 r r r | \\rc 2 5.6.4 r r r\n';
    const out = insert(text, 0, ["9.1.4 r r r", "7.1.4 r r r"])!;
    expect(out).toBe(
      '\\title "Riff"\n\\tempo 90\n\\tuning (E4 B3 G3 D3 A2 E2)\n.\n9.1.4 r r r | 7.1.4 r r r |\n\\ro 3.6.4 r r r | \\rc 2 5.6.4 r r r\n',
    );
    const score = parseTex(out).score;
    expect(score.tempo).toBe(90);
    expect(score.title).toBe("Riff");
    expect(score.masterBars.map((m: { isRepeatStart: boolean }) => m.isRepeatStart)).toEqual([false, false, true, false]);
  });

  it("takes the header's meter, not a `\\ts` written on the first bar", () => {
    const text = "\\tempo 120\n.\n\\ts 3 4 3.6.4 r r\n";
    const score = parseTex(insert(text, 0, ["9.1.4 r r r"])!).score;
    expect(score.masterBars.map((m: { timeSignatureNumerator: number }) => m.timeSignatureNumerator)).toEqual([4, 3]);
  });

  it("goes at the very start of a document with no header", () => {
    expect(insert("3.6.4 r r r\n", 0, ["9.1.4 r r r"])).toBe("9.1.4 r r r | 3.6.4 r r r\n");
  });

  it("appends, after a trailing `|` too", () => {
    expect(bodyOf(insert(tex("3.6.4 r r r"), 1, ["9.1.4 r r r"]))).toBe("3.6.4 r r r | 9.1.4 r r r");
    expect(bodyOf(insert(tex("3.6.4 r r r |"), 1, ["9.1.4 r r r"]))).toBe("3.6.4 r r r | 9.1.4 r r r");
  });

  it("is null for no bars, or a bar that is not there", () => {
    expect(insertBars(tex("r"), node(tex("r")), 0, [])).toBeNull();
    expect(insertBars(tex("r"), node(tex("r")), 2, ["r"])).toBeNull();
  });

  it("keeps a bar line butted against the bar before, before a bar or at the end", () => {
    const text = tex("3.6.4 r r r|5.6.4 r r r");
    expect(bodyOf(insert(text, 1, ["9.1.4 r r r"]))).toBe("3.6.4 r r r|9.1.4 r r r | 5.6.4 r r r");
    expect(bodyOf(insert(text, 2, ["9.1.4 r r r"]))).toBe("3.6.4 r r r|5.6.4 r r r | 9.1.4 r r r");
    expect(bodyOf(insert(tex("3.6.4 r r r|"), 1, ["9.1.4 r r r"]))).toBe("3.6.4 r r r| 9.1.4 r r r");
  });

  it("appends before a comment that follows the last beat, not after it", () => {
    expect(insert(tex("3.6.4 r r r // end"), 1, ["9.1.4 r r r"])).toBe(
      "\\tempo 120\n.\n3.6.4 r r r | 9.1.4 r r r // end\n",
    );
  });

  // Written straight after the last beat, or the last bar line, a comment would
  // be butted against the new bars: they end with a space before it.
  it("appends before a comment butted against the last beat or bar line, leaving a space before it", () => {
    expect(bodyOf(insert(tex("3.6.4 r r r// end"), 1, ["9.1.4 r r r"]))).toBe("3.6.4 r r r | 9.1.4 r r r // end");
    expect(bodyOf(insert(tex("3.6.4 r r r|// end"), 1, ["9.1.4 r r r"]))).toBe("3.6.4 r r r| 9.1.4 r r r // end");
    expect(bodyOf(insert(tex("3.6.4 r r r/* c */"), 1, ["9.1.4 r r r"]))).toBe("3.6.4 r r r | 9.1.4 r r r /* c */");
    for (const body of ["3.6.4 r r r// end", "3.6.4 r r r|// end"]) {
      const out = insert(tex(body), 1, ["9.1.4 r r r"])!;
      const last = beatSplices(out, node(out), [{ barIndex: 1, first: 3, last: 3, beats: ["r"] }]);
      expect(last && sliceCp(out, last[0].from, last[0].to), body).toBe("r");
    }
  });

  it("goes in among bars written one to a line", () => {
    const text = tex("3.6.4 r r r |\n5.6.4 r r r |\n7.6.4 r r r");
    expect(insert(text, 1, ["9.1.4 r r r"])).toBe("\\tempo 120\n.\n3.6.4 r r r |\n9.1.4 r r r | 5.6.4 r r r |\n7.6.4 r r r\n");
    expect(insert(text, 3, ["9.1.4 r r r"])).toBe("\\tempo 120\n.\n3.6.4 r r r |\n5.6.4 r r r |\n7.6.4 r r r | 9.1.4 r r r\n");
    const ending = tex("3.6.4 r r r |\n5.6.4 r r r |");
    expect(insert(ending, 2, ["9.1.4 r r r"])).toBe("\\tempo 120\n.\n3.6.4 r r r |\n5.6.4 r r r | 9.1.4 r r r\n");
    expect(parseTex(insert(text, 1, ["9.1.4 r r r"])!).scoreNode.bars).toHaveLength(4);
  });

  it("lands right after an emoji header, which the offsets count as one character", () => {
    const text = '\\title "Riff \u{1F3B8}"\n\\tempo 90\n.\n3.6.4 r r r\n';
    expect(insert(text, 0, ["9.1.4 r r r"])).toBe(
      '\\title "Riff \u{1F3B8}"\n\\tempo 90\n.\n9.1.4 r r r |\n3.6.4 r r r\n',
    );
  });

  it("keeps a first bar's directives on it when there is no `.`", () => {
    const out = insert("\\ro 3.6.4 r r r\n", 0, ["9.1.4 r r r"])!;
    expect(out).toBe("9.1.4 r r r | \\ro 3.6.4 r r r\n");
    const score = parseTex(out).score;
    expect(score.masterBars.map((m: { isRepeatStart: boolean }) => m.isRepeatStart)).toEqual([false, true]);
  });

  it("is null when the last bar has no beats to append after", () => {
    expect(insertBars("\\tempo 120\n.\n", node("\\tempo 120\n.\n"), 1, ["r"])).toBeNull();
  });
});

describe("replaceBars", () => {
  const replace = (text: string, fromBar: number, bars: string[]) =>
    applySplices(text, replaceBars(text, node(text), fromBar, bars)!);

  it("replaces each bar's beats and leaves its directives where they were", () => {
    const text = tex("\\ro 3.6.4 r r r | \\ts 3 4 \\rc 2 5.6.4 r r | 7.6.4 r r");
    expect(bodyOf(replace(text, 0, ["9.1.4 r r r", "8.1.4 r r"]))).toBe(
      "\\ro 9.1.4 r r r | \\ts 3 4 \\rc 2 8.1.4 r r | 7.6.4 r r",
    );
  });

  it("appends the bars that run past the end of the score", () => {
    expect(bodyOf(replace(tex("3.6.4 r r r | 5.6.4 r r r"), 1, ["9.1.4 r r r", "8.1.4 r r r"]))).toBe(
      "3.6.4 r r r | 9.1.4 r r r | 8.1.4 r r r",
    );
  });

  it("appends all the bars when it starts just past the last one", () => {
    expect(bodyOf(replace(tex("3.6.4 r r r"), 1, ["9.1.4 r r r", "8.1.4 r r r"]))).toBe(
      "3.6.4 r r r | 9.1.4 r r r | 8.1.4 r r r",
    );
  });

  it("keeps a bar line butted against the last beat of a bar it replaces", () => {
    expect(bodyOf(replace(tex("3.6.4 r r r|5.6.4 r r r"), 0, ["9.1.4 r r r"]))).toBe("9.1.4 r r r|5.6.4 r r r");
  });

  it("keeps a comment butted against the last beat of a bar it replaces", () => {
    expect(bodyOf(replace(tex("3.6.4 r r r// end"), 0, ["9.1.4 r r r"]))).toBe("9.1.4 r r r// end");
    expect(bodyOf(replace(tex("3.6.4 r r r/* c */ | 5.6.4 r r r"), 0, ["9.1.4 r r r"]))).toBe("9.1.4 r r r/* c */ | 5.6.4 r r r");
  });

  it("is null for a first bar that is neither in the score nor just past its end, and for a bar with no beats", () => {
    const text = tex("3.6.4 | | 7.6.4");
    expect(replaceBars(text, node(text), -1, ["r"])).toBeNull();
    expect(replaceBars(text, node(text), 4, ["r"])).toBeNull();
    expect(replaceBars(text, node(text), 1, ["r"])).toBeNull();
  });
});

describe("removeBars", () => {
  const remove = (text: string, fromBar: number, toBar: number) =>
    applySplices(text, [removeBars(text, node(text), fromBar, toBar)!]);

  it("removes bars in the middle with one separator", () => {
    expect(bodyOf(remove(tex("3.6.4 | 5.6 | 7.6 | 9.6"), 1, 2))).toBe("3.6.4 | 9.6");
  });

  it("removes the first bars and keeps the header", () => {
    expect(remove(tex("3.6.4 | 5.6 | 7.6"), 0, 1)).toBe("\\tempo 120\n.\n7.6\n");
  });

  it("removes the last bars", () => {
    expect(bodyOf(remove(tex("3.6.4 | 5.6 | 7.6"), 1, 2))).toBe("3.6.4");
  });

  it("is null for every bar", () => {
    expect(removeBars(tex("3.6.4 | 5.6"), node(tex("3.6.4 | 5.6")), 0, 1)).toBeNull();
  });

  it("removes the last bar from behind a comment butted against it, and keeps the comment", () => {
    expect(bodyOf(remove(tex("3.6.4 r r r | 5.6.4 r r r// end"), 1, 1))).toBe("3.6.4 r r r// end");
  });

  it("takes a bar line butted against the bar before along with the last bars", () => {
    expect(bodyOf(remove(tex("3.6.4 5.6| 7.6"), 1, 1))).toBe("3.6.4 5.6");
    expect(bodyOf(remove(tex("3.6.4|5.6|7.6"), 1, 1))).toBe("3.6.4|7.6");
  });

  it("is null for bars that are not there, and where a neighbour has no beats to measure from", () => {
    const text = tex("3.6.4 | | 7.6");
    for (const [from, to] of [[-1, 0], [2, 1], [1, 3]]) expect(removeBars(text, node(text), from, to)).toBeNull();
    expect(removeBars(text, node(text), 2, 2)).toBeNull();
    expect(removeBars(tex("| 3.6.4"), node(tex("| 3.6.4")), 0, 0)).toBeNull();
  });

  // The next bar keeps what is written on it — as when deleteBar removes a bar.
  it("stops short of the next bar's directives, which stay on it", () => {
    const text = tex("3.6.4 | 5.6 | \\ro \\ts 3 4 7.6 | \\rc 2 9.6");
    expect(bodyOf(remove(text, 1, 1))).toBe("3.6.4 | \\ro \\ts 3 4 7.6 | \\rc 2 9.6");
    expect(bodyOf(remove(text, 0, 1))).toBe("\\ro \\ts 3 4 7.6 | \\rc 2 9.6");
    expect(bodyOf(remove(text, 2, 2))).toBe("3.6.4 | 5.6 | \\rc 2 9.6");
  });

  it("cuts what deleteBar cuts from a bar with no directives of its own", () => {
    // Every bar opens on an explicit duration, so deleteBar has nothing to re-pin.
    const text = tex("3.6.4 5.6 | 5.6.4 r|\\ro 7.6.4 r | 9.6.4  |  \\rc 2 8.6.4 r | 4.6.4 r");
    const own = Array.from({ length: node(text).bars.length }, (_, i) => hasBarDirectives(text, node(text), i));
    expect(own).toEqual([false, false, true, false, true, false]);
    own.forEach((carries, i) => {
      if (carries) return;
      expect(remove(text, i, i)).toBe(deleteBar(text, { barIndex: i, beatIndex: 0, string: 1 })!.text);
    });
  });

  // Unlike deleteBar, which leaves a removed bar's own directives for the bar
  // that follows, so the caller has to refuse bars that carry any.
  it("takes a removed bar's own directives with it", () => {
    const text = tex("3.6.4 | \\ro 5.6 | 7.6");
    expect(bodyOf(remove(text, 1, 1))).toBe("3.6.4 | 7.6");
    expect(hasBarDirectives(text, node(text), 1)).toBe(true);
  });
});
