import { describe, it, expect } from "vitest";
import { fixBar, fixAllBars } from "./fixBar";
import { barState } from "../barFill";
import { parseTex } from "../parse";
import type { EditOutcome } from "../apply";

const tex = (body: string, head = "") => `\\tempo 120\n${head}.\n${body}\n`;
const at = (barIndex: number, beatIndex: number, string = 6) => ({ barIndex, beatIndex, string });
// The body is the document's last line, whatever the header takes.
const body = (outcome: EditOutcome) => {
  if (outcome.kind !== "ok") throw new Error(`expected ok, got ${JSON.stringify(outcome)}`);
  return outcome.result.text.trimEnd().split("\n").pop()!;
};
const fixed = (b: string, barIndex = 0) => body(fixBar(tex(b), at(barIndex, 0)));
const exact = (b: string, barIndex = 0) => barState(parseTex(tex(b)).score, barIndex).kind === "exact";

describe("fixBar on a short bar", () => {
  it("pads with the bar's own value when every beat shares one, written bare", () => {
    const out = fixBar(tex("3.6.8 5.6 7.6 8.6"), at(0, 0));
    expect(body(out)).toBe("3.6.8 5.6 7.6 8.6 r r r r");
    expect(out.kind === "ok" && out.report).toEqual({ barIndex: 0, removedBeats: 0, shortenedLast: false, addedRests: 4 });
  });

  it("otherwise pads with plain values, longest first from the beat unit", () => {
    expect(fixed("3.6.2 5.6.8")).toBe("3.6.2 5.6.8 r.4 r.8");
  });

  it("takes the beat unit from the time signature: eighths in 6/8, never a quarter", () => {
    const out = fixBar(tex("3.6.4 5.6.8 7.6.8", "\\ts 6 8\n"), at(0, 0));
    expect(body(out)).toBe("3.6.4 5.6.8 7.6.8 r r");
  });

  it("completes an unfinished triplet with explicit tuplet rests first", () => {
    expect(fixed("3.6.4 5.6 7.6 9.6.8{tu 3}")).toBe("3.6.4 5.6 7.6 9.6.8{tu 3} r.8{tu 3} r.8{tu 3}");
  });

  it("completes a quarter-note triplet with rests of the triplet's own value", () => {
    expect(fixed("3.6.2 5.6.4{tu 3}")).toBe("3.6.2 5.6.4{tu 3} r.4{tu 3} r.4{tu 3}");
  });

  it("looks past a grace note for the bar's own value, and for the triplet it ends in", () => {
    // alphaTab gives the grace beat an 8th of its own; it takes no time and decides nothing
    const out = fixBar(tex("3.6.16 5.6{gr} 7.6 8.6", "\\ts 2 4\n"), at(0, 0));
    expect(body(out)).toBe("3.6.16 5.6{gr} 7.6 8.6 r r r r r");
    expect(fixed("3.6.4 5.6 7.6 9.6.8{tu 3} 10.6{gr}")).toBe("3.6.4 5.6 7.6 9.6.8{tu 3} 10.6{gr} r.8{tu 3} r.8{tu 3}");
  });

  it("keeps the next bar's first beat at its duration", () => {
    expect(fixed("3.6.4 5.6.8 7.6.4 | 8.6 r r r")).toBe("3.6.4 5.6.8 7.6.4 r r.8 | 8.6.4 r r r");
  });
});

