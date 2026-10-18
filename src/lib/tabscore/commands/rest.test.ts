import { describe, it, expect } from "vitest";
import { makeRest, unbindStrings, type Gap } from "./rest";
import { clearNote } from "./setFret";
import { formatBeat } from "./beatText";
import type { EditSet } from "./barEdit";
import { parseTex } from "../parse";
import type { EditOutcome } from "../apply";

const tex = (body: string) => `\\tempo 120\n.\n${body}\n`;
const at = (barIndex: number, beatIndex: number, string = 6) => ({ barIndex, beatIndex, string });
/** The body line of an accepted outcome's text. */
const body = (outcome: EditOutcome) => {
  if (outcome.kind !== "ok") throw new Error(`expected ok, got ${JSON.stringify(outcome)}`);
  return outcome.result.text.split("\n")[2];
};
const lengths = (text: string) =>
  parseTex(text).score.tracks[0].staves[0].bars.map((bar: { voices: Array<{ beats: Array<Record<string, number>> }> }) =>
    bar.voices[0].beats.map((b) => `${b.duration}/${b.dots}/${b.tupletNumerator}`),
  );

describe("makeRest", () => {
  it("turns the beat into a rest of the same length, keeping its suffix", () => {
    expect(body(makeRest(tex("3.6.8 5.6 7.6 | 7.6.4 r.4"), at(0, 0)))).toBe("r.8 5.6 7.6 | 7.6.4 r.4");
  });

  it("removes every note of a chord", () => {
    expect(body(makeRest(tex("(3.6 5.5).4 r r r"), at(0, 0, 1)))).toBe("r.4 r r r");
  });

  it("keeps a dot that sat on a duration-less note, on the rest", () => {
    const text = tex("3.6.8 5.6{d} 7.6.4 r");
    const out = makeRest(text, at(0, 1));
    expect(body(out)).toBe("3.6.8 r{d} 7.6.4 r");
    expect(lengths((out as { result: { text: string } }).result.text)).toEqual(lengths(text));
  });

  it("keeps a tuplet marker: the rest stays in the group", () => {
    expect(body(makeRest(tex("3.6.8{tu 3} 5.6.8{tu 3} 7.6.8{tu 3} r.4 r.2"), at(0, 1)))).toBe(
      "3.6.8{tu 3} r.8{tu 3} 7.6.8{tu 3} r.4 r.2",
    );
  });

  it("keeps a grace marker, so the rest takes no time either", () => {
    expect(body(makeRest(tex("3.6.16{gr} 5.6.4 7.6 8.6 9.6"), at(0, 0)))).toBe("r.16{gr} 5.6.4 7.6 8.6 9.6");
  });

  it("turns a later tie on that string into the fret it was tied to", () => {
    // left alone, `-.6` would hold the 5 straight across the new rest
    expect(body(makeRest(tex("5.6.4 -.6 r r"), at(0, 0)))).toBe("r.4 5.6 r r");
    expect(body(makeRest(tex("3.6.4 5.6 7.6 8.6 | -.6.4 r r r"), at(0, 3)))).toBe("3.6.4 5.6 7.6 r | 8.6.4 r r r");
  });

  it("unbinds each string of a chord, and only those", () => {
    expect(body(makeRest(tex("(5.6 7.5).4 (-.6 -.5) r r"), at(0, 0)))).toBe("r.4 (5.6 7.5) r r");
    expect(body(makeRest(tex("5.6.4 -.5 7.5 -.5"), at(0, 0)))).toBe("r.4 -.5 7.5 -.5");
  });

  it("removes a hammer-on or slide on the previous note of that string", () => {
    // left alone, it would reach across the rest to the next note
    expect(body(makeRest(tex("3.6{h}.4 5.6 7.6 r"), at(0, 1)))).toBe("3.6.4 r 7.6 r");
    expect(body(makeRest(tex("3.6{pm sl}.4 5.6 7.6 r"), at(0, 1)))).toBe("3.6{pm}.4 r 7.6 r");
    expect(body(makeRest(tex("3.5{h}.4 5.6 7.5 r"), at(0, 1)))).toBe("3.5{h}.4 r 7.5 r");
  });

  it("removes a hammer-on or slide however its property is spelled: alphaTab ignores an empty argument list", () => {
    // `{h()}`, `{sl()}` and `{ss ()}` bind like `{h}`, `{sl}` and `{ss}`: left in place they would reach across the rest
    expect(body(makeRest(tex("3.6{h()}.4 5.6 7.6 r"), at(0, 1)))).toBe("3.6.4 r 7.6 r");
    expect(body(makeRest(tex("3.6{sl()}.4 5.6 7.6 r"), at(0, 1)))).toBe("3.6.4 r 7.6 r");
    expect(body(makeRest(tex("3.6{ss ()}.4 5.6 7.6 r"), at(0, 1)))).toBe("3.6.4 r 7.6 r");
    expect(body(makeRest(tex("3.6{pm h()}.4 5.6 7.6 r"), at(0, 1)))).toBe("3.6{pm}.4 r 7.6 r");
  });

  it("does nothing on a rest, and says why", () => {
    expect(makeRest(tex("3.6.4 r r r"), at(0, 1))).toEqual({ kind: "noop", reason: "alreadyRest" });
  });

  it("keeps the caret where it is", () => {
    const out = makeRest(tex("3.6.4 5.6 r r"), at(0, 1, 3));
    expect(out.kind === "ok" && out.result.caret).toEqual(at(0, 1, 3));
  });

  it("refuses a bar it cannot read, and a document that does not parse", () => {
    expect(makeRest(tex("x.6.4 5.6 r r"), at(0, 1))).toEqual({ kind: "refused", barIndex: 0 });
    expect(makeRest(tex("3.6.8*4 r.2"), at(0, 0))).toEqual({ kind: "refused", barIndex: 0 });
    expect(makeRest(tex("((("), at(0, 0))).toEqual({ kind: "refused", barIndex: 0 });
  });
});

