/* eslint-disable @typescript-eslint/no-explicit-any --
 * The locality invariant reads alphaTab's model, whose types are only
 * reachable through namespaces that cannot be imported as types.
 */
import { describe, it, expect } from "vitest";
import { insertClipBars, insertClipBeats, pasteInsert, pasteOverwrite } from "./paste";
import { copyRange, readClip, type ParsedClip } from "../clip";
import { barState, beatLength } from "../barFill";
import { add, cmp, ZERO, type Fraction } from "../fraction";
import { parseTex } from "../parse";
import type { EditOutcome } from "../apply";
import { bindings, model, read } from "./testSupport";
import { rangeOf } from "../selection";

const tex = (body: string) => `\\tempo 120\n.\n${body}\n`;
const caret = (barIndex: number, beatIndex: number, string = 6) => ({ barIndex, beatIndex, string });
const clip = (raw: string) => readClip(raw)!;
const body = (outcome: EditOutcome) => {
  if (outcome.kind !== "ok") throw new Error(`expected ok, got ${JSON.stringify(outcome)}`);
  return outcome.result.text.split("\n")[2];
};
const over = (b: string, at: [number, number], raw: string) => pasteOverwrite(tex(b), caret(...at), clip(raw));
const insert = (b: string, at: [number, number], raw: string) => pasteInsert(tex(b), caret(...at), clip(raw));
const exact = (b: string, barIndex = 0) => barState(parseTex(tex(b)).score, barIndex).kind === "exact";

describe("pasteOverwrite: beats", () => {
  it("replaces exactly as much time from the caret, and re-pins the beat after", () => {
    const out = over("3.6.4 5.6 7.6 8.6", [0, 1], "9.6.8 10.6");
    expect(body(out)).toBe("3.6.4 9.6.8 10.6 7.6.4 8.6");
    expect(out.kind === "ok" && out.selection).toEqual({ from: { barIndex: 0, beatIndex: 1 }, to: { barIndex: 0, beatIndex: 2 } });
    expect(out.kind === "ok" && out.result.caret).toEqual(caret(0, 1));
  });

  it("leaves the rest of a beat it only partly covers as rests, so the bar keeps its length", () => {
    expect(body(over("r.4 r r r", [0, 0], "5.6.8"))).toBe("5.6.8 r r.4 r r");
    expect(exact("5.6.8 r r.4 r r")).toBe(true);
  });

  it("says what is left of a triplet beat with a triplet rest", () => {
    // a plain 8th over a triplet quarter leaves a triplet 16th
    expect(body(over("r.4{tu 3} r.4{tu 3} r.4{tu 3} r.2", [0, 0], "5.6.8"))).toBe("5.6.8 r.16{tu 3} r.4{tu 3} r.4{tu 3} r.2");
    // a 16th over a triplet 8th leaves a triplet 32nd
    const out = body(over("r.8{tu 3} r.8{tu 3} r.8{tu 3} r.4 r.2", [0, 0], "5.6.16"));
    expect(out).toBe("5.6.16 r.32{tu 3} r.8{tu 3} r.8{tu 3} r.4 r.2");
    expect(exact(out)).toBe(true);
  });

  it("leaves what is left of a dotted beat as a plain rest", () => {
    expect(body(over("r.4{d} r.8 r.2", [0, 0], "5.6.4"))).toBe("5.6.4 r.8 r.8 r.2");
  });

  it("is refused, changing nothing, when no rest can say what is left", () => {
    // a 64th over a triplet 8th leaves 13/192 of a whole note
    expect(over("r.8{tu 3} r.8{tu 3} r.8{tu 3} r.4 r.2", [0, 0], "5.6.64")).toEqual({
      kind: "refused",
      barIndex: 0,
      why: "remainderInexpressible",
    });
  });

  it("is refused when the clip is longer than the rest of the bar", () => {
    expect(over("3.6.4 5.6 7.6 8.6", [0, 3], "9.6.4 10.6")).toEqual({ kind: "refused", barIndex: 0, why: "doesNotFit" });
  });

  it("keeps the length it measured for a bare Source-pane fragment pasted after 16ths", () => {
    const out = body(over("3.6.16 r r r r r r r r r r r r r r r", [0, 4], "5.6 7.6"));
    expect(out).toBe("3.6.16 r r r 5.6.4 7.6 r.16 r r r");
    expect(exact(out)).toBe(true);
  });

  it("over the origin of a later tie and the target of an earlier hammer-on, changes neither pitch nor binding outside", () => {
    expect(body(over("3.6{h}.4 5.6 -.6 r", [0, 1], "0.1.4"))).toBe("3.6.4 0.1.4 5.6 r");
    expect(body(over("3.6.4 5.5 -.5 8.6", [0, 1], "0.1.4"))).toBe("3.6.4 0.1.4 5.5 8.6");
  });

  it("refuses beats that cross a bar line, and several whole bars away from a bar's first beat", () => {
    expect(over("3.6.4 r r r | r r r r", [0, 0], "5.6.4 7.6 | 8.6")).toEqual({ kind: "refused", barIndex: 0, why: "crossesBarLine" });
    expect(over("3.6.4 r r r | r r r r", [0, 1], "5.6.4 r r r | r r r r |")).toEqual({
      kind: "refused",
      barIndex: 0,
      why: "needsBarStart",
    });
  });

  it("pastes one whole bar away from a bar's first beat as beats", () => {
    expect(over("3.6.4 r r r | r r r r", [0, 1], "5.6.4 r r r |")).toEqual({ kind: "refused", barIndex: 0, why: "doesNotFit" });
    expect(body(over("3.6.4 r r r | r r r r", [0, 2], "5.6.8 7.6 |"))).toBe("3.6.4 r 5.6.8 7.6 r.4 | r r r r");
  });
});

