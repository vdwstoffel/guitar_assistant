import { describe, expect, it } from "vitest";
import {
  deletePartQuestion,
  deleteRiffQuestion,
  guideRiff,
  parsePartName,
  savedTakeTrim,
  trimMoved,
} from "./partTakes";
import { mixGains } from "./riffMix";
import type { Riff, RiffPart } from "@/types";

const part = (id: string, over: Partial<RiffPart> = {}): RiffPart => ({
  id,
  riffId: "r",
  kind: "guitar",
  name: id,
  sortOrder: 0,
  alphatex: null,
  audioPath: null,
  audioMime: null,
  audioDuration: null,
  trimStart: null,
  trimEnd: null,
  listen: "tab",
  level: 1,
  muted: false,
  soloed: false,
  playbackSpeed: null,
  ...over,
});

const riff = (parts: RiffPart[]): Riff => ({
  id: "r",
  name: "Riff",
  keyRoot: "E",
  scale: "Minor",
  tuning: "standard",
  tempo: 120,
  tsNum: 4,
  tsDen: 4,
  progression: [],
  createdAt: "",
  updatedAt: "",
  parts,
});

describe("guideRiff", () => {
  it("silences the part being recorded and leaves the rest as mixed", () => {
    const r = riff([part("g1", { level: 0.5 }), part("g2"), part("b", { muted: true })]);
    const g = mixGains(guideRiff(r, "g2"));
    expect(g.parts).toEqual({ g1: 0.5, g2: 0, b: 0 });
  });

  it("drops the recorded part's solo, so a solo on it does not silence the guide", () => {
    const r = riff([part("g1"), part("g2", { soloed: true })]);
    expect(mixGains(guideRiff(r, "g2"))).toEqual({ parts: { g1: 1, g2: 0 } });
  });

  it("keeps another part's solo: the guide is what the mixer says", () => {
    const r = riff([part("g1", { soloed: true }), part("g2"), part("b")]);
    expect(mixGains(guideRiff(r, "b"))).toEqual({ parts: { g1: 1, g2: 0, b: 0 } });
  });

  it("does not change the riff it was given, and ignores an unknown part", () => {
    const r = riff([part("g1")]);
    guideRiff(r, "g1");
    expect(r.parts[0].muted).toBe(false);
    expect(guideRiff(r, "nope")).toBe(r);
  });
});

describe("savedTakeTrim", () => {
  it("starts the handles at the stored trim", () => {
    expect(savedTakeTrim({ trimStart: 0.5, trimEnd: 2.5, audioDuration: 3 }, 3)).toEqual({ trim: { start: 0.5, end: 2.5 }, duration: 3 });
  });

  it("reads an unset start as 0 and an unset end as the end of the take", () => {
    expect(savedTakeTrim({ trimStart: null, trimEnd: null, audioDuration: 3 }, 3)).toEqual({ trim: { start: 0, end: 3 }, duration: 3 });
  });

  it("keeps the handles inside the shorter of the stored and the decoded length (the server checks the stored one)", () => {
    expect(savedTakeTrim({ trimStart: 0, trimEnd: 3, audioDuration: 3 }, 3.02)).toEqual({ trim: { start: 0, end: 3 }, duration: 3 });
    expect(savedTakeTrim({ trimStart: 0, trimEnd: 3.02, audioDuration: 3.02 }, 3)).toEqual({ trim: { start: 0, end: 3 }, duration: 3 });
    expect(savedTakeTrim({ trimStart: 1, trimEnd: null, audioDuration: null }, 2)).toEqual({ trim: { start: 1, end: 2 }, duration: 2 });
  });

  it("falls back to the whole take when the stored trim no longer fits", () => {
    expect(savedTakeTrim({ trimStart: 4, trimEnd: 5, audioDuration: 6 }, 3)).toEqual({ trim: { start: 0, end: 3 }, duration: 3 });
  });
});

describe("trimMoved", () => {
  it("ignores differences under a millisecond", () => {
    expect(trimMoved({ start: 1, end: 2 }, { start: 1.0004, end: 1.9996 })).toBe(false);
    expect(trimMoved({ start: 1, end: 2 }, { start: 1, end: 2.01 })).toBe(true);
    expect(trimMoved({ start: 1.2, end: 2 }, { start: 1, end: 2 })).toBe(true);
  });
});

describe("deletePartQuestion", () => {
  it("names what goes with the part", () => {
    expect(deletePartQuestion(part("g", { name: "Guitar 2" }), false)).toBe("Delete Guitar 2?");
    expect(deletePartQuestion(part("g", { name: "Guitar 2", audioPath: "a.webm" }), false)).toBe("Delete Guitar 2? Its recording is deleted too.");
    expect(deletePartQuestion(part("g", { name: "Bass", alphatex: ":4 0.4" }), false)).toBe("Delete Bass? Its tab is deleted too.");
    expect(deletePartQuestion(part("g", { name: "Bass", alphatex: "  " }), false)).toBe("Delete Bass?");
    expect(deletePartQuestion(part("g", { name: "Bass", alphatex: ":4 0.4", audioPath: "a.webm" }), false)).toBe(
      "Delete Bass? Its recording and tab are deleted too.",
    );
  });

  it("warns that the take being recorded is lost", () => {
    expect(deletePartQuestion(part("g", { name: "Guitar 2" }), true)).toBe("Delete Guitar 2? The take you are recording is lost.");
  });
});

describe("deleteRiffQuestion", () => {
  it("is the question stage 2 asked, plus the take being recorded", () => {
    expect(deleteRiffQuestion("Riff 3", false)).toBe("Delete “Riff 3”? Its recording and tab are deleted too.");
    expect(deleteRiffQuestion("Riff 3", true)).toBe("Delete “Riff 3”? Its recording and tab are deleted too. The take you are recording is lost.");
  });
});

describe("parsePartName", () => {
  it("accepts 1-80 characters, trimmed (the API's rule)", () => {
    expect(parsePartName("  Lead  ")).toBe("Lead");
    expect(parsePartName("   ")).toBeNull();
    expect(parsePartName("x".repeat(80))).toBe("x".repeat(80));
    expect(parsePartName("x".repeat(81))).toBeNull();
  });
});
