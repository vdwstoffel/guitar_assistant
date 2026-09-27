import { describe, it, expect } from "vitest";
import { scaleDuration, toggleDotted } from "./duration";

const TEX = "\\tempo 120\n.\n3.6.8 5.6.4\n";
const at = (barIndex: number, beatIndex: number, string = 6) => ({ barIndex, beatIndex, string });

describe("scaleDuration", () => {
  it("halves a duration (8 -> 16)", () => {
    expect(scaleDuration(TEX, at(0, 0), "halve")!.text).toContain("3.6.16");
  });

  it("doubles a duration (4 -> 2)", () => {
    expect(scaleDuration(TEX, at(0, 1), "double")!.text).toContain("5.6.2");
  });

  it("clamps at the extremes", () => {
    const fast = "\\tempo 120\n.\n3.6.64\n";
    expect(scaleDuration(fast, at(0, 0), "halve")).toBeNull();
    const slow = "\\tempo 120\n.\n3.6.1\n";
    expect(scaleDuration(slow, at(0, 0), "double")).toBeNull();
  });

  it("materialises an inherited duration before changing it", () => {
    // beat 1 has no explicit duration; it inherits :8 from beat 0
    const tex = "\\tempo 120\n.\n3.6.8 5.6 7.6\n";
    expect(scaleDuration(tex, at(0, 1), "halve")!.text).toContain("5.6.16");
  });
});

describe("toggleDotted", () => {
  it("adds a dot", () => {
    expect(toggleDotted(TEX, at(0, 0))!.text).toContain("3.6.8{d}");
  });

  it("removes an existing dot", () => {
    const dotted = "\\tempo 120\n.\n3.6.8{d} 5.6.4\n";
    const out = toggleDotted(dotted, at(0, 0))!.text;
    expect(out).toContain("3.6.8");
    expect(out).not.toContain("{d}");
  });

  it("removes a dot that landed on the note instead of the beat (duration-less single note)", () => {
    // "3.6{d}" has no duration suffix, so the dot's trailing brace sits
    // directly on the note (see beatText.ts's parseBeatText) rather than in
    // beat.effects. toggleDotted must still recognise it as "already
    // dotted" and clear it, instead of missing it and stacking a second
    // "{d}" onto the beat that can never be removed.
    const tex = "\\tempo 120\n.\n3.6{d} 5.6 7.6 | 7.6.4 r.4\n";
    const off = toggleDotted(tex, at(0, 0))!;
    expect(off.text).toBe("\\tempo 120\n.\n3.6.4 5.6 7.6 | 7.6.4 r.4\n");
    // Toggling again re-dots cleanly, in the canonical (beat-level) spot.
    const on = toggleDotted(off.text, at(0, 0))!;
    expect(on.text).toBe("\\tempo 120\n.\n3.6.4{d} 5.6 7.6 | 7.6.4 r.4\n");
  });
});