describe("pasteOverwrite: whole bars", () => {
  const DOC = "3.6.4 r r r | 5.6.4 r r r | \\rc 2 7.6.4 r r r";

  it("replace that many bars from the caret's, leaving their directives", () => {
    const out = over(DOC, [1, 0], "9.6.4 9.6 9.6 9.6 | 8.6.2 r |");
    expect(body(out)).toBe("3.6.4 r r r | 9.6.4 9.6 9.6 9.6 | \\rc 2 8.6.2 r");
    expect(out.kind === "ok" && out.selection).toEqual({ from: { barIndex: 1, beatIndex: 0 }, to: { barIndex: 2, beatIndex: 1 } });
  });

  it("add bars at the end when the score runs out", () => {
    const out = over(DOC, [2, 0], "9.6.4 r r r | 8.6.4 r r r |");
    expect(body(out)).toBe("3.6.4 r r r | 5.6.4 r r r | \\rc 2 9.6.4 r r r | 8.6.4 r r r");
    expect(out.kind === "ok" && out.selection).toEqual({ from: { barIndex: 2, beatIndex: 0 }, to: { barIndex: 3, beatIndex: 3 } });
  });

  it("paste the same in another tab: nothing but the clipboard text carries over", () => {
    // Two bars at the other tab's last bar: the first replaces it, the second is
    // appended. One bar over a bar of the same length could not tell a clip of
    // bars from a clip of beats, nor replacing from appending.
    const copied = copyRange(tex("5.6.8 7.6 8.6 7.6 r r r r | 3.6.4 5.6 7.6 8.6"), {
      from: { barIndex: 0, beatIndex: 0 },
      to: { barIndex: 1, beatIndex: 3 },
    });
    if (copied.kind !== "copied") throw new Error("copy refused");
    const elsewhere = pasteOverwrite(tex("3.6.4 5.6 7.6 8.6 | 3.6.4 5.6 7.6 8.6"), caret(1, 0), readClip(copied.clip.text)!);
    expect(body(elsewhere)).toBe("3.6.4 5.6 7.6 8.6 | 5.6.8 7.6 8.6 7.6 r r r r | 3.6.4 5.6 7.6 8.6");
    expect(elsewhere.kind === "ok" && elsewhere.selection).toEqual({ from: { barIndex: 1, beatIndex: 0 }, to: { barIndex: 2, beatIndex: 3 } });
  });
});

describe("pasteInsert", () => {
  it("puts beats in before the caret's beat, and the bar grows", () => {
    const out = insert("3.6.4 5.6 7.6 8.6", [0, 1], "9.6.8 10.6");
    expect(body(out)).toBe("3.6.4 9.6.8 10.6 5.6.4 7.6 8.6");
    expect(out.kind === "ok" && out.selection).toEqual({ from: { barIndex: 0, beatIndex: 1 }, to: { barIndex: 0, beatIndex: 2 } });
  });

  it("puts whole bars in before the caret's bar, in front of its directives, wherever the caret is in it", () => {
    const out = insert("3.6.4 r r r | \\ro 5.6.4 r r r | \\rc 2 7.6.4 r r r", [1, 2], "9.6.4 r r r |");
    expect(body(out)).toBe("3.6.4 r r r | 9.6.4 r r r | \\ro 5.6.4 r r r | \\rc 2 7.6.4 r r r");
    expect(out.kind === "ok" && out.result.caret).toEqual(caret(1, 0));
  });

  it("puts whole bars in before bar 0 under the header, and the bar still starts the repeat a `\\ro` after the `.` opened", () => {
    // bar 0's node holds the header too: the new bars go on a line of their own right after the `.`, not in front of the `\ro`
    const head = '\\title "Riff"\n\\tempo 90\n.\n';
    const out = pasteInsert(`${head}\\ro 3.6.4 r r r | \\rc 2 5.6.4 r r r\n`, caret(0, 2), clip("9.1.4 r r r | 7.1.4 r r r |"));
    expect(out.kind === "ok" && out.result.text).toBe(`${head}9.1.4 r r r | 7.1.4 r r r |\n\\ro 3.6.4 r r r | \\rc 2 5.6.4 r r r\n`);
    const { score } = parseTex(out.kind === "ok" ? out.result.text : "");
    expect(score.tempo).toBe(90);
    expect(score.title).toBe("Riff");
    expect(score.masterBars.map((m: { isRepeatStart: boolean }) => m.isRepeatStart)).toEqual([false, false, true, false]);
    expect(score.masterBars.map((m: { repeatCount: number }) => m.repeatCount)).toEqual([0, 0, 0, 2]);
    expect(out.kind === "ok" && out.selection).toEqual({ from: { barIndex: 0, beatIndex: 0 }, to: { barIndex: 1, beatIndex: 3 } });
  });

  it("puts beats across a bar line in as bars at a bar's first beat, and refuses them anywhere else", () => {
    const out = insert("3.6.4 r r r", [0, 0], "5.6.4 7.6 | 8.6");
    expect(out.kind === "ok" && out.result.text).toBe("\\tempo 120\n.\n5.6.4 7.6 | 8.6 |\n3.6.4 r r r\n");
    expect(insert("3.6.4 r r r", [0, 1], "5.6.4 7.6 | 8.6")).toEqual({ kind: "refused", barIndex: 0, why: "crossesBarLine" });
  });

  it("cleans the edges: a hammer-on before stops reaching in, a tie stranded by new bars keeps its pitch", () => {
    expect(body(insert("3.6{h}.4 5.6 r r", [0, 1], "7.6.4"))).toBe("3.6.4 7.6.4 5.6 r r");
    // alphaTab ties back across at most two bars between; a third bar in between would make it the open string
    expect(body(insert("5.6.4 r r r | r r r r | r r r r | -.6.4 r r r", [1, 0], "0.1.4 r r r |"))).toBe(
      "5.6.4 r r r | 0.1.4 r r r | r r r r | r r r r | 5.6.4 r r r",
    );
  });
});

