import { describe, it, expect } from "vitest";
import { noTempoNote, skippedNote, songProgram, type FetchedRiff } from "./songPlayback";
import type { Riff } from "@/types";

const riff = (id: string, tempo: number | null = 120): Riff =>
  ({ id, name: id, keyRoot: "A", scale: "Minor", tuning: "standard", tempo, tsNum: 4, tsDen: 4, progression: [], createdAt: "", updatedAt: "", parts: [] }) as Riff;
const row = (label: string, riffId: string | null, repeats = 1) => ({ label, riffId, repeats });

describe("songProgram", () => {
  const fetched = new Map<string, FetchedRiff>([
    ["a", { ok: true, riff: riff("a") }],
    ["b", { ok: true, riff: riff("b", 152) }],
    ["slow", { ok: true, riff: riff("slow", null) }],
    ["gone", { ok: false, gone: true }],
    ["broken", { ok: false, gone: false, message: "The server said 500" }],
  ]);

  it("plays the sections with a riff, in order, each its repeats", () => {
    const p = songProgram([row("Intro", "a", 2), row("Gap", null), row("Verse", "b"), row("Outro", "a")], 0, fetched);
    expect(p.sections.map((s) => [s.riff.id, s.repeats, s.row])).toEqual([["a", 2, 0], ["b", 1, 2], ["a", 1, 3]]);
    expect(p.notes).toEqual([]);
  });

  it("starts at the row asked for", () => {
    const p = songProgram([row("Intro", "a"), row("Verse", "b"), row("Outro", "a")], 1, fetched);
    expect(p.sections.map((s) => s.row)).toEqual([1, 2]);
  });

  it("passes over a riff with no tempo yet, one deleted and one that would not load, saying so", () => {
    const p = songProgram([row("Intro", "slow"), row("Verse", "gone"), row("Bridge", "broken"), row("Outro", "a")], 0, fetched);
    expect(p.sections.map((s) => s.row)).toEqual([3]);
    expect(p.notes).toEqual([noTempoNote("Intro"), skippedNote("Verse", { gone: true }), skippedNote("Bridge", { gone: false, message: "The server said 500" })]);
    expect(p.gone).toBe(true);
  });
});

describe("noTempoNote", () => {
  it("says to tap the riff's tempo", () => {
    expect(noTempoNote("Verse")).toBe("Skipped “Verse”: its riff has no tempo yet. Tap it on the riff's page.");
  });
});

describe("skippedNote", () => {
  it("says the riff was deleted", () => {
    expect(skippedNote("Chorus", { gone: true })).toBe("Skipped “Chorus”: its riff was deleted.");
  });
  it("says why else it could not be loaded", () => {
    expect(skippedNote("Bridge", { gone: false, message: "The server said 500" })).toBe(
      "Skipped “Bridge”: its riff could not be loaded (The server said 500).",
    );
  });
});
