import { describe, it, expect } from "vitest";
import {
  toggleRepeatStart,
  toggleRepeatEnd,
  readBarRepeat,
  clampRepeatCount,
  MIN_REPEAT_COUNT,
  MAX_REPEAT_COUNT,
} from "./repeat";
import { parseTex } from "../parse";

const TEX = "\\tempo 120\n.\n3.6.4 r.4 r.4 r.4 | 5.6.4 r.4 r.4 r.4 | 7.6.4 r.4 r.4 r.4\n";
const at = (barIndex: number, beatIndex: number, string = 6) => ({ barIndex, beatIndex, string });

function node(text: string) {
  const parsed = parseTex(text);
  expect(parsed.ok, text).toBe(true);
  return parsed.scoreNode;
}

/** What alphaTab ends up believing about each bar's repeats. */
function masterBars(text: string) {
  const parsed = parseTex(text);
  expect(parsed.ok).toBe(true);
  // parseTex's Score comes back from the untyped alphaTex interop boundary.
  return (parsed.score!.masterBars as { isRepeatStart: boolean; repeatCount: number }[]).map(
    (mb) => ({ open: mb.isRepeatStart, count: mb.repeatCount }),
  );
}

describe("clampRepeatCount", () => {
  it("keeps the count within what a repeat sign can mean", () => {
    expect(clampRepeatCount(1)).toBe(MIN_REPEAT_COUNT);
    expect(clampRepeatCount(99)).toBe(MAX_REPEAT_COUNT);
    expect(clampRepeatCount(3.4)).toBe(3);
  });
});

describe("toggleRepeatStart", () => {
  it("puts an opening sign on the caret's bar", () => {
    const next = toggleRepeatStart(TEX, at(1, 0), 1)!.text;
    expect(next).toContain("| \\ro 5.6.4");
    expect(masterBars(next)[1].open).toBe(true);
  });

  it("takes it off again", () => {
    const on = toggleRepeatStart(TEX, at(1, 0), 1)!.text;
    expect(toggleRepeatStart(on, at(1, 0), 1)!.text).toBe(TEX);
  });

  it("does not add a bar", () => {
    expect(masterBars(toggleRepeatStart(TEX, at(2, 0), 2)!.text).length).toBe(3);
  });

  it("leaves other bars' signs alone — a piece can have several sections", () => {
    const first = toggleRepeatStart(TEX, at(0, 0), 0)!.text;
    const second = toggleRepeatStart(first, at(2, 0), 2)!.text;
    expect(masterBars(second).map((b) => b.open)).toEqual([true, false, true]);
  });

  it("rejects a bar outside the document", () => {
    expect(toggleRepeatStart(TEX, at(0, 0), 9)).toBeNull();
    expect(toggleRepeatStart(TEX, at(0, 0), -1)).toBeNull();
  });

  it("leaves the document alone when it does not parse", () => {
    expect(toggleRepeatStart("\\tempo 120\n.\n(((\n", at(0, 0), 0)).toBeNull();
  });
});

describe("toggleRepeatEnd", () => {
  it("puts a closing sign with a count on the caret's bar", () => {
    const next = toggleRepeatEnd(TEX, at(1, 0), 1, 3)!.text;
    expect(next).toContain("| \\rc 3 5.6.4");
    expect(masterBars(next)[1].count).toBe(3);
  });

  it("takes it off when pressed again with the same count", () => {
    const on = toggleRepeatEnd(TEX, at(1, 0), 1, 3)!.text;
    expect(toggleRepeatEnd(on, at(1, 0), 1, 3)!.text).toBe(TEX);
  });

  it("rewrites the count rather than removing the sign", () => {
    // Otherwise going from x2 to x4 would take two presses and lose the
    // sign in between.
    const on = toggleRepeatEnd(TEX, at(1, 0), 1, 2)!.text;
    const changed = toggleRepeatEnd(on, at(1, 0), 1, 4)!.text;
    expect(changed.match(/\\rc/g)!.length).toBe(1);
    expect(masterBars(changed)[1].count).toBe(4);
  });

  it("clamps the count", () => {
    expect(toggleRepeatEnd(TEX, at(0, 0), 0, 1)!.text).toContain(`\\rc ${MIN_REPEAT_COUNT}`);
    expect(toggleRepeatEnd(TEX, at(0, 0), 0, 500)!.text).toContain(`\\rc ${MAX_REPEAT_COUNT}`);
  });

  it("does not add a bar — the trap of writing \\rc before the barline", () => {
    // `... \rc 2 |` parses as an extra empty bar carrying the repeat, which
    // is why the directive goes before the closing bar's first beat.
    expect(masterBars(toggleRepeatEnd(TEX, at(1, 0), 1, 2)!.text).length).toBe(3);
  });

  it("rejects a bar outside the document", () => {
    expect(toggleRepeatEnd(TEX, at(0, 0), 9, 2)).toBeNull();
  });

  it("leaves the document alone when it does not parse", () => {
    expect(toggleRepeatEnd("\\tempo 120\n.\n(((\n", at(0, 0), 0, 2)).toBeNull();
  });
});

describe("start and end together", () => {
  it("marks a section across bars the user never had to select", () => {
    // The whole point: put the caret in bar 1, press start; go to bar 3,
    // press end. Bar 2 is never touched.
    const opened = toggleRepeatStart(TEX, at(0, 0), 0)!.text;
    const closed = toggleRepeatEnd(opened, at(2, 0), 2, 2)!.text;
    expect(masterBars(closed)).toEqual([
      { open: true, count: 0 },
      { open: false, count: 0 },
      { open: false, count: 2 },
    ]);
  });

  it("puts both signs on one bar when it repeats alone", () => {
    const opened = toggleRepeatStart(TEX, at(1, 0), 1)!.text;
    const closed = toggleRepeatEnd(opened, at(1, 0), 1, 2)!.text;
    expect(masterBars(closed)[1]).toEqual({ open: true, count: 2 });
  });

  it("leaves the music and the caret alone", () => {
    const result = toggleRepeatEnd(TEX, at(2, 3, 4), 1, 2)!;
    expect(result.caret).toEqual(at(2, 3, 4));
    expect(result.text).toContain("7.6.4 r.4 r.4 r.4");
  });
});

describe("readBarRepeat", () => {
  it("reads nothing from a plain document", () => {
    expect(readBarRepeat(TEX, node(TEX), 0)).toEqual({ open: false, count: null });
  });

  it("reads back what the toggles wrote", () => {
    const opened = toggleRepeatStart(TEX, at(0, 0), 0)!.text;
    const closed = toggleRepeatEnd(opened, at(1, 0), 1, 3)!.text;
    expect(readBarRepeat(closed, node(closed), 0)).toEqual({ open: true, count: null });
    expect(readBarRepeat(closed, node(closed), 1)).toEqual({ open: false, count: 3 });
    expect(readBarRepeat(closed, node(closed), 2)).toEqual({ open: false, count: null });
  });
});