describe("pasting where the tab is already unusual", () => {
  it("into a bar that is already too long, keeps it exactly as long", () => {
    const before = "3.6.4 5.6 7.6 8.6 9.6";
    const out = body(over(before, [0, 1], "10.6.8 11.6"));
    expect(out).toBe("3.6.4 10.6.8 11.6 7.6.4 8.6 9.6");
    expect(barState(parseTex(tex(out)).score, 0)).toEqual(barState(parseTex(tex(before)).score, 0));
  });

  it("is refused, changing nothing, when a beat it cannot read stands where an edge rule must look", () => {
    // the 5 on string 6 is overwritten; the walk for the next note on that string meets x.6 first
    expect(over("3.6.4 5.6 r r | x.6.4 r r r | -.6.4 r r r", [0, 1], "0.1.4")).toEqual({ kind: "refused", barIndex: 0 });
  });

  it("splices at the right places after an emoji in the header, which leaves it byte-identical", () => {
    const head = '\\title "Riff \u{1F3B8}"\n\\tempo 90\n.\n';
    const out = pasteInsert(`${head}3.6.4 r r r\n`, caret(0, 0), clip("5.6.4 r r r |"));
    expect(out.kind === "ok" && out.result.text).toBe(`${head}5.6.4 r r r |\n3.6.4 r r r\n`);
    const over4 = pasteOverwrite(`${head}3.6.4 5.6 7.6 8.6\n`, caret(0, 1), clip("9.6.8 10.6"));
    expect(over4.kind === "ok" && over4.result.text).toBe(`${head}3.6.4 9.6.8 10.6 7.6.4 8.6\n`);
  });

  it("puts 4/4 bars over a 3/4 bar: the bar keeps its `\\ts 3 4` and shows as long", () => {
    const out = body(over("3.6.4 r r r | \\ts 3 4 5.6.4 r r", [1, 0], "9.6.4 9.6 9.6 9.6 |"));
    expect(out).toBe("3.6.4 r r r | \\ts 3 4 9.6.4 9.6 9.6 9.6");
    expect(barState(parseTex(tex(out)).score, 1).kind).toBe("long");
  });

  it("is refused, naming the bar, when it would write into a bar the commands cannot read", () => {
    // the edge walks find their notes before they reach `x.1.4`: only the bar's own check stops these
    const b = "3.6.4 r r r | x.1.4 3.6 r r";
    expect(insert(b, [1, 2], "5.6.4")).toEqual({ kind: "refused", barIndex: 1 });
    expect(over(b, [1, 2], "5.6.4")).toEqual({ kind: "refused", barIndex: 1 });
    expect(over(b, [1, 0], "9.6.4 r r r |")).toEqual({ kind: "refused", barIndex: 1 });
  });

  it("is refused in a tab with a second voice or track, which new bars would put out of step, saying so", () => {
    const voices = "\\tempo 120\n.\n\\voice\n3.6.4 5.6 7.6 8.6 | 1.6.4 r r r\n\\voice\n0.1.2 0.1.2 | 2.1.2 r\n";
    const tracks = '\\tempo 120\n.\n\\track "A"\n3.6.4 5.6 7.6 8.6 | 1.6.4 r r r\n\\track "B"\n0.1.1 | 2.1.1\n';
    const severalTracks = { kind: "refused", barIndex: 1, why: "severalTracks" };
    for (const text of [voices, tracks]) {
      expect(pasteInsert(text, caret(1, 0), clip("9.6.4 r r r |"))).toEqual(severalTracks);
      expect(pasteOverwrite(text, caret(1, 0), clip("9.6.4 r r r |"))).toEqual(severalTracks);
      // beats go into one bar, which is refused as a bar the commands cannot read
      expect(pasteOverwrite(text, caret(1, 0), clip("9.6.4"))).toEqual({ kind: "refused", barIndex: 1 });
      expect(pasteInsert(text, caret(1, 1), clip("9.6.4"))).toEqual({ kind: "refused", barIndex: 1 });
    }
  });
});

describe("pasteOverwrite: at the edges of what fits", () => {
  it("takes exactly the time left in the bar, re-pinning the next bar's first beat, and not a 64th more", () => {
    const out = over("3.6.4 5.6 7.6 8.6 | 1.6 r r r", [0, 2], "9.6.8 10.6 11.6 12.6");
    expect(body(out)).toBe("3.6.4 5.6 9.6.8 10.6 11.6 12.6 | 1.6.4 r r r");
    expect(out.kind === "ok" && out.selection).toEqual({ from: { barIndex: 0, beatIndex: 2 }, to: { barIndex: 0, beatIndex: 5 } });
    expect(over("3.6.4 5.6 7.6 8.6 | 1.6 r r r", [0, 2], "9.6.8 10.6 11.6 12.6 13.6.64")).toEqual({
      kind: "refused",
      barIndex: 0,
      why: "doesNotFit",
    });
  });

  it("says what is left of a quintuplet or a sextuplet beat with a rest of its own kind", () => {
    const fives = body(over("r.8{tu 5} r.8{tu 5} r.8{tu 5} r.8{tu 5} r.8{tu 5} r.2", [0, 0], "5.6.16{tu 5}"));
    expect(fives).toBe("5.6.16{tu 5} r.16{tu 5} r.8{tu 5} r.8{tu 5} r.8{tu 5} r.8{tu 5} r.2");
    expect(exact(fives)).toBe(true);
    // a triplet 16th is as long, but it is not what the bar is written in
    const sixes = body(over("r.8{tu 6} r.8{tu 6} r.8{tu 6} r.8{tu 6} r.8{tu 6} r.8{tu 6} r.2", [0, 0], "5.6.16{tu 6}"));
    expect(sixes).toBe("5.6.16{tu 6} r.16{tu 6} r.8{tu 6} r.8{tu 6} r.8{tu 6} r.8{tu 6} r.8{tu 6} r.2");
    expect(exact(sixes)).toBe(true);
  });

  it("fills what is left with rests no longer than the bar's beat: 8ths in 6/8", () => {
    const out = body(over("\\ts 6 8 r.2{d}", [0, 0], "5.6.16"));
    expect(out).toBe("\\ts 6 8 5.6.16 r.8 r r r r r.16");
    expect(exact(out)).toBe(true);
  });

  it("says what is left of a dotted triplet beat with an undotted triplet and plain rests", () => {
    // no one value is 11/48 of a whole note; a triplet quarter and a 16th are
    const out = body(over("r.4{d tu 3} r r r", [0, 0], "5.6.32{tu 3}"));
    expect(out).toBe("5.6.32{tu 3} r.4{tu 3} r.16 r.4 r r");
    expect(exact(out)).toBe(true);
  });

  it("puts grace notes, which take no time, in before the caret's beat, which keeps its duration", () => {
    const out = over("3.6.4 5.6 7.6 8.6", [0, 1], "5.6.16{gr}");
    expect(body(out)).toBe("3.6.4 5.6.16{gr} 5.6.4 7.6 8.6");
    expect(out.kind === "ok" && out.selection).toEqual({ from: { barIndex: 0, beatIndex: 1 }, to: { barIndex: 0, beatIndex: 1 } });
    expect(exact(body(out))).toBe(true);
  });
});

