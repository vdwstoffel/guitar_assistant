import { describe, it, expect } from "vitest";
import { setTuning, readTuningId, TUNING_PRESETS, STANDARD_TUNING_ID } from "./tuning";
import { parseTex } from "../parse";

const TEX = "\\tempo 120\n.\n3.6.4 5.6 7.6 8.6 | 3.5.4 5.5 7.5 8.5\n";
const at = (barIndex: number, beatIndex: number, string = 6) => ({ barIndex, beatIndex, string });

/** The MIDI numbers alphaTab ends up with for a document. */
function tuningOf(text: string): number[] {
  const parsed = parseTex(text);
  expect(parsed.ok).toBe(true);
  return parsed.score!.tracks[0].staves[0].tuning;
}

describe("readTuningId", () => {
  it("reads a document with no directive as standard", () => {
    expect(readTuningId(TEX)).toBe(STANDARD_TUNING_ID);
  });

  it("names a tuning the preset list knows", () => {
    expect(readTuningId(setTuning(TEX, "drop-d")!.text)).toBe("drop-d");
  });

  it("returns null for a tuning no preset names", () => {
    const custom = "\\tuning e4 b3 g3 d3 a2 b1\n" + TEX;
    expect(readTuningId(custom)).toBeNull();
  });

  it("returns null when the document does not parse", () => {
    expect(readTuningId("\\tempo 120\n.\n(((\n")).toBeNull();
  });
});

describe("setTuning", () => {
  it("inserts the directive when the document has none", () => {
    const next = setTuning(TEX, "drop-d")!.text;
    expect(next.startsWith("\\tuning e4 b3 g3 d3 a2 d2\n")).toBe(true);
    expect(next).toContain("\\tempo 120");
  });

  it("rewrites an existing directive rather than stacking a second", () => {
    const once = setTuning(TEX, "drop-d")!.text;
    const twice = setTuning(once, "drop-c")!.text;
    expect(twice.match(/\\tuning/g)!.length).toBe(1);
    expect(readTuningId(twice)).toBe("drop-c");
  });

  it("leaves the music untouched", () => {
    const next = setTuning(TEX, "dadgad")!.text;
    expect(next).toContain("3.6.4 5.6 7.6 8.6 | 3.5.4 5.5 7.5 8.5");
  });

  it("keeps the caret where it was", () => {
    expect(setTuning(TEX, "drop-d", at(1, 2, 3))!.caret).toEqual(at(1, 2, 3));
  });

  it("rejects an unknown preset id", () => {
    expect(setTuning(TEX, "not-a-tuning")).toBeNull();
  });

  it("leaves the document alone when it does not parse", () => {
    expect(setTuning("\\tempo 120\n.\n(((\n", "drop-d")).toBeNull();
  });

  // The whole point of the preset table: alphaTab has to actually end up in
  // the tuning the label claims. These are the MIDI values from alphaTab
  // 1.8.1's own Tuning.getPresetsFor(6) table.
  it.each([
    ["standard", [64, 59, 55, 50, 45, 40]],
    ["half-down", [63, 58, 54, 49, 44, 39]],
    ["full-down", [62, 57, 53, 48, 43, 38]],
    ["drop-d", [64, 59, 55, 50, 45, 38]],
    ["double-drop-d", [62, 59, 55, 50, 45, 38]],
    ["drop-c", [62, 57, 53, 48, 43, 36]],
    ["open-d", [62, 57, 54, 50, 45, 38]],
    ["open-g", [62, 59, 55, 50, 43, 38]],
    ["open-e", [64, 59, 56, 52, 47, 40]],
    ["open-c", [64, 60, 55, 48, 43, 36]],
    // alphaTab's own name for DADGAD is "Open Dsus4"; same six notes.
    ["dadgad", [62, 57, 55, 50, 45, 38]],
  ])("puts alphaTab in the %s tuning it advertises", (id, expected) => {
    expect(tuningOf(setTuning(TEX, id)!.text)).toEqual(expected);
  });

  it("round-trips every preset through readTuningId", () => {
    for (const preset of TUNING_PRESETS) {
      expect(readTuningId(setTuning(TEX, preset.id)!.text), preset.label).toBe(preset.id);
    }
  });

  it("has no two presets with the same notes (which would make ids ambiguous)", () => {
    const seen = new Set(TUNING_PRESETS.map((p) => p.notes.join(" ")));
    expect(seen.size).toBe(TUNING_PRESETS.length);
  });

  it("gives every preset six strings", () => {
    for (const preset of TUNING_PRESETS) {
      expect(preset.notes.length, preset.label).toBe(6);
    }
  });
});
