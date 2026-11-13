import { describe, expect, it } from "vitest";
import {
  applyEdits,
  isTabbed,
  parseDraft,
  replaceSummary,
  riffShape,
  riffSummary,
  songsHref,
  tabLink,
  takeClock,
  takeSrc,
  takeWindow,
} from "./riffView";
import type { Riff, RiffPart } from "@/types";

const part = (over: Partial<RiffPart> = {}): RiffPart => ({
  id: "p1",
  riffId: "r1",
  kind: "guitar",
  name: "Guitar 1",
  sortOrder: 0,
  alphatex: null,
  audioPath: "Riffs/r1/p1-take.webm",
  audioMime: "audio/webm",
  audioDuration: 6,
  trimStart: 0.5,
  trimEnd: 4.5,
  listen: "recording",
  level: 1,
  muted: false,
  soloed: false,
  playbackSpeed: null,
  ...over,
});

const riff = (over: Partial<Riff> = {}): Riff => ({
  id: "r1",
  name: "Riff 1",
  keyRoot: "A",
  scale: "Minor",
  tuning: "standard",
  tempo: 92,
  tsNum: 4,
  tsDen: 4,
  progression: [],
  createdAt: "2026-11-10T10:00:00.000Z",
  updatedAt: "2026-11-10T10:00:00.000Z",
  parts: [part()],
  ...over,
});

describe("songsHref", () => {
  it("names the view, and the riff and part inside the Riffs view", () => {
    expect(songsHref({ view: "write" })).toBe("/songs?view=write");
    expect(songsHref({ view: "riffs" })).toBe("/songs?view=riffs");
    expect(songsHref({ view: "riffs", riff: "r1" })).toBe("/songs?view=riffs&riff=r1");
    expect(songsHref({ view: "riffs", riff: "r1", part: "p1" })).toBe("/songs?view=riffs&riff=r1&part=p1");
  });

  it("names the song inside the Songs view only", () => {
    expect(songsHref({ view: "songs" })).toBe("/songs?view=songs");
    expect(songsHref({ view: "songs", song: "s1" })).toBe("/songs?view=songs&song=s1");
    expect(songsHref({ view: "write", song: "s1" })).toBe("/songs?view=write");
  });

  it("drops a part without a riff, and a riff outside the Riffs view", () => {
    expect(songsHref({ view: "riffs", part: "p1" })).toBe("/songs?view=riffs");
    expect(songsHref({ view: "write", riff: "r1", part: "p1" })).toBe("/songs?view=write");
  });

  it("encodes ids", () => {
    expect(songsHref({ view: "riffs", riff: "a&b" })).toBe("/songs?view=riffs&riff=a%26b");
  });
});

describe("riffSummary", () => {
  it("says which parts have a tab and a take, as GET /api/riffs does", () => {
    const s = riffSummary(riff({ parts: [part(), part({ id: "p2", alphatex: "  \n", audioPath: null }), part({ id: "p3", alphatex: "\\tempo 92\n.\nr |" })] }));
    expect(s.parts).toEqual([
      { id: "p1", kind: "guitar", name: "Guitar 1", hasTab: false, hasAudio: true },
      { id: "p2", kind: "guitar", name: "Guitar 1", hasTab: false, hasAudio: false },
      { id: "p3", kind: "guitar", name: "Guitar 1", hasTab: true, hasAudio: true },
    ]);
    expect(s).toMatchObject({ id: "r1", name: "Riff 1", keyRoot: "A", tempo: 92 });
    expect(s).not.toHaveProperty("progression");
  });
});

describe("replaceSummary", () => {
  it("swaps the matching entry in place and leaves the list alone otherwise", () => {
    const a = riffSummary(riff({ id: "a", name: "A" }));
    const b = riffSummary(riff({ id: "b", name: "B" }));
    const list = [a, b];
    expect(replaceSummary(list, { ...b, name: "B2" }).map((r) => r.name)).toEqual(["A", "B2"]);
    expect(replaceSummary(list, riffSummary(riff({ id: "gone" })))).toBe(list);
  });
});