// The beat right after pasted bars may inherit its duration from what was
// there before, or be a tie to it: the paste must not re-time or re-pitch it.
describe("the beat after pasted bars", () => {
  it("keeps the duration it inherited from the bars written over, and the note its tie to them held", () => {
    expect(body(over("3.6.4 r r r | 5.6.8 r r r r r r r | 7.6 r r r r r r r", [1, 0], "9.6.4 r r r |"))).toBe(
      "3.6.4 r r r | 9.6.4 r r r | 7.6.8 r r r r r r r",
    );
    expect(body(over("3.6.4 r r r | 5.6.8 r r r r r r 7.6 | -.6 r r r r r r r", [1, 0], "9.6.4 r r r |"))).toBe(
      "3.6.4 r r r | 9.6.4 r r r | 7.6.8 r r r r r r r",
    );
  });

  it("keeps the duration it inherited from before the bars put in front of it, as bars or as beats across a bar line", () => {
    expect(body(insert("3.6.8 r r r r r r r | 5.6 r r r r r r r", [1, 0], "9.6.4 r r r |"))).toBe(
      "3.6.8 r r r r r r r | 9.6.4 r r r | 5.6.8 r r r r r r r",
    );
    expect(body(insert("3.6.8 r r r r r r r | 5.6 r r r r r r r", [1, 0], "5.6.4 7.6 | 8.6"))).toBe(
      "3.6.8 r r r r r r r | 5.6.4 7.6 | 8.6 | 5.6.8 r r r r r r r",
    );
  });
});

describe("pasting: ties and legato at the edges", () => {
  // alphaTab 1.8.1 binds a hammer-on or slide no further than the next bar's
  // first beat, whatever is on it. New beats in front of that beat leave one
  // that reached it bound to nothing, on any string: the text says so too.
  it("drops a hammer-on on any string that reached a bar's first beat, when new beats go in front of it", () => {
    expect(body(insert("3.6{h}.4 r r r | 5.6.4 r r r", [1, 0], "7.5.4"))).toBe("3.6.4 r r r | 7.5.4 5.6.4 r r r");
    expect(body(over("3.6{h}.4 r r r | 5.6.4 r r r", [1, 0], "7.5.16{gr}"))).toBe("3.6.4 r r r | 7.5.16{gr} 5.6.4 r r r");
  });

  it("leaves a hammer-on on a string it does not touch, which binds past what it writes", () => {
    expect(body(insert("5.5{h}.4 r 7.6 7.5", [0, 2], "9.6.4"))).toBe("5.5{h}.4 r 9.6.4 7.6 7.5");
    expect(body(over("5.5{h}.4 r 7.6 7.5", [0, 2], "9.6.4"))).toBe("5.5{h}.4 r 9.6.4 7.5");
  });

  // What goes in front of a bar's first beat can bind the bar before, and so
  // can what it pushes back: the legato walks look on their strings only, not on
  // every one, so a beat they cannot read is in their way only if they reach it.
  describe("in front of a bar's first beat", () => {
    // string 6 stops at the 3 in bar 2; string 1 would run on to the dead note in bar 0
    const b = (first: string) => `x.1.4 r r r | r r r r | 3.6.4 r r r | ${first}`;

    it("looks back on the strings of the beat it pushes back and of the clip, not on every string", () => {
      expect(body(insert(b("5.6.4 r r r"), [3, 0], "7.6.4"))).toBe(b("7.6.4 5.6.4 r r r"));
      expect(body(over(b("5.6.4 r r r"), [3, 0], "7.6.16{gr}"))).toBe(b("7.6.16{gr} 5.6.4 r r r"));
    });

    it("looks back on every string when the beat it pushes back, or the clip, holds a left-hand tap", () => {
      const refused = { kind: "refused", barIndex: 3 };
      expect(insert(b("5.6{lht}.4 r r r"), [3, 0], "7.6.4")).toEqual(refused);
      expect(over(b("5.6{lht}.4 r r r"), [3, 0], "7.6.16{gr}")).toEqual(refused);
      expect(insert(b("5.6.4 r r r"), [3, 0], "7.6{lht}.4")).toEqual(refused);
      expect(over(b("5.6.4 r r r"), [3, 0], "7.6{lht}.16{gr}")).toEqual(refused);
    });

    it("leaves a hammer-on alone where the beat it pushes back is not first in its bar: it still reaches that beat", () => {
      expect(body(over("3.6{h}.4 5.6 r r", [0, 1], "7.5.16{gr}"))).toBe("3.6{h}.4 7.5.16{gr} 5.6.4 r r");
      expect(body(insert("3.6{h}.4 5.6 r r", [0, 1], "7.5.4"))).toBe("3.6{h}.4 7.5.4 5.6 r r");
    });

    it("is still refused when a beat it cannot read stands on the way back for a string the beat it pushes back plays", () => {
      // the clip's string 5 stops at the 3 in bar 2; only the pushed back beat's string 6 reaches `x.6.4`
      expect(insert("x.6.4 r r r | r r r r | 3.5.4 r r r | 5.6.4 r r r", [3, 0], "7.5.4")).toEqual({ kind: "refused", barIndex: 3 });
    });
  });

  it("writes a tie bound to nothing as the open string it sounds, when new music would give it a note", () => {
    // four bars from the 3, the tie sounds the open string; the new 7 would be three bars from it
    expect(body(insert("3.6.4 r r r | r r r r | r r r r | r r r r | -.6.4 r r r", [2, 0], "7.6.4 r r r |"))).toBe(
      "3.6.4 r r r | r r r r | 7.6.4 r r r | r r r r | r r r r | 0.6.4 r r r",
    );
  });

  it("finds a tie within three bars of the last bar it writes over, however far the first", () => {
    // the tie holds the 7 three bars back, which the 8 would take over
    const b = "3.6.4 r r r | 5.6.4 r r r | 7.6.4 r r r | r r r r | r r r r | -.6.4 r r r";
    expect(body(over(b, [1, 0], "9.6.4 r r r | 8.6.4 r r r |"))).toBe(
      "3.6.4 r r r | 9.6.4 r r r | 8.6.4 r r r | r r r r | r r r r | 7.6.4 r r r",
    );
  });

  it("is refused, naming the caret's bar, when a tie it must rewrite cannot be followed back to its note", () => {
    // The tie after the new bar holds another tie, which holds whatever lies
    // behind `x.1.4`: a beat the commands cannot read, which might hold the
    // string. Any fret written for it would be a guess.
    const b = "5.6.4 r r r | x.1.4 r r r | -.6.4 r r r | (3.5 2.4 1.3 0.2 0.1).4 r r r | -.6.4 r r r";
    expect(insert(b, [4, 0], "9.1.4 r r r |")).toEqual({ kind: "refused", barIndex: 4 });
  });
});