// The padding rests sit between the bar's last beat and the next bar. Left
// alone, a tie on the next bar's first note would hold the last note through
// them, and a hammer-on or slide on the last note would reach across them, as
// alphaTab binds both straight over a rest. They are unbound as a cut does.
describe("fixBar on a short bar unbinds what would cross the new rests", () => {
  /** The ties, hammer-ons and slides alphaTab binds, as "kind origin→destination" (bar:beat). */
  const bindings = (text: string) => {
    const out: string[] = [];
    const where = (note: { beat: { index: number; voice: { bar: { index: number } } } }) =>
      `${note.beat.voice.bar.index}:${note.beat.index}`;
    for (const bar of parseTex(text).score.tracks[0].staves[0].bars) {
      for (const beat of bar.voices[0].beats) {
        for (const note of beat.notes) {
          if (note.isTieDestination && note.tieOrigin) out.push(`tie ${where(note.tieOrigin)}→${where(note)}`);
          if (note.hammerPullDestination) out.push(`h ${where(note)}→${where(note.hammerPullDestination)}`);
          if (note.slideTarget) out.push(`sl ${where(note)}→${where(note.slideTarget)}`);
        }
      }
    }
    return out;
  };

  it("turns a tie on the next bar's first note into the fret it sounded", () => {
    const out = fixBar(tex("3.6.4 5.6 7.6.8 | -.6.4 5.6 7.6 8.6"), at(0, 0));
    expect(body(out)).toBe("3.6.4 5.6 7.6.8 r.4 r.8 | 7.6.4 5.6 7.6 8.6");
    expect(bindings((out as { result: { text: string } }).result.text)).toEqual([]);
  });

  it("removes a hammer-on or a slide on the last note", () => {
    expect(fixed("3.6.4 5.6 7.6{h}.8 | 9.6.4 5.6 7.6 8.6")).toBe("3.6.4 5.6 7.6.8 r.4 r.8 | 9.6.4 5.6 7.6 8.6");
    expect(fixed("3.6.4 5.6 7.6{sl}.8 | 9.6.4 5.6 7.6 8.6")).toBe("3.6.4 5.6 7.6.8 r.4 r.8 | 9.6.4 5.6 7.6 8.6");
  });

  it("before the fix, all three bound across where the rests go", () => {
    expect(bindings(tex("3.6.4 5.6 7.6.8 | -.6.4 5.6 7.6 8.6"))).toEqual(["tie 0:2→1:0"]);
    expect(bindings(tex("3.6.4 5.6 7.6{h}.8 | 9.6.4 5.6 7.6 8.6"))).toEqual(["h 0:2→1:0"]);
    expect(bindings(tex("3.6.4 5.6 7.6{sl}.8 | 9.6.4 5.6 7.6 8.6"))).toEqual(["sl 0:2→1:0"]);
  });

  it("unbinds every string of a last chord, and keeps the chord's other effects", () => {
    expect(fixed("3.6.4 5.6 (7.6{h pm} 5.5).8 | (-.6 -.5).4 r r r")).toBe(
      "3.6.4 5.6 (7.6{pm} 5.5).8 r.4 r.8 | (7.6 5.5).4 r r r",
    );
  });

  it("only pads after a last beat that is a rest: it has no notes to unbind", () => {
    expect(fixed("3.6.4 5.6 7.6 r.8 | 9.6.4 r r r")).toBe("3.6.4 5.6 7.6 r.8 r | 9.6.4 r r r");
  });

  it("refuses when a beat it cannot read stands between the last note and the tie after it", () => {
    expect(fixBar(tex("3.6.4 5.6 7.6.8 | x.6.4 -.6 r r"), at(0, 0))).toEqual({ kind: "refused", barIndex: 0 });
  });
});

describe("fixBar on a bar whose bar line is written straight after its last beat", () => {
  it("pads a short one, and the bar line stays", () => {
    expect(fixed("3.6.4 5.6 7.6|9.6.4 5.6 7.6 8.6")).toBe("3.6.4 5.6 7.6 r|9.6.4 5.6 7.6 8.6");
  });

  it("cuts a long one, and the bar line stays", () => {
    expect(fixed("3.6.4 5.6 7.6 8.6 9.6|9.6.4 5.6 7.6 8.6")).toBe("3.6.4 5.6 7.6 8.6|9.6.4 5.6 7.6 8.6");
  });
});

