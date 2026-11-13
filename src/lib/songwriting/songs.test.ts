import { describe, it, expect } from "vitest";
import { SONG_SHAPE, parseSectionsInput, sectionNotes, playableSections, defaultSongName } from "./songs";

const sec = (over: Record<string, unknown> = {}) => ({ label: "Verse", riffId: null, repeats: 1, ...over });
const riff = (keyRoot: string, scale: string, tempo: number) => ({ riff: { keyRoot, scale, tempo } });

describe("SONG_SHAPE", () => {
  it("is the classic outline", () => {
    expect(SONG_SHAPE).toEqual(["Intro", "Verse", "Chorus", "Verse", "Chorus", "Bridge", "Chorus"]);
  });
});

describe("parseSectionsInput", () => {
  it("accepts a list, with and without a riff", () => {
    const r = parseSectionsInput([sec({ label: " Intro ", riffId: "abc", repeats: 2 }), sec()]);
    expect(r).toEqual({
      ok: true,
      value: [
        { label: "Intro", riffId: "abc", repeats: 2 },
        { label: "Verse", riffId: null, repeats: 1 },
      ],
    });
  });
  it("accepts an empty list and treats a missing riffId as null", () => {
    expect(parseSectionsInput([])).toEqual({ ok: true, value: [] });
    expect(parseSectionsInput([{ label: "A", repeats: 1 }])).toEqual({ ok: true, value: [{ label: "A", riffId: null, repeats: 1 }] });
  });
  it("rejects repeats 0, 17 and fractions", () => {
    for (const repeats of [0, 17, 1.5, "2"]) expect(parseSectionsInput([sec({ repeats })]).ok).toBe(false);
    expect(parseSectionsInput([sec({ repeats: 16 })]).ok).toBe(true);
  });
  it("rejects an empty or over-long label", () => {
    expect(parseSectionsInput([sec({ label: "" })]).ok).toBe(false);
    expect(parseSectionsInput([sec({ label: "   " })]).ok).toBe(false);
    expect(parseSectionsInput([sec({ label: "x".repeat(41) })]).ok).toBe(false);
    expect(parseSectionsInput([sec({ label: "x".repeat(40) })]).ok).toBe(true);
  });
  it("rejects 65 sections but allows 64", () => {
    expect(parseSectionsInput(Array.from({ length: 65 }, () => sec())).ok).toBe(false);
    expect(parseSectionsInput(Array.from({ length: 64 }, () => sec())).ok).toBe(true);
  });
  it("rejects non-arrays, non-objects and bad riffIds", () => {
    expect(parseSectionsInput({}).ok).toBe(false);
    expect(parseSectionsInput([null]).ok).toBe(false);
    expect(parseSectionsInput([sec({ riffId: 5 })]).ok).toBe(false);
    expect(parseSectionsInput([sec({ riffId: "" })]).ok).toBe(false);
  });
});

describe("sectionNotes", () => {
  it("has one entry per gap", () => {
    expect(sectionNotes([])).toEqual([]);
    expect(sectionNotes([riff("A", "Minor", 90)])).toEqual([]);
    expect(sectionNotes([riff("A", "Minor", 90), riff("A", "Minor", 90), riff("A", "Minor", 90)])).toHaveLength(2);
  });
  it("says nothing about the tempo of a riff that has none yet", () => {
    expect(sectionNotes([{ riff: { keyRoot: "A", scale: "Minor", tempo: null } }, riff("A", "Minor", 92)])).toEqual([null]);
  });
  it("notes a key change", () => {
    expect(sectionNotes([riff("A", "Minor", 92), riff("E", "Minor", 92)])).toEqual(["key changes A Minor → E Minor"]);
    expect(sectionNotes([riff("A", "Minor", 92), riff("A", "Major", 92)])).toEqual(["key changes A Minor → A Major"]);
  });
  it("notes a tempo change", () => {
    expect(sectionNotes([riff("A", "Minor", 92), riff("A", "Minor", 140)])).toEqual(["tempo 92 → 140"]);
  });
  it("joins both", () => {
    expect(sectionNotes([riff("A", "Minor", 92), riff("E", "Minor", 140)])).toEqual([
      "key changes A Minor → E Minor · tempo 92 → 140",
    ]);
  });
  it("is null when nothing changes or a side has no riff", () => {
    expect(sectionNotes([riff("A", "Minor", 92), riff("A", "Minor", 92)])).toEqual([null]);
    expect(sectionNotes([riff("A", "Minor", 92), { riff: null }, riff("E", "Minor", 140)])).toEqual([null, null]);
  });
});

describe("playableSections", () => {
  it("lists the indices that have a riff", () => {
    expect(playableSections([{ riff: null }, riff("A", "Minor", 90), { riff: null }, riff("E", "Minor", 90)])).toEqual([1, 3]);
    expect(playableSections([])).toEqual([]);
  });
});

describe("defaultSongName", () => {
  it("is one past the highest Song N", () => {
    expect(defaultSongName([])).toBe("Song 1");
    expect(defaultSongName(["Song 1", "Song 2"])).toBe("Song 3");
    expect(defaultSongName(["Song 2", "Song 7", "Song x", "My Song 9"])).toBe("Song 8");
  });
});