// alphaTab 1.8.1 binds a hammer-on to a left-hand tap (`{lht}`) on another
// string, the first it meets with nothing on its own string in the way. A paste
// that writes a tap, or takes one out, can send an earlier hammer-on to a note
// the text never gave it, on any string: `{h}` must go there as well.
describe("pasting: a left-hand tap, which a hammer-on binds to from another string", () => {
  it("drops a hammer-on on another string than the clip's, which a tap in the clip would take", () => {
    expect(body(insert("3.5{h}.4 r r r", [0, 1], "7.6{lht}.4"))).toBe("3.5.4 7.6{lht}.4 r r r");
    expect(body(over("3.5{h}.4 r r r", [0, 1], "7.6{lht}.4"))).toBe("3.5.4 7.6{lht}.4 r r");
    // a tap beside another note of a chord, and a tap on a string below the hammer-on's
    expect(body(insert("3.5{h}.4 r r r", [0, 1], "(7.6 5.4{lht}).4"))).toBe("3.5.4 (7.6 5.4{lht}).4 r r r");
  });

  it("drops a hammer-on that a tap written over was taking, and would find another note without it", () => {
    // the 3 binds to the tapped 7; with the 7 gone it would bind to the 9 on its own string
    expect(body(over("3.5{h}.4 7.6{lht}.4 r 9.5.4", [0, 1], "r.4"))).toBe("3.5.4 r.4 r 9.5.4");
    expect(body(over("3.5{h}.4 7.6{lht}.4 r 9.5.4", [0, 1], "9.1.4"))).toBe("3.5.4 9.1.4 r 9.5.4");
  });

  it("finds the tap by its property, however it is spelled: alphaTab ignores an empty argument list", () => {
    expect(body(insert("3.5{h}.4 r r r", [0, 1], "7.6{lht()}.4"))).toBe("3.5.4 7.6{lht()}.4 r r r");
    expect(body(over("3.5{h}.4 r r r", [0, 1], "7.6{pm lht ()}.4"))).toBe("3.5.4 7.6{pm lht ()}.4 r r");
    expect(body(over("3.5{h}.4 7.6{lht ()}.4 r 9.5.4", [0, 1], "r.4"))).toBe("3.5.4 r.4 r 9.5.4");
  });

  it("does the same for whole bars: a tap in the bars written, or in the bars written over", () => {
    expect(body(over("3.5{h}.4 r r r | 3.6.4 r r r", [1, 0], "7.6{lht}.4 r r r |"))).toBe("3.5.4 r r r | 7.6{lht}.4 r r r");
    expect(body(over("3.5{h}.4 r r r | 7.6{lht}.4 r r r", [1, 0], "9.1.4 r r r |"))).toBe("3.5.4 r r r | 9.1.4 r r r");
  });

  // A slide binds to the next note on its own string only (alphaTab 1.8.1's nextNoteOnSameLine), never to a
  // tap on another: on the strings a tap alone brings in, the hammer-on goes and a slide stays.
  it("leaves a slide on another string than the tap's, which binds past it as before", () => {
    expect(body(insert("3.4{sl}.4 r r 5.4.4", [0, 1], "7.6{lht}.4"))).toBe("3.4{sl}.4 7.6{lht}.4 r r 5.4.4");
    expect(body(over("3.4{sl}.4 r r 5.4.4", [0, 1], "7.6{lht}.4"))).toBe("3.4{sl}.4 7.6{lht}.4 r 5.4.4");
    expect(body(insert("3.4{ss}.4 r r 5.4.4", [0, 1], "7.6{lht}.4"))).toBe("3.4{ss}.4 7.6{lht}.4 r r 5.4.4");
    // the slide bound to the 5 before, and still does
    const out = insert("3.4{sl}.4 r r 5.4.4", [0, 1], "7.6{lht}.4");
    const notes = parseTex(out.kind === "ok" ? out.result.text : "").score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes;
    expect(notes[0].slideTarget?.beat.index).toBe(4);
  });

  it("drops the hammer-on the tap would take and keeps the slide it would not, on the strings before it", () => {
    // the 3 on string 5 would bind to the tap; the slide on string 4 still reaches the next bar's first beat
    expect(body(over("3.5{h}.4 3.4{sl}.4 r r | 5.4.4 r r r", [0, 2], "7.6{lht}.4"))).toBe(
      "3.5.4 3.4{sl}.4 7.6{lht}.4 r | 5.4.4 r r r",
    );
    // a note with both, on another string than the tap's
    expect(body(insert("3.5{pm h}.4 r r r", [0, 1], "7.6{lht}.4"))).toBe("3.5{pm}.4 7.6{lht}.4 r r r");
    expect(body(insert("3.5{h sl}.4 r r 5.5.4", [0, 1], "7.6{lht}.4"))).toBe("3.5{sl}.4 7.6{lht}.4 r r 5.5.4");
  });

  it("leaves a hammer-on alone when no tap is written or taken out", () => {
    expect(body(insert("3.5{h}.4 r r r", [0, 1], "7.6.4"))).toBe("3.5{h}.4 7.6.4 r r r");
    expect(body(over("3.5{h}.4 7.6.4 r 9.1.4", [0, 1], "r.4"))).toBe("3.5{h}.4 r.4 r 9.1.4");
  });
});