describe("fixBar on a short bar no rest can complete", () => {
  // A triplet group elsewhere in the bar (the bar does not end in it) is refused, not guessed at.
  // 1/12 + 1/8 + 1/8 leaves 2/3, and plain rests from a quarter down cannot make 2/3 exactly.
  const TRIPLET_AMONG_PLAIN = "3.6.8{tu 3} 5.6 7.6 | 7.6.4 r.4";

  it("refuses a lone triplet among plain beats", () => {
    expect(fixBar(tex(TRIPLET_AMONG_PLAIN), at(0, 0))).toEqual({ kind: "refused", barIndex: 0 });
  });

  it("refuses an unfinished triplet that is not the bar's last beat", () => {
    expect(fixBar(tex("3.6.8{tu 3} 5.6.8{tu 3} 7.6.4 8.6.4"), at(0, 0))).toEqual({ kind: "refused", barIndex: 0 });
  });

  it("leaves that bar's text as it was in Fix all, and fixes the bars it can", () => {
    const { result, fixed: count, skipped } = fixAllBars(tex(TRIPLET_AMONG_PLAIN), at(0, 0));
    expect({ count, skipped }).toEqual({ count: 1, skipped: 1 });
    expect(result!.text.split("\n")[2]).toBe("3.6.8{tu 3} 5.6 7.6 | 7.6.4 r.4 r r");
  });

  it("commits nothing in Fix all when that is the only broken bar", () => {
    expect(fixAllBars(tex("3.6.8{tu 3} 5.6 7.6"), at(0, 0))).toEqual({ result: null, fixed: 0, skipped: 1 });
  });
});