describe("badges and card text", () => {
  it("is tabbed when any part has a tab", () => {
    expect(isTabbed({ parts: [{ hasTab: false }, { hasTab: true }] })).toBe(true);
    expect(isTabbed({ parts: [{ hasTab: false }] })).toBe(false);
    expect(isTabbed({ parts: [] })).toBe(false);
  });

  it("describes the riff's shape", () => {
    expect(riffShape({ tsNum: 4, tsDen: 4, tempo: 92 })).toBe("4/4 · ♩ 92");
    expect(riffShape({ tsNum: 6, tsDen: 8, tempo: null })).toBe("6/8 · tempo not tapped");
  });

  it("opens the first tabbed part, else offers to tab out the first part", () => {
    expect(tabLink({ parts: [{ id: "a", hasTab: false }, { id: "b", hasTab: true }] })).toEqual({ partId: "b", label: "Open tab" });
    expect(tabLink({ parts: [{ id: "a", hasTab: false }] })).toEqual({ partId: "a", label: "Tab it out" });
    expect(tabLink({ parts: [] })).toBeNull();
  });
});

describe("applyEdits", () => {
  it("lays pending edits over the saved riff, the newest winning", () => {
    const r = riff();
    expect(applyEdits(r, [])).toBe(r);
    const shown = applyEdits(r, [{ name: "Gallop" }, { tempo: 120 }, { name: "Gallop 2" }]);
    expect(shown).toMatchObject({ name: "Gallop 2", tempo: 120, keyRoot: "A" });
    expect(r.name).toBe("Riff 1");
  });
});

describe("parseDraft", () => {
  it("trims a name and refuses an empty or over-long one", () => {
    expect(parseDraft("name", "  Gallop  ")).toBe("Gallop");
    expect(parseDraft("name", "   ")).toBeNull();
    expect(parseDraft("name", "x".repeat(81))).toBeNull();
  });

  it("accepts only whole numbers in the riff's ranges", () => {
    expect(parseDraft("tempo", "140")).toBe(140);
    expect(parseDraft("tempo", "14")).toBeNull();
    expect(parseDraft("tempo", "401")).toBeNull();
    expect(parseDraft("tempo", "92.5")).toBeNull();
    expect(parseDraft("tempo", "")).toBeNull();
    expect(parseDraft("tempo", "1e2")).toBeNull();
    expect(parseDraft("tsNum", " 7 ")).toBe(7);
    expect(parseDraft("tsNum", "17")).toBeNull();
  });
});

describe("takes", () => {
  it("streams a take with each path segment encoded", () => {
    expect(takeSrc("Riffs/r1/p1 #2.webm")).toBe("/api/audio/Riffs/r1/p1%20%232.webm");
  });

  it("plays the trimmed part, falling back to the whole recording", () => {
    expect(takeWindow(part())).toEqual({ trimStart: 0.5, trimEnd: 4.5 });
    expect(takeWindow(part({ trimStart: null, trimEnd: null }))).toEqual({ trimStart: 0, trimEnd: 6 });
    expect(takeWindow(part({ trimStart: null, trimEnd: null, audioDuration: null }))).toEqual({ trimStart: 0, trimEnd: Infinity });
    expect(takeWindow(part({ trimStart: 3, trimEnd: 2 }))).toEqual({ trimStart: 3, trimEnd: Infinity });
  });

  it("shows the take clock as m:ss.t, rounding before the minute", () => {
    expect(takeClock(0)).toBe("0:00.0");
    expect(takeClock(5.04)).toBe("0:05.0");
    expect(takeClock(9.96)).toBe("0:10.0");
    expect(takeClock(59.94)).toBe("0:59.9");
    expect(takeClock(59.96)).toBe("1:00.0");
    expect(takeClock(61.25)).toBe("1:01.3");
    expect(takeClock(600)).toBe("10:00.0");
    expect(takeClock(-1)).toBe("0:00.0");
  });
});