// A sticky `:8{tu 3}` makes every beat after it a triplet, whatever its own
// text says: pasted there, the clip's beats and the rests left after them
// would come out at other lengths than they were copied at.
describe("pasting after a sticky tuplet", () => {
  const sticky = (bar2: string) => `\\tempo 120\n.\n:8{tu 3} 3.6 5.6 7.6 | ${bar2}\n`;

  it("is refused, naming the bar, rather than re-time what it writes", () => {
    const refused = { kind: "refused", barIndex: 1 };
    expect(pasteOverwrite(sticky("3.6 5.6 7.6"), caret(1, 0), clip("9.6.8"))).toEqual(refused);
    expect(pasteOverwrite(sticky("3.6 5.6 7.6"), caret(1, 0), clip("9.6.4 r r r |"))).toEqual(refused);
    expect(pasteInsert(sticky("3.6 5.6 7.6"), caret(1, 1), clip("9.6.8"))).toEqual(refused);
    expect(pasteInsert(sticky("3.6 5.6 7.6"), caret(1, 0), clip("9.6.4 r r r |"))).toEqual(refused);
    // the triplet keeps its length, but the plain quarter rest left after it would not
    expect(pasteOverwrite(sticky("3.6.2 5.6 7.6"), caret(1, 0), clip("9.6.8{tu 3}"))).toEqual(refused);
  });

  it("pastes triplets there, which come out as they were copied", () => {
    const out = pasteOverwrite(sticky("3.6 5.6 7.6"), caret(1, 0), clip("9.6.8{tu 3}"));
    expect(out.kind === "ok" && out.result.text).toBe(sticky("9.6.8{tu 3} 5.6 7.6"));
  });
});

describe("insertClipBeats and insertClipBars, as duplicate uses them", () => {
  it("put beats in after a bar's last beat, re-pinning the next bar's first", () => {
    const out = insertClipBeats(tex("3.6.4 5.6 7.6 8.6 | 9.6 r r r"), caret(0, 3), { barIndex: 0, beatIndex: 3 }, true, clip("1.6.8 2.6"));
    expect(body(out)).toBe("3.6.4 5.6 7.6 8.6 1.6.8 2.6 | 9.6.4 r r r");
    expect(out.kind === "ok" && out.selection).toEqual({ from: { barIndex: 0, beatIndex: 4 }, to: { barIndex: 0, beatIndex: 5 } });
  });

  it("put beats in after a bar's first beat, which stays first: the hammer-on from the bar before still reaches it", () => {
    const after = (doc: string, raw: string) => insertClipBeats(tex(doc), caret(1, 0), { barIndex: 1, beatIndex: 0 }, true, clip(raw));
    expect(body(after("3.6{h}.4 r r r | 5.6.4 r r r", "7.5.4"))).toBe("3.6{h}.4 r r r | 5.6.4 7.5.4 r r r");
    // a tapped first beat is bound to from any string: the 3 on string 5 keeps it
    expect(body(after("3.5{h}.4 r r r | 7.6{lht}.4 r r r", "9.1.4"))).toBe("3.5{h}.4 r r r | 7.6{lht}.4 9.1.4 r r r");
  });

  // Duplicate's copy follows the beats it repeats, which already bound every hammer-on before them or let it
  // pass; a clip put in front of a beat follows nothing of the kind, and a tap in it can take one.
  it("take a clip as repeating the beats before it only when it goes in after them", () => {
    const at = { barIndex: 0, beatIndex: 1 };
    const inFront = insertClipBeats(tex("3.5{h}.4 r r r"), caret(0, 1), at, false, clip("7.6{lht}.4"), { repeats: true });
    expect(body(inFront)).toBe("3.5.4 7.6{lht}.4 r r r");
    const after = insertClipBeats(tex("3.5{h}.4 7.6{lht}.4 r r"), caret(0, 1), at, true, clip("7.6{lht}.4"), { repeats: true });
    expect(body(after)).toBe("3.5{h}.4 7.6{lht}.4 7.6{lht}.4 r r");
    // and a paste after them, which repeats nothing, drops it
    expect(body(insertClipBeats(tex("3.5{h}.4 7.6{lht}.4 r r"), caret(0, 1), at, true, clip("7.6{lht}.4")))).toBe(
      "3.5.4 7.6{lht}.4 7.6{lht}.4 r r",
    );
  });

  it("put beats in after a beat whose hammer-on would now reach them, which drops it", () => {
    const out = insertClipBeats(tex("3.6.4 5.6{h} 7.6 r"), caret(0, 1), { barIndex: 0, beatIndex: 1 }, true, clip("5.6.4"));
    expect(body(out)).toBe("3.6.4 5.6 5.6.4 7.6 r");
  });

  it("refuse beats across a bar line, which go in only as bars", () => {
    const out = insertClipBeats(tex("3.6.4 r r r"), caret(0, 1), { barIndex: 0, beatIndex: 1 }, true, clip("5.6.4 7.6 | 8.6"));
    expect(out).toEqual({ kind: "refused", barIndex: 0, why: "crossesBarLine" });
  });

  it("append bars after the last one", () => {
    const out = insertClipBars(tex("3.6.4 r r r"), caret(0, 0), 1, clip("5.6.4 r r r |"));
    expect(body(out)).toBe("3.6.4 r r r | 5.6.4 r r r");
    expect(out.kind === "ok" && out.selection).toEqual({ from: { barIndex: 1, beatIndex: 0 }, to: { barIndex: 1, beatIndex: 3 } });
  });

  it("name the caret's bar when they refuse, not the bar the copy would go in front of", () => {
    // duplicating bar 4: the tie after the copy cannot be followed back past `x.1.4`
    const b = "5.6.4 r r r | x.1.4 r r r | -.6.4 r r r | (3.5 2.4 1.3 0.2 0.1).4 r r r | -.6.4 r r r";
    expect(insertClipBars(tex(b), caret(3, 0), 4, clip("(3.5 2.4 1.3 0.2 0.1).4 r r r |"))).toEqual({ kind: "refused", barIndex: 3 });
  });
});