// The walks that unbind ties and legato across the new rest never stop
// silently at a beat they cannot read — they refuse instead. A beat they cannot
// read might be the very note they are looking for.
describe("makeRest, when an unreadable beat is in the way", () => {
  it("refuses rather than leave a later tie to hold a note that is gone", () => {
    // The tie in bar 3 holds the 5. Its walk meets `x.1.4` first, so it cannot
    // be rewritten; unrefused, the tie would sound the open string.
    const text = tex("5.6.4 r r r | x.1.4 r r r | -.6.4 r r r");
    expect(makeRest(text, at(0, 0))).toEqual({ kind: "refused", barIndex: 0 });
  });

  it("refuses rather than leave an earlier hammer-on to reach across the rest", () => {
    // The walk back from the 5 meets `x.1.4` before it finds the 3's `{h}`,
    // which would otherwise bind to the 7.
    const text = tex("3.6{h}.4 r r r | x.1.4 r r r | 5.6.4 7.6 r r");
    expect(makeRest(text, at(2, 0))).toEqual({ kind: "refused", barIndex: 2 });
  });

  it("names the caret's bar, however far away the unreadable beat is", () => {
    const text = tex("5.6.4 r r r | r r r r | r r r r | x.1.4 r r r | -.6.4 r r r");
    expect(makeRest(text, at(0, 0))).toEqual({ kind: "refused", barIndex: 0 });
  });

  it("refuses when any one string of a chord is blocked", () => {
    // String 6 settles at once (the next beat plays it); string 5 is walked
    // second and meets `x.1.4`, so its tie in bar 3 cannot be rewritten.
    const text = tex("(5.6 7.5).4 3.6 r r | x.1.4 r r r | -.5.4 r r r");
    expect(makeRest(text, at(0, 0))).toEqual({ kind: "refused", barIndex: 0 });
  });

  it("does not refuse for an unreadable beat the walks never reach", () => {
    // Both walks settle on the 3 and the 7, before either `x.1.4`.
    const text = tex("x.1.4 r r r | 3.6{h}.4 5.6 7.6 r | x.1.4 r r r");
    expect(body(makeRest(text, at(1, 1)))).toBe("x.1.4 r r r | 3.6.4 r 7.6 r | x.1.4 r r r");
  });
});