describe("fixBar on a long bar", () => {
  it("removes whole beats from the end while each fits in the excess", () => {
    const out = fixBar(tex("3.6.4 5.6 7.6 8.6 9.6 10.6"), at(0, 0));
    expect(body(out)).toBe("3.6.4 5.6 7.6 8.6");
    expect(out.kind === "ok" && out.report).toEqual({ barIndex: 0, removedBeats: 2, shortenedLast: false, addedRests: 0 });
  });

  it("then shortens the last beat left, rewriting its markers to match", () => {
    const out = fixBar(tex("3.6.2 5.6.2{d}"), at(0, 0));
    expect(body(out)).toBe("3.6.2 5.6.2");
    expect(out.kind === "ok" && out.report).toEqual({ barIndex: 0, removedBeats: 0, shortenedLast: "note", addedRests: 0 });
  });

  it("removes beats and then shortens the one left, and reports both", () => {
    const out = fixBar(tex("3.6.2 5.6.4 7.6.8 8.6.4 9.6.4"), at(0, 0));
    expect(body(out)).toBe("3.6.2 5.6.4 7.6.8 8.6.8");
    expect(out.kind === "ok" && out.report).toEqual({ barIndex: 0, removedBeats: 1, shortenedLast: "note", addedRests: 0 });
  });

  it("keeps the other effects of the beat it shortens", () => {
    expect(fixed("3.6.2 5.6.2{d f}")).toBe("3.6.2 5.6.2{f}");
  });

  it("rewrites a dot that sat on a duration-less note instead of leaving it behind", () => {
    expect(fixed("3.6.2 5.6{d}")).toBe("3.6.2 5.6.2");
  });

  it("shortens a lone beat rather than removing it", () => {
    expect(fixed("3.6.1{d}")).toBe("3.6.1");
  });

  it("lands on a dotted value when the length is exactly one", () => {
    expect(fixed("3.6.4 5.6.4 8.6.8 7.6.2")).toBe("3.6.4 5.6.4 8.6.8 7.6.4{d}");
  });

  it("lands on a double-dotted value when the length is exactly one", () => {
    expect(fixed("3.6.2 5.6.16 7.6.2")).toBe("3.6.2 5.6.16 7.6.4{dd}");
  });

  it("keeps a triplet a triplet when its own tuplet can say the length", () => {
    expect(fixed("3.6.2{d} 5.6.4{tu 3} 7.6.4{tu 3}")).toBe("3.6.2{d} 5.6.4{tu 3} 7.6.8{tu 3}");
  });

  it("keeps a sextuplet a sextuplet, though a triplet could say the length too", () => {
    // 1/4 time: an 8th, a triplet 8th, a triplet 32nd and a sextuplet 16th, which is a 48th too long
    const out = fixBar(tex("r.8 r.8{tu 3} r.32{tu 3} 9.6.16{tu 6}", "\\ts 1 4\n"), at(0, 0));
    expect(body(out)).toBe("r.8 r.8{tu 3} r.32{tu 3} 9.6.32{tu 6}");
  });

  it("shortens a rest the same way, and reports it as a rest", () => {
    const out = fixBar(tex("3.6.4 5.6 7.6 r.2"), at(0, 0));
    expect(body(out)).toBe("3.6.4 5.6 7.6 r.4");
    expect(out.kind === "ok" && out.report).toEqual({ barIndex: 0, removedBeats: 0, shortenedLast: "rest", addedRests: 0 });
  });

  it("gives the longest plain value that fits, and rests for the remainder", () => {
    const out = fixBar(tex("3.6.4 5.6.8 7.6.16 9.6.2{d}"), at(0, 0));
    expect(body(out)).toBe("3.6.4 5.6.8 7.6.16 9.6.2 r.16");
    expect(out.kind === "ok" && out.report).toEqual({ barIndex: 0, removedBeats: 0, shortenedLast: "note", addedRests: 1 });
  });

  it("writes the rests after a shortened note at their own value, not the note's", () => {
    // 5/4: a double-dotted whole is a half too long; a whole fits, and the quarter left over is `r.4`,
    // which would be a whole rest if written bare after a note that sets a whole
    const out = fixBar(tex("3.6.1{dd}", "\\ts 5 4\n"), at(0, 0));
    expect(body(out)).toBe("3.6.1 r.4");
  });

  it("removes a hammer-on that pointed into a removed beat", () => {
    expect(fixed("3.6.4 5.6 7.6 8.6{h} 9.6 | 10.6 r r r")).toBe("3.6.4 5.6 7.6 8.6 | 10.6 r r r");
  });

  it("turns a tie on a removed note into the fret it was tied to", () => {
    expect(fixed("3.6.4 5.6 7.6 8.6 9.6 | -.6 r r r")).toBe("3.6.4 5.6 7.6 8.6 | 9.6 r r r");
  });

  it("removes the shortened note's own hammer-on once rests follow it", () => {
    expect(fixed("3.6.4 5.6.8 7.6.16 9.6{h}.2{d} | 11.6.4 r r r")).toBe("3.6.4 5.6.8 7.6.16 9.6.2 r.16 | 11.6.4 r r r");
  });

  it("keeps the shortened note's own hammer-on when no rests follow it", () => {
    expect(fixed("3.6.2 5.6{h}.2{d} | 7.6.4 r r r")).toBe("3.6.2 5.6{h}.2 | 7.6.4 r r r");
  });

  it("keeps the next bar's first beat at its duration after a cut too", () => {
    // the 16th that went was what the next bar's first beat inherited
    expect(fixed("3.6.2 5.6.4 7.6.8 9.6.8 11.6.16 | 10.6 r r r")).toBe("3.6.2 5.6.4 7.6.8 9.6.8 | 10.6.16 r r r");
  });

  it("refuses a cut whose remainder no rests can express, here inside a triplet, rather than report a fix", () => {
    // 5/96 is left of the last triplet 8th. The longest plain value that fits is a 32nd (3/96);
    // the 1/48 after it is a 64th and a sliver, which no rests add up to, so the fix is refused
    // before anything is written
    expect(fixBar(tex("3.6.2 5.6.4 r.32 7.6.8{tu 3} 9.6.8{tu 3} 10.6.8{tu 3}"), at(0, 0))).toEqual({
      kind: "refused",
      barIndex: 0,
    });
  });

  it("clamps the caret to the bar's last beat, on its string", () => {
    const out = fixBar(tex("3.6.4 5.6 7.6 8.6 9.6 10.6"), at(0, 5, 3));
    expect(out.kind === "ok" && out.result.caret).toEqual(at(0, 3, 3));
  });
});

