import { describe, it, expect } from "vitest";
import { setGuitar, readGuitarId, GUITAR_PRESETS, DEFAULT_GUITAR_ID } from "./instrument";
import { parseTex } from "../parse";

const TEX = "\\tempo 120\n.\n3.6.4 5.6 7.6 8.6 | 3.5.4 5.5 7.5 8.5\n";
const at = (barIndex: number, beatIndex: number, string = 6) => ({ barIndex, beatIndex, string });

/** The General MIDI program alphaTab ends up playing a document with. */
function programOf(text: string): number {
  const parsed = parseTex(text);
  expect(parsed.ok).toBe(true);
  return parsed.score!.tracks[0].playbackInfo.program;
}

describe("readGuitarId", () => {
  it("reads a document with no directive as alphaTab's default, steel acoustic", () => {
    expect(readGuitarId(TEX)).toBe(DEFAULT_GUITAR_ID);
    expect(GUITAR_PRESETS.find((p) => p.id === DEFAULT_GUITAR_ID)!.program).toBe(programOf(TEX));
  });

  it("reads the numeric directive the existing tabs carry", () => {
    const existing = "\\title \"Spider\"\n\\tempo 110\n\\ts 4 4\n\\instrument 25\n\\staff{tabs}\n.\n1.6.8 3.6.8\n";
    expect(readGuitarId(existing)).toBe("steel");
  });

  it("reads alphaTab's instrument names as well as numbers", () => {
    expect(readGuitarId("\\instrument distortionguitar\n" + TEX)).toBe("distortion");
  });

  it("returns null for an instrument that is not one of the guitars", () => {
    expect(readGuitarId("\\instrument 0\n" + TEX)).toBeNull();
  });

  it("returns null when the document does not parse", () => {
    expect(readGuitarId("\\tempo 120\n.\n(((\n")).toBeNull();
  });
});

describe("setGuitar", () => {
  it("inserts the directive when the document has none", () => {
    const next = setGuitar(TEX, "clean")!.text;
    expect(next.startsWith("\\instrument 27\n")).toBe(true);
    expect(next).toContain("\\tempo 120");
  });

  it("rewrites an existing directive rather than stacking a second", () => {
    const once = setGuitar(TEX, "nylon")!.text;
    const twice = setGuitar(once, "overdrive")!.text;
    expect(twice.match(/\\instrument/g)!.length).toBe(1);
    expect(readGuitarId(twice)).toBe("overdrive");
  });

  it("does not swallow the directive that follows it", () => {
    const existing = "\\tempo 110\n\\instrument 25\n\\staff{tabs}\n.\n1.6.8 3.6.8\n";
    const next = setGuitar(existing, "distortion")!.text;
    expect(next).toBe("\\tempo 110\n\\instrument 30\n\\staff{tabs}\n.\n1.6.8 3.6.8\n");
  });

  it("leaves the music untouched", () => {
    const next = setGuitar(TEX, "jazz")!.text;
    expect(next).toContain("3.6.4 5.6 7.6 8.6 | 3.5.4 5.5 7.5 8.5");
  });

  it("keeps the caret where it was", () => {
    expect(setGuitar(TEX, "clean", at(1, 2, 3))!.caret).toEqual(at(1, 2, 3));
  });

  it("rejects an unknown preset id", () => {
    expect(setGuitar(TEX, "banjo")).toBeNull();
  });

  it("leaves the document alone when it does not parse", () => {
    expect(setGuitar("\\tempo 120\n.\n(((\n", "clean")).toBeNull();
  });

  // alphaTab has to actually play the guitar the label names. These are the
  // zero-based General MIDI programs from alphaTab 1.8.1's own name table.
  it.each([
    ["nylon", 24],
    ["steel", 25],
    ["jazz", 26],
    ["clean", 27],
    ["muted", 28],
    ["overdrive", 29],
    ["distortion", 30],
  ])("makes alphaTab play %s as program %i", (id, expected) => {
    expect(programOf(setGuitar(TEX, id)!.text)).toBe(expected);
  });

  it("round-trips every preset through readGuitarId", () => {
    for (const preset of GUITAR_PRESETS) {
      expect(readGuitarId(setGuitar(TEX, preset.id)!.text), preset.label).toBe(preset.id);
    }
  });

  it("has no two presets on the same program (which would make ids ambiguous)", () => {
    const seen = new Set(GUITAR_PRESETS.map((p) => p.program));
    expect(seen.size).toBe(GUITAR_PRESETS.length);
  });
});
