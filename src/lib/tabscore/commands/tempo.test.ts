import { describe, it, expect } from "vitest";
import { readTempo, setOrInsertTempo, setTempo } from "./tempo";
import { parseTex } from "../parse";

const TEX = '\\title "x"\n\\tempo 225\n\\ts 4 4\n.\n3.6.8 5.6 7.6 | 7.6.4 r.4\n';

describe("readTempo", () => {
  it("reads the notated tempo", () => {
    expect(readTempo(TEX)).toBe(225);
  });

  it("returns null when the document has no tempo directive", () => {
    expect(readTempo("\\title \"x\"\n.\n3.6.8 5.6\n")).toBeNull();
  });

  it("returns null when the document does not parse", () => {
    expect(readTempo("\\tempo 120\n.\n(((\n")).toBeNull();
  });
});

describe("setTempo", () => {
  it("rewrites the tempo and leaves everything else byte-identical", () => {
    const r = setTempo(TEX, 96)!;
    expect(r.text).toBe('\\title "x"\n\\tempo 96\n\\ts 4 4\n.\n3.6.8 5.6 7.6 | 7.6.4 r.4\n');
  });

  it("does not disturb the newline after the directive", () => {
    // The argument node's range includes the trailing newline, exactly like a
    // beat's does. Splicing it verbatim would join \tempo onto the next line.
    const r = setTempo(TEX, 96)!;
    expect(r.text).toContain("\\tempo 96\n\\ts 4 4");
    expect(r.text).not.toContain("96\\ts");
  });

  it("keeps the document parsing and structurally unchanged", () => {
    const r = setTempo(TEX, 40)!;
    const before = parseTex(TEX);
    const after = parseTex(r.text);
    expect(after.ok).toBe(true);
    expect(after.scoreNode.bars.length).toBe(before.scoreNode.bars.length);
  });

  it("clamps to a sane musical range", () => {
    expect(readTempo(setTempo(TEX, 5)!.text)).toBe(20);
    expect(readTempo(setTempo(TEX, 9999)!.text)).toBe(400);
  });

  it("rejects a non-integer or absent tempo directive", () => {
    expect(setTempo(TEX, Number.NaN)).toBeNull();
    expect(setTempo('\\title "x"\n.\n3.6.8 5.6\n', 120)).toBeNull();
  });

  it("leaves the caller's caret where it was", () => {
    const caret = { barIndex: 1, beatIndex: 1, string: 3 };
    expect(setTempo(TEX, 96, caret)!.caret).toEqual(caret);
  });

  it("round-trips: setting the tempo back restores the original text", () => {
    const changed = setTempo(TEX, 96)!;
    expect(setTempo(changed.text, 225)!.text).toBe(TEX);
  });
});

describe("setOrInsertTempo", () => {
  it("changes a tempo the tab states, as setTempo does", () => {
    const r = setOrInsertTempo("\\tempo 90\n.\n:4 0.6 0.6 0.6 0.6 |", 140);
    expect(r && readTempo(r.text)).toBe(140);
  });

  it("puts one at the top of a tab that has none, leaving its bars alone", () => {
    const tex = "\\tuning (e4 b3 g3 d3 a2 e2)\n.\n:4 0.6 3.6 5.6 0.6 | 0.5 3.5 5.5 0.5 |";
    const r = setOrInsertTempo(tex, 152, { barIndex: 1, beatIndex: 2, string: 5 });
    expect(r).not.toBeNull();
    expect(r!.text).toBe(`\\tempo 152\n${tex}`);
    expect(readTempo(r!.text)).toBe(152);
    expect(r!.caret).toEqual({ barIndex: 1, beatIndex: 2, string: 5 });
  });

  it("leaves a tab alphaTab cannot read alone", () => {
    expect(setOrInsertTempo("\\tuning (e4\n.\n:4 0.6 |", 120)).toBeNull();
  });
});