describe("fixBar results add up", () => {
  it.each([
    "3.6.8 5.6 7.6 8.6", "3.6.2 5.6.8", "3.6.4 5.6 7.6 9.6.8{tu 3}", "3.6.4 5.6 7.6 8.6 9.6 10.6",
    "3.6.2 5.6.2{d}", "3.6.4 5.6.4 8.6.8 7.6.2", "3.6.4 5.6.8 7.6.16 9.6.2{d}",
  ])("%s", (b) => {
    expect(exact(fixed(b))).toBe(true);
  });
});

describe("fixBar on a bar that adds up", () => {
  it("says so for an exact bar", () => {
    expect(fixBar(tex("3.6.4 5.6 7.6 8.6"), at(0, 0))).toEqual({ kind: "noop", reason: "exact" });
  });

  it("says so for a pickup bar", () => {
    expect(fixBar(tex("\\ac 3.6.4 | 3.6.4 5.6 7.6 8.6"), at(0, 0))).toEqual({ kind: "noop", reason: "exempt" });
  });
});

describe("fixBar refusals", () => {
  it("refuses a bar it cannot read", () => {
    expect(fixBar(tex("x.6.4 5.6"), at(0, 0))).toEqual({ kind: "refused", barIndex: 0 });
    expect(fixBar(tex("3.6.8*4 r.4"), at(0, 0))).toEqual({ kind: "refused", barIndex: 0 });
  });

  it("refuses a document that does not parse, and a bar that is not there", () => {
    expect(fixBar(tex("((("), at(0, 0))).toEqual({ kind: "refused", barIndex: 0 });
    expect(fixBar(tex("3.6.4"), at(4, 0))).toEqual({ kind: "refused", barIndex: 4 });
    expect(fixBar(tex("3.6.4"), at(-1, 0))).toEqual({ kind: "refused", barIndex: -1 });
  });

  it("names the bar it was asked to fix, not the next bar whose first beat could not be re-pinned", () => {
    // Padding bar 0 leaves bar 1's first beat inheriting an 8th instead of a quarter, and it is a dead
    // note the commands cannot read: that beat cannot be pinned, so the fix is refused
    expect(fixBar(tex("3.6.4 5.6.8 7.6.4 | x.5 r r r"), at(0, 0))).toEqual({ kind: "refused", barIndex: 0 });
    // the same bar with a beat that can be pinned is fixed
    expect(fixed("3.6.4 5.6.8 7.6.4 | (5.6 7.5) r r r")).toBe("3.6.4 5.6.8 7.6.4 r r.8 | (5.6 7.5).4 r r r");
  });

  it("pins a chord name the commands cannot read without touching it: no marker has to be lifted", () => {
    expect(fixed("3.6.4 5.6.8 7.6.4 | (5.6 7.5){ch Am} r r r")).toBe("3.6.4 5.6.8 7.6.4 r r.8 | (5.6 7.5).4{ch Am} r r r");
  });

  it("skips such a bar in Fix all, and counts it", () => {
    expect(fixAllBars(tex("3.6.4 5.6.8 7.6.4 | x.5 r r r"), at(0, 0))).toEqual({
      result: null,
      fixed: 0,
      skipped: 1,
    });
  });
});