describe("invariant: a paste changes nothing outside the music it writes", () => {
  const CORPUS = [
    "5.6.4 -.6 r r | -.6.8 7.6{h} 9.6 r r.4 r.4",
    "(5.6 7.5).4 (-.6 9.5{h}) 10.5 -.5 | -.5.8 5.6{sl} 7.6 r r.2",
    "3.6{h}.8 5.6 r 5.5{ss} 7.5 r.4 | -.5.4 3.6.8 r r.2 | 7.6.4 -.6 -.6 -.6",
    "3.6.8{tu 3} 5.6.8{tu 3} 7.6.8{tu 3} r.4 r.2 | -.6.4{d} 5.6.8 r.2",
    // Bars that start without a duration of their own, one a tie across the
    // bar line: the beat after the paste must be re-pinned.
    "3.6.4 5.6{h} 7.6 r | 5.5.8 r r -.5 7.6 r r r | r.4 r 9.6 r | -.6 r r r",
    // A tie four bars from the note before it: alphaTab binds it to nothing,
    // and music pasted between them must not give it a note.
    "3.6.4 r r r | r r r r | r r r r | r r r r | -.6.4 r r r",
    // Legato at a bar's end before a bar that starts with a rest or another
    // string: alphaTab 1.8.1 binds it to nothing, and must not once a paste
    // puts another beat first.
    "3.6.4 r r 5.6{h} | r.4 7.6 r 5.5{sl} | 2.4.4 9.5 r r",
    // A chain of ties bound to nothing (the open string), across a rest and a bar line.
    "-.6.4 -.6 r -.6 | -.6.4 r r r",
    // Hammer-ons that bind across strings, to a left-hand tap, in a bar and onto the next bar's first beat: a
    // paste that writes a tap, or takes one out, must not send them to another note.
    "3.5{h}.4 7.6{lht}.4 r 9.5.4 | 5.5{h}.4 r r r | 3.6{lht}.4 r 7.5 r",
    "3.5{h}.4 r r 5.4{h} | r.4 7.6{lht} r r | 3.6.4 (7.5 5.4{lht}) r 9.4",
  ].map(tex);
  const CLIPS = [
    "5.6.8",
    "7.6.16 7.6",
    "(3.6 5.5).4",
    "-.6.8 5.6{h} 7.6",
    "0.1.8{tu 3} 2.1.8{tu 3} 3.1.8{tu 3}",
    "9.6.4{d}",
    // a tap alone, and beside another note of its beat, and a clip with none that takes a tap out where it lands
    "7.6{lht}.4",
    "(7.6 5.4{lht}).8 r",
    "r.4",
  ].map(clip);
  const BAR_CLIPS = ["9.6.4 r r r |", "3.6.8 r r r r r r r | 5.5.2 r |", "7.6{lht}.4 r r r |"].map(clip);

  const length = (c: ParsedClip): Fraction => c.lengthsByBar[0].reduce(add, ZERO);

  it("overwriting beats: the other bars, the beats before the caret and those after the covered time", () => {
    let acted = 0;
    for (const text of CORPUS) {
      const before = read(text);
      model(text).forEach((beats: any[], barIndex: number) =>
        beats.forEach((_, beatIndex) => {
          for (const c of CLIPS) {
            const out = pasteOverwrite(text, caret(barIndex, beatIndex), c);
            if (out.kind !== "ok") continue;
            acted++;
            const after = read(out.result.text);
            after.forEach((bar, i) => i !== barIndex && expect(bar).toEqual(before[i]));
            expect(after[barIndex].slice(0, beatIndex)).toEqual(before[barIndex].slice(0, beatIndex));
            let time = ZERO;
            const untouched = beats.filter((b, i) => {
              if (i < beatIndex) return false;
              const starts = time;
              time = add(time, beatLength(b));
              return cmp(starts, length(c)) >= 0;
            }).length;
            expect(after[barIndex].slice(after[barIndex].length - untouched)).toEqual(before[barIndex].slice(before[barIndex].length - untouched));
          }
        }),
      );
    }
    expect(acted).toBeGreaterThan(50);
  });

  it("whole bars, over and in front: every bar outside them", () => {
    let acted = 0;
    for (const text of CORPUS) {
      const before = read(text);
      before.forEach((_, barIndex) => {
        for (const c of BAR_CLIPS) {
          const replaced = pasteOverwrite(text, caret(barIndex, 0), c);
          if (replaced.kind === "ok") {
            acted++;
            const after = read(replaced.result.text);
            const end = barIndex + c.bars;
            expect(after.slice(0, barIndex)).toEqual(before.slice(0, barIndex));
            expect(after.slice(end)).toEqual(before.slice(end));
          }
          const inserted = pasteInsert(text, caret(barIndex, 0), c);
          if (inserted.kind === "ok") {
            acted++;
            const after = read(inserted.result.text);
            expect(after.slice(0, barIndex)).toEqual(before.slice(0, barIndex));
            expect(after.slice(barIndex + c.bars)).toEqual(before.slice(barIndex));
          }
        }
      });
    }
    expect(acted).toBeGreaterThan(10);
  });

  it("inserting beats: everything else in order around them", () => {
    let acted = 0;
    for (const text of CORPUS) {
      const before = read(text);
      before.forEach((bar, barIndex) =>
        bar.forEach((_, beatIndex) => {
          for (const c of CLIPS) {
            const out = pasteInsert(text, caret(barIndex, beatIndex), c);
            if (out.kind !== "ok") continue;
            acted++;
            const after = read(out.result.text);
            after.forEach((b, i) => i !== barIndex && expect(b).toEqual(before[i]));
            const grown = after[barIndex];
            expect([...grown.slice(0, beatIndex), ...grown.slice(beatIndex + c.beats)]).toEqual(before[barIndex]);
          }
        }),
      );
    }
    expect(acted).toBeGreaterThan(50);
  });

  /** How many beats from `beatIndex` a clip pasted over them covers: those that start before it ends. */
  const covered = (beats: any[], beatIndex: number, c: ParsedClip): number => {
    let time = ZERO;
    return beats.slice(beatIndex).filter((b) => {
      const starts = time;
      time = add(time, beatLength(b));
      return cmp(starts, length(c)) < 0;
    }).length;
  };

  /**
   * After a paste that acted, a note bound inside the music written is bound
   * inside it, and a note outside it is bound to nothing or to the note it was
   * bound to before. `moved` says where each beat outside went (null: written
   * over), `written` which beats the paste wrote.
   */
  const keptBindings = (
    text: string,
    out: EditOutcome,
    moved: (barIndex: number, beatIndex: number) => number[] | null,
    written: (barIndex: number, beatIndex: number) => boolean,
  ): number => {
    if (out.kind !== "ok") return 0;
    // TabEditor anchors the selection on its last beat, and the caret is on its
    // first: between them they must make the selection the paste reported.
    expect(out.selection && rangeOf(out.selection.to, out.result.caret), "the selection TabEditor draws").toEqual(out.selection);
    const before = bindings(text);
    const was = new Map<string, string>();
    model(text).forEach((beats: any[], barIndex: number) =>
      beats.forEach((_: unknown, beatIndex: number) => {
        const now = moved(barIndex, beatIndex);
        if (now) was.set(now.join(":"), `${barIndex}:${beatIndex}`);
      }),
    );
    const now = (pos: string) => moved(...(pos.split(":").map(Number) as [number, number]))?.join(":");
    for (const [key, to] of bindings(out.result.text)) {
      const [pos, string, kind] = key.split("/");
      const [barIndex, beatIndex] = pos.split(":").map(Number);
      if (written(barIndex, beatIndex)) {
        expect(written(...(to.split(":").map(Number) as [number, number])), `${key} -> ${to} reaches out of the paste`).toBe(true);
      } else {
        const old = before.get(`${was.get(pos)}/${string}/${kind}`);
        expect(old && now(old), `${key} -> ${to}`).toBe(to);
      }
    }
    return 1;
  };

  it("binds no note outside the music it writes to anything new, and nothing across its edges", () => {
    let checked = 0;
    for (const text of CORPUS) {
      model(text).forEach((beats: any[], barIndex: number) => {
        beats.forEach((_, beatIndex) => {
          const here = (b: number, i: number) => b === barIndex && i >= beatIndex;
          for (const c of CLIPS) {
            const gone = covered(beats, beatIndex, c);
            const overwritten = pasteOverwrite(text, caret(barIndex, beatIndex), c);
            const grown = overwritten.kind === "ok" ? model(overwritten.result.text)[barIndex].length - beats.length : 0;
            checked += keptBindings(
              text,
              overwritten,
              (b, i) => (!here(b, i) ? [b, i] : i < beatIndex + gone ? null : [b, i + grown]),
              (b, i) => here(b, i) && i < beatIndex + gone + grown,
            );
            checked += keptBindings(
              text,
              pasteInsert(text, caret(barIndex, beatIndex), c),
              (b, i) => (here(b, i) ? [b, i + c.beats] : [b, i]),
              (b, i) => here(b, i) && i < beatIndex + c.beats,
            );
          }
        });
        const pasted = (c: ParsedClip) => (b: number) => b >= barIndex && b < barIndex + c.bars;
        for (const c of BAR_CLIPS) {
          checked += keptBindings(text, pasteOverwrite(text, caret(barIndex, 0), c), (b, i) => (pasted(c)(b) ? null : [b, i]), pasted(c));
          checked += keptBindings(text, pasteInsert(text, caret(barIndex, 0), c), (b, i) => [b < barIndex ? b : b + c.bars, i], pasted(c));
        }
      });
    }
    expect(checked).toBeGreaterThan(300);
  });
});
