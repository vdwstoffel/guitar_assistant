import { describe, it, expect } from "vitest";
import { ALREADY_REST_NOTICE, fixAllNotice, outcomeNotice, refusedNotice, stripMessage } from "./barMessages";
import { frac } from "./fraction";
import type { BrokenBar } from "./barFill";
import type { EditOutcome } from "./apply";

const RESULT = { text: "", caret: { barIndex: 4, beatIndex: 0, string: 6 } };
const ok = (removedBeats: number, shortenedLast: false | "note" | "rest", addedRests: number): EditOutcome => ({
  kind: "ok",
  result: RESULT,
  report: { barIndex: 4, removedBeats, shortenedLast, addedRests },
});
const long = (barIndex: number, n: number, d: number): BrokenBar => ({ barIndex, state: { kind: "long", amount: frac(n, d) } });
const short = (barIndex: number, n: number, d: number): BrokenBar => ({ barIndex, state: { kind: "short", amount: frac(n, d) } });

describe("outcomeNotice", () => {
  it("reports what a fix removed or shortened, with the way back", () => {
    expect(outcomeNotice(ok(2, false, 0), 4, "fixBar")).toBe("Removed 2 beats from bar 5 — Ctrl+Z to undo");
    expect(outcomeNotice(ok(1, false, 0), 4, "fixBar")).toBe("Removed 1 beat from bar 5 — Ctrl+Z to undo");
    expect(outcomeNotice(ok(0, "note", 1), 4, "fixBar")).toBe("Shortened the last note of bar 5 — Ctrl+Z to undo");
    expect(outcomeNotice(ok(2, "note", 0), 4, "fixBar")).toBe(
      "Removed 2 beats from bar 5 and shortened its last note — Ctrl+Z to undo",
    );
  });

  it("calls a shortened rest the last beat, not the last note", () => {
    expect(outcomeNotice(ok(0, "rest", 1), 4, "fixBar")).toBe("Shortened the last beat of bar 5 — Ctrl+Z to undo");
    expect(outcomeNotice(ok(2, "rest", 0), 4, "fixBar")).toBe(
      "Removed 2 beats from bar 5 and shortened its last beat — Ctrl+Z to undo",
    );
  });

  it("reports the rests padding added", () => {
    expect(outcomeNotice(ok(0, false, 3), 4, "fixBar")).toBe("Added 3 rests to bar 5 — Ctrl+Z to undo");
    expect(outcomeNotice(ok(0, false, 1), 4, "fixBar")).toBe("Added 1 rest to bar 5 — Ctrl+Z to undo");
  });

  it("says nothing for a rest made", () => {
    expect(outcomeNotice({ kind: "ok", result: RESULT }, 4, "makeRest")).toBeNull();
  });

  it("explains a no-op", () => {
    expect(outcomeNotice({ kind: "noop", reason: "alreadyRest" }, 4, "makeRest")).toBe(ALREADY_REST_NOTICE);
    expect(ALREADY_REST_NOTICE).toBe("Already a rest — type a fret to add a note");
    expect(outcomeNotice({ kind: "noop", reason: "exact" }, 4, "fixBar")).toBe("Bar 5 already adds up");
    expect(outcomeNotice({ kind: "noop", reason: "exempt" }, 4, "fixBar")).toBe("Bar 5 already adds up");
  });

  it("explains a refusal: Shift+B could not fix the bar, r could not change it", () => {
    expect(outcomeNotice({ kind: "refused", barIndex: 4 }, 4, "fixBar")).toBe(
      "Can't fix bar 5 automatically — edit it in the source",
    );
    expect(outcomeNotice({ kind: "refused", barIndex: 4 }, 4, "makeRest")).toBe(
      "Can't change bar 5 automatically — edit it in the source",
    );
    expect(refusedNotice(4, "fix")).toBe("Can't fix bar 5 automatically — edit it in the source");
    expect(refusedNotice(4, "change")).toBe("Can't change bar 5 automatically — edit it in the source");
  });

  it("names the bar the refusal names, not the caret's", () => {
    expect(outcomeNotice({ kind: "refused", barIndex: 2 }, 4, "fixBar")).toBe(
      "Can't fix bar 3 automatically — edit it in the source",
    );
  });
});

describe("fixAllNotice", () => {
  it("counts what it fixed and what it skipped", () => {
    expect(fixAllNotice(3, 1)).toBe("Fixed 3 bars; 1 skipped — edit it in the source");
    expect(fixAllNotice(3, 2)).toBe("Fixed 3 bars; 2 skipped — edit them in the source");
    expect(fixAllNotice(1, 0)).toBe("Fixed 1 bar — Ctrl+Z to undo");
    expect(fixAllNotice(0, 2)).toBe("Couldn't fix 2 bars automatically — edit them in the source");
    expect(fixAllNotice(0, 0)).toBeNull();
  });
});

describe("stripMessage", () => {
  it("explains the caret's bar and offers Shift+B", () => {
    expect(stripMessage(4, [long(4, 1, 16)])).toEqual({
      text: "Bar 5 is a 16th too long — Shift+B fixes it",
      fixAll: false,
    });
    expect(stripMessage(4, [short(4, 1, 4)])).toEqual({
      text: "Bar 5 is short by a quarter — Shift+B fills it with rests",
      fixAll: false,
    });
  });

  it("says amounts as one value or as a sum", () => {
    expect(stripMessage(0, [long(0, 3, 16)])!.text).toBe("Bar 1 is a dotted 8th too long — Shift+B fixes it");
    expect(stripMessage(0, [short(0, 5, 16)])!.text).toBe(
      "Bar 1 is short by a quarter and a 16th — Shift+B fills it with rests",
    );
  });

  it("leaves out an amount it cannot say", () => {
    expect(stripMessage(0, [short(0, 5, 48)])!.text).toBe("Bar 1 is short — Shift+B fills it with rests");
    expect(stripMessage(0, [long(0, 5, 48)])!.text).toBe("Bar 1 is too long — Shift+B fixes it");
  });

  it("adds the other broken bars and Fix all", () => {
    expect(stripMessage(4, [long(4, 1, 16), short(8, 1, 4), short(11, 1, 8)])).toEqual({
      text: "Bar 5 is a 16th too long — Shift+B fixes it · 2 more bars don't add up",
      fixAll: true,
    });
    expect(stripMessage(4, [long(4, 1, 16), short(8, 1, 4)])!.text).toBe(
      "Bar 5 is a 16th too long — Shift+B fixes it · 1 more bar doesn't add up",
    );
  });

  it("lists the broken bars when the caret is elsewhere", () => {
    expect(stripMessage(0, [long(4, 1, 16), short(8, 1, 4), short(11, 1, 8)])).toEqual({
      text: "Bars 5, 9 and 12 don't add up",
      fixAll: true,
    });
    expect(stripMessage(0, [short(4, 1, 4)])).toEqual({ text: "Bar 5 doesn't add up", fixAll: true });
  });

  it("names at most five bars, then how many more", () => {
    const five = [1, 2, 3, 4, 5].map((i) => short(i, 1, 4));
    expect(stripMessage(0, five)!.text).toBe("Bars 2, 3, 4, 5 and 6 don't add up");
    const eight = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => short(i, 1, 4));
    expect(stripMessage(0, eight)!.text).toBe("Bars 2, 3, 4, 5, 6 and 3 more don't add up");
  });

  it("is null when every bar adds up", () => {
    expect(stripMessage(0, [])).toBeNull();
  });
});
