import { describe, it, expect } from "vitest";
import {
  setTuning, readTuningId, findTuningPreset, tuningPresetsFor, TUNING_PRESETS, BASS_TUNING_PRESETS, STANDARD_TUNING_ID,
} from "./tuning";
import { parseTex } from "../parse";

const TEX = "\\tempo 120\n.\n3.6.4 5.6 7.6 8.6 | 3.5.4 5.5 7.5 8.5\n";
const at = (barIndex: number, beatIndex: number, string = 6) => ({ barIndex, beatIndex, string });
// A bass tab in E standard: string 1 = G, 4 = low E.
const BASS_TEX = "\\tuning g2 d2 a1 e1\n\\tempo 120\n.\n3.4.4 5.4 7.3 0.1 | 3.4.4 5.4 7.3 0.1\n";

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

describe("bass tunings", () => {
  it("reads a four-string tab's tuning as its bass preset", () => {
    expect(readTuningId(BASS_TEX)).toBe("bass-standard");
  });

  it("rewrites a four-string directive with the bass tuning asked for", () => {
    const next = setTuning(BASS_TEX, "bass-drop-d")!.text;
    expect(next.startsWith("\\tuning g2 d2 a1 d1\n")).toBe(true);
    expect(next.match(/\\tuning/g)!.length).toBe(1);
    expect(readTuningId(next)).toBe("bass-drop-d");
    expect(next).toContain("3.4.4 5.4 7.3 0.1 | 3.4.4 5.4 7.3 0.1");
  });

  it("keeps the caret where it was", () => {
    expect(setTuning(BASS_TEX, "bass-c-standard", at(1, 2, 3))!.caret).toEqual(at(1, 2, 3));
  });

  // alphaTab 1.8.1 names five of these itself (Tuning.getPresetsFor(4):
  // "Bass Standard Tuning", "Bass Tune down ½ step", "Bass Tune down 1 step",
  // "Bass Tune down 2 step", "Bass Dropped D Tuning"); C♯ standard, Drop C♯
  // and Drop C are not in its table, but import the same way.
  it.each([
    ["bass-standard", [43, 38, 33, 28]],
    ["bass-half-down", [42, 37, 32, 27]],
    ["bass-full-down", [41, 36, 31, 26]],
    ["bass-c-sharp-standard", [40, 35, 30, 25]],
    ["bass-c-standard", [39, 34, 29, 24]],
    ["bass-drop-d", [43, 38, 33, 26]],
    ["bass-drop-c-sharp", [42, 37, 32, 25]],
    ["bass-drop-c", [41, 36, 31, 24]],
  ])("puts alphaTab in the %s tuning it advertises", (id, expected) => {
    expect(tuningOf(setTuning(BASS_TEX, id)!.text)).toEqual(expected);
  });

  it("round-trips every bass preset through readTuningId", () => {
    for (const preset of BASS_TUNING_PRESETS) {
      expect(readTuningId(setTuning(BASS_TEX, preset.id)!.text), preset.label).toBe(preset.id);
    }
  });

  it("gives every bass preset four strings", () => {
    for (const preset of BASS_TUNING_PRESETS) {
      expect(preset.notes.length, preset.label).toBe(4);
    }
  });

  it("has no two presets, guitar or bass, with the same id or notes", () => {
    const all = [...TUNING_PRESETS, ...BASS_TUNING_PRESETS];
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
    expect(new Set(all.map((p) => p.notes.join(" "))).size).toBe(all.length);
  });

  it("refuses a bass tuning for a guitar tab with notes on its two low strings", () => {
    // Strings 5 and 6 do not exist on a bass: the document would not import.
    expect(setTuning(TEX, "bass-standard")).toBeNull();
  });

  it("finds a preset by id, guitar or bass", () => {
    expect(findTuningPreset("drop-c")?.label).toBe("Drop C");
    expect(findTuningPreset("bass-drop-c")?.notes).toEqual(["f2", "c2", "g1", "c1"]);
    expect(findTuningPreset("nope")).toBeUndefined();
    expect(findTuningPreset(null)).toBeUndefined();
  });

  it("offers the bass list to a four-string tab and the guitar list to any other", () => {
    expect(tuningPresetsFor(4)).toBe(BASS_TUNING_PRESETS);
    expect(tuningPresetsFor(6)).toBe(TUNING_PRESETS);
    expect(tuningPresetsFor(7)).toBe(TUNING_PRESETS);
  });
});