describe("fixBar will not leave a tie or hammer-on bound across a cut it cannot see past", () => {
  // The cleanup walks on from the bar to the first note on each cut string; a beat the commands
  // cannot read might be that note, so the fix is refused rather than guessed.
  it("refuses when an unreadable beat after the bar stands between a removed note and the tie after it", () => {
    expect(fixBar(tex("3.6.4 5.6 7.6 8.6 9.6 | x.6.4 -.6 r r"), at(0, 0))).toEqual({ kind: "refused", barIndex: 0 });
  });

  it("refuses when an unreadable beat before the bar stands between a removed note and the note it follows", () => {
    expect(fixBar(tex("x.2.4 r r r | 3.6.4 5.6 7.6 8.6 9.1"), at(1, 0))).toEqual({ kind: "refused", barIndex: 1 });
  });

  it("refuses the same way when the shortened note's own notes are cut off by rests", () => {
    expect(fixBar(tex("3.6.4 5.6.8 7.6.16 9.6{h}.2{d} | x.6.4 r r r"), at(0, 0))).toEqual({ kind: "refused", barIndex: 0 });
  });

  it("refuses when a marked tie, which alphaTab sounds as another note, is the note after the cut", () => {
    expect(fixBar(tex("3.6.4 5.6 7.6 8.6 9.6 | 10.6{t} r r r"), at(0, 0))).toEqual({ kind: "refused", barIndex: 0 });
  });

  it("refuses in Fix all too: the bar is skipped and counted, nothing is committed", () => {
    expect(fixAllBars(tex("3.6.4 5.6 7.6 8.6 9.6 | x.6.4 -.6 r r"), at(0, 0))).toEqual({
      result: null,
      fixed: 0,
      skipped: 1,
    });
  });

  it("does not refuse over an unreadable beat when no note is cut off, so nothing needs unbinding", () => {
    expect(fixed("3.6.2 5.6.2{d} | x.6.4 5.6")).toBe("3.6.2 5.6.2 | x.6.4 5.6");
  });
});

describe("fixAllBars", () => {
  // The unreadable bar sits last: a pad or a cut straight before an unreadable beat is refused, since
  // the tie cleanup would have to walk into it.
  const DOC = tex("3.6.4 5.6 | 3.6.4 5.6 7.6 8.6 9.6 | 3.6.4 5.6 7.6 8.6 | x.6.4 5.6");

  it("fixes every bar it can in one commit, and counts the ones it skips", () => {
    const { result, fixed: count, skipped } = fixAllBars(DOC, at(1, 1));
    expect({ count, skipped }).toEqual({ count: 2, skipped: 1 });
    expect(result!.text.split("\n")[2]).toBe("3.6.4 5.6 r r | 3.6.4 5.6 7.6 8.6 | 3.6.4 5.6 7.6 8.6 | x.6.4 5.6");
    expect(result!.caret).toEqual(at(1, 1));
  });

  it("skips a short bar straight before a beat it cannot read, as it does a long one", () => {
    expect(fixAllBars(tex("3.6.4 5.6 | x.6.4 5.6 | 3.6.4 5.6 7.6 8.6 9.6 | 3.6.4 5.6 7.6 8.6"), at(0, 0))).toMatchObject({
      fixed: 1,
      skipped: 2,
    });
  });

  it("re-reads the text after each fix: a bar fixed re-pins the next bar's first beat, which is fixed in turn", () => {
    const { result, fixed: count, skipped } = fixAllBars(tex("3.6.4 5.6.8 7.6.4 | 8.6 r r r r | 9.6.4 5.6 7.6 8.6"), at(0, 0));
    expect({ count, skipped }).toEqual({ count: 2, skipped: 0 });
    expect(result!.text.split("\n")[2]).toBe("3.6.4 5.6.8 7.6.4 r r.8 | 8.6.4 r r r | 9.6.4 5.6 7.6 8.6");
  });

  it("keeps the caret in its bar, clamped when its beat went, like Shift+B", () => {
    const { result } = fixAllBars(tex("3.6.4 5.6 7.6 8.6 9.6 | 3.6.4"), at(0, 4, 2));
    expect(result!.caret).toEqual(at(0, 3, 2));
  });

  it("does nothing when every bar adds up", () => {
    expect(fixAllBars(tex("3.6.4 5.6 7.6 8.6"), at(0, 0))).toEqual({ result: null, fixed: 0, skipped: 0 });
  });

  it("commits nothing when every broken bar is skipped", () => {
    expect(fixAllBars(tex("x.6.4 5.6"), at(0, 0))).toEqual({ result: null, fixed: 0, skipped: 1 });
  });

  it("does nothing to a document that does not parse", () => {
    expect(fixAllBars(tex("((("), at(0, 0))).toEqual({ result: null, fixed: 0, skipped: 0 });
  });
});
