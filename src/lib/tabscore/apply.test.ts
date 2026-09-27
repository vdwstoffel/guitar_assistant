import { describe, it, expect } from "vitest";
import { commitEdit } from "./apply";

const CARET = { barIndex: 0, beatIndex: 0, string: 6 };

describe("commitEdit", () => {
  it("accepts an edit that parses and preserves structure", () => {
    const next = "\\tempo 120\n.\n9.6.8 5.6 7.6 | 7.6.4 r.4\n";
    const r = commitEdit(next, CARET, { bars: 2, beats: 5 });
    expect(r).not.toBeNull();
    expect(r!.text).toBe(next);
  });

  it("REJECTS an edit that parses cleanly but drifted the BEAT count", () => {
    // A duplicated beat. Valid AlphaTex, ok: true, bars still 2 — only beats differ (6 vs 5),
    // so this isolates the beat-count branch.
    const r = commitEdit("\\tempo 120\n.\n3.6.8 3.6.8 5.6 7.6 | 7.6.4 r.4\n", CARET, { bars: 2, beats: 5 });
    expect(r).toBeNull();
  });

  it("REJECTS an edit that parses cleanly but drifted the BAR count", () => {
    // Valid AlphaTex, ok: true, beats still 5 — only bars differ (3 vs 2),
    // so this isolates the bar-count branch.
    const r = commitEdit("\\tempo 120\n.\n3.6.8 5.6 | 7.6.4 r.4 | 9.6\n", CARET, { bars: 2, beats: 5 });
    expect(r).toBeNull();
  });

  it("rejects an edit that does not parse", () => {
    expect(commitEdit("\\tempo 120\n.\n(((\n", CARET, { bars: 2, beats: 5 })).toBeNull();
  });

  it("allows a deliberate structural change when expectations say so", () => {
    const r = commitEdit("\\tempo 120\n.\n3.6.8 5.6 7.6 9.6 | 7.6.4 r.4\n", CARET, { bars: 2, beats: 6 });
    expect(r).not.toBeNull();
  });

  it("clamps the caret into the new document", () => {
    const r = commitEdit("\\tempo 120\n.\n3.6.8\n", { barIndex: 5, beatIndex: 5, string: 6 }, { bars: 1, beats: 1 });
    expect(r!.caret).toEqual({ barIndex: 0, beatIndex: 0, string: 6 });
  });
});
