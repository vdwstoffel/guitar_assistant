import { describe, expect, it } from "vitest";
import { applyMixEdits, canSwitch, heardAs, mixGains } from "./riffMix";
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

const riff = (parts: RiffPart[], over: Partial<Riff> = {}): Riff => ({
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
  ...over,
});

const TAB = ":4 0.6 |";

describe("applyMixEdits", () => {
  it("lays part edits over the riff, oldest first", () => {
    const r = riff([part("a"), part("b")]);
    const out = applyMixEdits(r, [
      { partId: "a", fields: { level: 0.5 } },
      { partId: "a", fields: { level: 0.25, muted: true } },
      { partId: "b", fields: { listen: "recording" } },
    ]);
    expect(out.parts.map((p) => [p.level, p.muted, p.listen])).toEqual([
      [0.25, true, "tab"],
      [1, false, "recording"],
    ]);
  });

  it("returns the riff itself when nothing is pending, and ignores edits for a part that is gone", () => {
    const r = riff([part("a")]);
    expect(applyMixEdits(r, [])).toBe(r);
    expect(applyMixEdits(r, [{ partId: "gone", fields: { muted: true } }]).parts[0].muted).toBe(false);
  });
});

describe("mixGains", () => {
  it("is each part's level, keyed by part id", () => {
    const r = riff([part("a", { level: 0.5 }), part("b", { muted: true })]);
    expect(mixGains(r)).toEqual({ parts: { a: 0.5, b: 0 } });
  });

  it("with a solo only the soloed parts sound", () => {
    const r = riff([part("a", { soloed: true, level: 0.7 }), part("b")]);
    expect(mixGains(r)).toEqual({ parts: { a: 0.7, b: 0 } });
  });

  it("a solo on a muted part leaves it muted", () => {
    const r = riff([part("a", { soloed: true, muted: true }), part("b")]);
    expect(mixGains(r)).toEqual({ parts: { a: 0, b: 0 } });
  });
});

describe("heardAs / canSwitch", () => {
  it("is the tab or the take the player plays", () => {
    expect(heardAs(part("a"))).toBeNull();
    expect(heardAs(part("a", { alphatex: TAB }))).toBe("tab");
    expect(heardAs(part("a", { audioPath: "x.webm" }))).toBe("recording");
    expect(heardAs(part("a", { alphatex: TAB, audioPath: "x.webm" }))).toBe("tab");
    expect(heardAs(part("a", { alphatex: TAB, audioPath: "x.webm", listen: "recording" }))).toBe("recording");
    // A blank tab is no tab.
    expect(heardAs(part("a", { alphatex: "  ", audioPath: "x.webm", listen: "tab" }))).toBe("recording");
  });

  it("offers the switch only when the part has both", () => {
    expect(canSwitch(part("a", { alphatex: TAB }))).toBe(false);
    expect(canSwitch(part("a", { audioPath: "x.webm" }))).toBe(false);
    expect(canSwitch(part("a", { alphatex: TAB, audioPath: "x.webm" }))).toBe(true);
  });
});