// parseBeatText reads `3.6{t}` as a plain fret 3. alphaTab makes it a tie
// destination that sounds its origin's fret, so a walk that took it for a
// settled note would leave it tied to nothing, or to an older note.
describe("makeRest, when a tie is spelled as an effect ({t}, {-})", () => {
  it("refuses rather than let a later {t} or {-} tie sound a different note", () => {
    expect(makeRest(tex("5.6.4 r r r | 3.6{t}.4 r r r"), at(0, 0))).toEqual({ kind: "refused", barIndex: 0 });
    expect(makeRest(tex("5.6.4 r r r | 3.6{-}.4 r r r"), at(0, 0))).toEqual({ kind: "refused", barIndex: 0 });
  });

  it("refuses a tie however its property is spelled: alphaTab ignores case", () => {
    expect(makeRest(tex("5.6.4 r r r | 3.6{T}.4 r r r"), at(0, 0))).toEqual({ kind: "refused", barIndex: 0 });
    expect(makeRest(tex("5.6.4 r r r | 3.6{ t }.4 r r r"), at(0, 0))).toEqual({ kind: "refused", barIndex: 0 });
  });

  it("refuses even when the {t} carries its origin's fret: an older note would take the tie", () => {
    const text = tex("3.6.4 r r r | 5.6.4 r r r | 5.6{t}.4 r r r");
    expect(makeRest(text, at(1, 0))).toEqual({ kind: "refused", barIndex: 1 });
  });

  it("refuses rather than rewrite the effects of a note that is also a {-} tie", () => {
    // the walk back would strip the `h` and, with it, the `-`
    const text = tex("5.6.4 r r r | 3.6{- h}.4 r r r | 7.6.4 r r r");
    expect(makeRest(text, at(2, 0))).toEqual({ kind: "refused", barIndex: 2 });
  });

  it("is not stopped by a note that is a plain fret, nor by a tie on another string", () => {
    expect(body(makeRest(tex('3.6.4 r r r | 5.6.4{ch "Am"} r r r'), at(0, 0)))).toBe(
      'r.4 r r r | 5.6.4{ch "Am"} r r r',
    );
    expect(body(makeRest(tex("3.6.4 r r r | (5.6 3.5{t}).4 r r r"), at(0, 0)))).toBe(
      "r.4 r r r | (5.6 3.5{t}).4 r r r",
    );
  });

  it("Delete does nothing in the same situation, like `r`", () => {
    expect(clearNote(tex("5.6.4 3.6{t}.4 r r"), at(0, 0, 6))).toBeNull();
    expect(clearNote(tex("5.6.4 3.6{T}.4 r r"), at(0, 0, 6))).toBeNull();
  });
});

// alphaTab 1.8.1 binds a tie to its origin, and a hammer-on or slide to its
// target, only within three bars (Note._maxOffsetForSameLineSearch). The walks
// look no further: what lies beyond cannot bind across the new rest, so it
// neither needs rewriting nor can stop the command.
describe("makeRest looks only as far as alphaTab binds", () => {
  const BARS = "3.6.4 5.6 7.6 8.6 | 3.6.4 5.6 7.6 8.6 | 3.6.4 5.6 7.6 8.6 | 3.6.4 5.6 7.6 12.1";

  it("is not stopped by a beat it cannot read four bars back", () => {
    // the lone high-e note's walk back stops at bar 2, before the dead note in bar 1
    const text = tex(`x.6.4 3.6 5.6 7.6 | ${BARS}`);
    expect(body(makeRest(text, at(4, 3, 1)))).toBe(`x.6.4 3.6 5.6 7.6 | ${BARS.replace(/12\.1$/, "r")}`);
    expect(clearNote(text, at(4, 3, 1))!.text.split("\n")[2]).toBe(`x.6.4 3.6 5.6 7.6 | ${BARS.replace(/12\.1$/, "r")}`);
  });

  it("is not stopped by a beat it cannot read four bars on", () => {
    const text = tex("12.1.4 r r r | r r r r | r r r r | r r r r | x.1.4 r r r");
    expect(body(makeRest(text, at(0, 0, 1)))).toBe("r.4 r r r | r r r r | r r r r | r r r r | x.1.4 r r r");
  });

  it("rewrites a tie three bars on, which alphaTab binds to the note going", () => {
    expect(body(makeRest(tex("5.6.4 r r r | r r r r | r r r r | -.6.4 r r r"), at(0, 0)))).toBe(
      "r.4 r r r | r r r r | r r r r | 5.6.4 r r r",
    );
  });

  it("leaves a tie four bars on alone: alphaTab never bound it, and it sounds the open string either way", () => {
    expect(body(makeRest(tex("5.6.4 r r r | r r r r | r r r r | r r r r | -.6.4 r r r"), at(0, 0)))).toBe(
      "r.4 r r r | r r r r | r r r r | r r r r | -.6.4 r r r",
    );
  });

  it("leaves a hammer-on four bars back alone: it cannot reach across the new rest", () => {
    expect(body(makeRest(tex("3.6{h}.4 r r r | r r r r | r r r r | r r r r | 5.6.4 7.6 r r"), at(4, 0)))).toBe(
      "3.6{h}.4 r r r | r r r r | r r r r | r r r r | r.4 7.6 r r",
    );
  });
});

// Queue item: a tie whose walk back meets a note marked as a tie in its
// effects (`3.6{t}`) cannot name the fret it sounds — alphaTab sounds the
// marked note's origin, not the 3 written — so the cleanup refuses.
describe("the tie cleanup does not read a marked tie as a fret", () => {
  it("Delete on a marked tie leaves the later tie alone by refusing, rather than turn it into a 3", () => {
    expect(clearNote(tex("5.6.4 3.6{t}.4 -.6.4 r"), at(0, 1))).toBeNull();
  });

  it("r refuses the same way when the chain behind the note going passes a marked tie", () => {
    expect(makeRest(tex("5.6.4 3.6{t}.4 -.6.4 -.6.4"), at(0, 2))).toEqual({ kind: "refused", barIndex: 0 });
  });
});

// Queue item: the walk back strips a hammer-on or slide by rewriting the
// note's effect block token by token. A block tokensOf cannot read back as
// written would lose what it misreads — `{h PM}` would come out as nothing,
// palm mute and all — so the walk refuses instead.
describe("the legato cleanup does not rewrite an effect block it cannot read back", () => {
  it("refuses rather than turn `3.6{h PM}` into `3.6`", () => {
    expect(makeRest(tex("3.6{h PM}.4 r r r | 5.6.4 7.6 r r"), at(1, 0))).toEqual({ kind: "refused", barIndex: 1 });
  });

  it("refuses for a quoted text beside the slide too", () => {
    expect(makeRest(tex('3.6{sl txt "x"}.4 r r r | 5.6.4 7.6 r r'), at(1, 0))).toEqual({ kind: "refused", barIndex: 1 });
  });

  it("still strips the hammer-on from a block it reads back, keeping the rest of it", () => {
    expect(body(makeRest(tex("3.6{h pm}.4 r r r | 5.6.4 7.6 r r"), at(1, 0)))).toBe("3.6{pm}.4 r r r | r.4 7.6 r r");
  });

  it("does not refuse over such a block when there is no hammer-on or slide to strip", () => {
    expect(body(makeRest(tex("3.6{PM}.4 r r r | 5.6.4 7.6 r r"), at(1, 0)))).toBe("3.6{PM}.4 r r r | r.4 7.6 r r");
  });
});

// A selection edit silences or removes beats across several bars. The walks
// reach BINDING_REACH_BARS back from the gap's first bar and on from its last:
// a hammer-on before the first can bind only that far, a tie after the last
// can hold a note in the gap only from that far.
describe("unbindStrings, over a gap across several bars", () => {
  // Bars 2-5 fall silent. A hammer-on two bars before the first, a tie two bars after the last.
  const text = tex("3.6{h}.4 r r r | r r r r | 5.6.4 r r r | r r r r | r r r r | 7.6.4 r r r | r r r r | -.6.4 r r r");
  const { scoreNode } = parseTex(text);
  const before = { barIndex: 1, beatIndex: 3 };
  const after = { barIndex: 6, beatIndex: 0 };
  const unbind = (gap: Gap) => {
    const edits: EditSet = new Map();
    expect(unbindStrings(text, scoreNode, [6], gap, edits)).toBe(true);
    return Object.fromEntries([...edits].map(([key, edit]) => [key, formatBeat(edit.beat)]));
  };

  it("reaches back from its first bar and on from its last, whichever bar `bar` names", () => {
    expect(unbind({ bar: 2, firstBar: 2, lastBar: 5, before, after })).toEqual({ "0:0": "3.6.4", "7:0": "7.6.4" });
    expect(unbind({ bar: 5, firstBar: 2, lastBar: 5, before, after })).toEqual({ "0:0": "3.6.4", "7:0": "7.6.4" });
  });

  it("without them, reaches as far either way from its one bar, as it always has", () => {
    expect(unbind({ bar: 2, before, after })).toEqual({ "0:0": "3.6.4" });
    expect(unbind({ bar: 5, before, after })).toEqual({ "7:0": "7.6.4" });
  });
});

// A tie alphaTab binds to nothing sounds the open string. An edit that only
// silences notes leaves it so; one that brings an older note within its reach
// (bars removed) or writes notes before it (a paste) could bind it, so such an
// edit asks for it to be written as the open string it sounded.
describe("unbindStrings, for a tie alphaTab binds to nothing", () => {
  const text = tex("3.6.4 r r r | r r r r | r r r r | r r r r | -.6.4 r r r");
  const { scoreNode } = parseTex(text);
  const gap: Gap = { bar: 1, before: { barIndex: 0, beatIndex: 3 }, after: { barIndex: 2, beatIndex: 0 } };
  const unbind = (pinOrphanTies?: boolean) => {
    const edits: EditSet = new Map();
    expect(unbindStrings(text, scoreNode, [6], { ...gap, pinOrphanTies }, edits)).toBe(true);
    return Object.fromEntries([...edits].map(([key, edit]) => [key, formatBeat(edit.beat)]));
  };

  it("leaves it alone by default", () => {
    expect(unbind()).toEqual({});
  });

  it("writes it as the open string when asked", () => {
    expect(unbind(true)).toEqual({ "4:0": "0.6.4" });
  });
});
