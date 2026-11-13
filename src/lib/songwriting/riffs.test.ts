import { describe, it, expect } from "vitest";
import {
  parseRiffInput,
  parseRiffPatch,
  defaultRiffName,
  newPartTabTex,
  tabTexForPart,
  riffWriteBack,
  riffAudioDir,
  nextPartName,
  validTrim,
  listenAfterNewTake,
  NEW_TAB_BARS,
  tabHasNotes,
} from "./riffs";
import { parseTex } from "../tabscore/parse";
import { readTempo } from "../tabscore/commands/tempo";
import { readTuningId } from "../tabscore/commands/tuning";
import { readGuitarId } from "../tabscore/commands/instrument";
import { readTimeSignature } from "../tabscore/commands/timeSignature";
import { brokenBars } from "../tabscore/barFill";

const valid = {
  name: null, keyRoot: "A", scale: "Minor", tuning: "standard", tempo: 120,
  tsNum: 4, tsDen: 4, progression: [{ root: "A", quality: "Power", bars: 2 }],
};

describe("parseRiffInput", () => {
  it("accepts a valid object", () => {
    const r = parseRiffInput(valid);
    expect(r.ok).toBe(true);
  });
  it.each([
    ["keyRoot", "H"], ["scale", "None"], ["tuning", "bogus"], ["tempo", 10], ["tsDen", 3],
  ])("rejects bad %s", (k, v) => {
    const r = parseRiffInput({ ...valid, [k]: v });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });
  it("takes a recording with no tempo yet, and 4/4 when no time signature is given", () => {
    const r = parseRiffInput({ name: null, keyRoot: "A", scale: "Minor", tuning: "standard", progression: [] });
    expect(r.ok && r.value).toMatchObject({ tempo: null, tsNum: 4, tsDen: 4 });
    expect(parseRiffInput({ ...valid, tempo: null }).ok).toBe(true);
  });
  it("rejects non-objects", () => {
    expect(parseRiffInput(null).ok).toBe(false);
  });
});

describe("parseRiffPatch", () => {
  it("keeps only present fields and trims the name", () => {
    const r = parseRiffPatch({ name: "  Intro  ", tempo: 90 });
    expect(r).toEqual({ ok: true, value: { name: "Intro", tempo: 90 } });
  });
  it("rejects an empty name and bad values", () => {
    expect(parseRiffPatch({ name: "   " }).ok).toBe(false);
    expect(parseRiffPatch({ tempo: 500 }).ok).toBe(false);
    // A tempo, once there, is changed, never taken away.
    expect(parseRiffPatch({ tempo: null }).ok).toBe(false);
  });
  it("takes guitar tunings only, never a bass one", () => {
    expect(parseRiffPatch({ tuning: "drop-c" }).ok).toBe(true);
    expect(parseRiffPatch({ tuning: "bass-standard" }).ok).toBe(false);
    expect(parseRiffPatch({ tuning: "bass-drop-c" }).ok).toBe(false);
    expect(parseRiffInput({ ...valid, tuning: "bass-standard" }).ok).toBe(false);
  });
});

describe("naming and paths", () => {
  it("names a riff one past the highest Riff N", () => {
    expect(defaultRiffName([])).toBe("Riff 1");
    expect(defaultRiffName(["Riff 1", "Riff 2"])).toBe("Riff 3");
    // Riff 1 of Riff 1-3 deleted: the next is Riff 4, not a second Riff 3.
    expect(defaultRiffName(["Riff 2", "Riff 3"])).toBe("Riff 4");
    expect(defaultRiffName(["Riff 10", "Riff 9"])).toBe("Riff 11");
  });
  it("counts only names that are exactly Riff N", () => {
    expect(defaultRiffName(["Intro", "Riff 7 (slow)", "riff 8", "Riff  9", "My Riff 12", "Riff x"])).toBe("Riff 1");
    expect(defaultRiffName(["Verse", "Riff 5"])).toBe("Riff 6");
  });
  it("puts audio under Riffs/<id>", () => expect(riffAudioDir("abc")).toBe("Riffs/abc"));
});

describe("newPartTabTex", () => {
  it("writes a 4/4 tab of four empty bars", () => {
    const tex = newPartTabTex({ tempo: 92, tsNum: 4, tsDen: 4, tuning: "c-standard" });
    const p = parseTex(tex);
    expect(p.ok).toBe(true);
    expect(readTempo(tex)).toBe(92);
    expect(readTuningId(tex)).toBe("c-standard");
    expect(readGuitarId(tex, p.score)).toBe("distortion");
    expect(p.score.masterBars.length).toBe(NEW_TAB_BARS);
    expect(NEW_TAB_BARS).toBe(4);
    expect(brokenBars(p.score)).toEqual([]);
  });
  it("writes a 6/8 tab", () => {
    const tex = newPartTabTex({ tempo: 100, tsNum: 6, tsDen: 8, tuning: "standard" });
    const p = parseTex(tex);
    expect(p.ok).toBe(true);
    expect(p.score.masterBars.length).toBe(NEW_TAB_BARS);
    expect(readTimeSignature(p.score, 0)).toEqual({ numerator: 6, denominator: 8 });
    expect(brokenBars(p.score)).toEqual([]);
  });
});

describe("newPartTabTex before the tempo is tapped", () => {
  it("states no tempo", () => {
    const tex = newPartTabTex({ tempo: null, tsNum: 4, tsDen: 4, tuning: "standard" });
    expect(parseTex(tex).ok).toBe(true);
    expect(readTempo(tex)).toBeNull();
  });
});

describe("tabHasNotes", () => {
  it("is false for a new tab of rests, whatever its tempo", () => {
    const blank = newPartTabTex({ tempo: 140, tsNum: 4, tsDen: 4, tuning: "standard" });
    expect(tabHasNotes(blank)).toBe(false);
  });
  it("is true once a note is written", () => {
    expect(tabHasNotes("\\tempo 140\n.\n:4 r r 3.6 r |")).toBe(true);
  });
  it("is true for a tab alphaTab cannot read: a broken draft is still work", () => {
    expect(tabHasNotes("\\tuning (e4\n.\n:4 0.6 |")).toBe(true);
  });
});

describe("tabTexForPart", () => {
  const riff = { tempo: 140, tsNum: 4, tsDen: 4, tuning: "drop-c" };
  const stored = "\\tempo 100\n.\n3.6.4 5.6 7.6 8.6\n";
  it("applies the riff's tempo and tuning to stored text", () => {
    const tex = tabTexForPart({ kind: "guitar", alphatex: stored }, riff);
    expect(readTempo(tex)).toBe(140);
    expect(readTuningId(tex)).toBe("drop-c");
    expect(tex).toContain("3.6.4 5.6 7.6 8.6");
  });
  it("builds a fresh tab for blank or null", () => {
    expect(tabTexForPart({ kind: "guitar", alphatex: null }, riff)).toBe(newPartTabTex(riff));
    expect(tabTexForPart({ kind: "guitar", alphatex: "  \n" }, riff)).toBe(newPartTabTex(riff));
  });
  it("gives a tab started before the tempo was tapped the tempo once there is one", () => {
    const early = newPartTabTex({ ...riff, tempo: null });
    expect(readTempo(tabTexForPart({ kind: "guitar", alphatex: early }, riff))).toBe(140);
    expect(readTempo(tabTexForPart({ kind: "guitar", alphatex: early }, { ...riff, tempo: null }))).toBeNull();
  });
});

describe("riffWriteBack", () => {
  const tex = "\\tempo 150\n\\tuning d4 a3 f3 c3 g2 d2\n.\n3.6.4 5.6 7.6 8.6\n".replace("d4 a3 f3 c3 g2 d2", "e4 b3 g3 d3 a2 d2");
  it("reports what differs", () => {
    expect(riffWriteBack(tex, { tempo: 120, tuning: "standard" })).toEqual({ tempo: 150, tuning: "drop-d" });
  });
  it("gives a riff with no tempo yet the tab's, and nothing from a tab that states none", () => {
    expect(riffWriteBack(tex, { tempo: null, tuning: "drop-d" })).toEqual({ tempo: 150 });
    const noTempo = newPartTabTex({ tempo: null, tsNum: 4, tsDen: 4, tuning: "standard" });
    expect(riffWriteBack(noTempo, { tempo: null, tuning: "standard" })).toEqual({});
  });
  it("is empty when nothing differs", () => {
    expect(riffWriteBack(tex, { tempo: 150, tuning: "drop-d" })).toEqual({});
  });
  it("a guitar part in a four-string tuning writes back no tuning (the riff holds guitar tunings only)", () => {
    const fourString = "\\tempo 150\n\\tuning g2 d2 a1 e1\n.\n3.4.4 5.4 7.4 8.4\n";
    expect(readTuningId(fourString)).toBe("bass-standard");
    const back = riffWriteBack(fourString, { tempo: 120, tuning: "standard" }, "guitar");
    expect(back).toEqual({ tempo: 150 });
    expect("tuning" in back).toBe(false);
  });
  it.each([5, 9999])("never writes back an out-of-range tempo (%i) but still writes the tuning", (bpm) => {
    const t = `\\tempo ${bpm}\n\\tuning e4 b3 g3 d3 a2 d2\n.\n3.6.4 5.6 7.6 8.6\n`;
    expect(riffWriteBack(t, { tempo: 120, tuning: "standard" })).toEqual({ tuning: "drop-d" });
  });
});

describe("nextPartName", () => {
  it("numbers guitars one past the highest", () => {
    expect(nextPartName("guitar", ["Guitar 1", "Guitar 3"])).toBe("Guitar 4");
    expect(nextPartName("guitar", [])).toBe("Guitar 1");
    expect(nextPartName("guitar", ["Bass"])).toBe("Guitar 1");
  });
  it("names the first bass plain, then numbers", () => {
    expect(nextPartName("bass", [])).toBe("Bass");
    expect(nextPartName("bass", ["Bass"])).toBe("Bass 2");
    expect(nextPartName("bass", ["Bass", "Bass 4"])).toBe("Bass 5");
    expect(nextPartName("bass", ["Guitar 1"])).toBe("Bass");
  });
});

describe("bass parts", () => {
  const riff = { tempo: 120, tsNum: 4, tsDen: 4, tuning: "drop-c" };
  const check = (tex: string) => {
    const p = parseTex(tex);
    expect(p.ok).toBe(true);
    expect(readTuningId(tex)).toBe("bass-drop-c");
    expect(p.score.tracks[0].playbackInfo.program).toBe(34);
    expect(p.score.tracks[0].staves[0].tuning.length).toBe(4);
    expect(brokenBars(p.score)).toEqual([]);
  };
  it("newPartTabTex writes a four-string bass tab", () => check(newPartTabTex(riff, "bass")));
  it("tabTexForPart builds a fresh bass tab", () => check(tabTexForPart({ kind: "bass", alphatex: null }, riff)));
  it("tabTexForPart gives stored bass text the derived tuning", () => {
    const stored = newPartTabTex({ ...riff, tuning: "standard" }, "bass");
    check(tabTexForPart({ kind: "bass", alphatex: stored }, riff));
  });
  it("riffWriteBack never returns a tuning for bass", () => {
    const tex = newPartTabTex({ ...riff, tuning: "drop-d", tempo: 150 }, "bass");
    const back = riffWriteBack(tex, { tempo: 120, tuning: "standard" }, "bass");
    expect(back).toEqual({ tempo: 150 });
    expect("tuning" in back).toBe(false);
  });
});

describe("validTrim", () => {
  it("accepts 0 <= start < end <= duration", () => {
    expect(validTrim(0.5, 2, 3)).toBeNull();
    expect(validTrim(null, null, 3)).toBeNull();
    expect(validTrim(null, 3, 3)).toBeNull();
  });
  it.each([
    [-1, 2, 3], [2, 2, 3], [3, 2, 3], [0, 4, 3], [3, null, 3],
  ])("rejects %s..%s of %s", (a, b, d) => expect(validTrim(a, b, d)).not.toBeNull());
  it("without a known duration only checks the order", () => {
    expect(validTrim(1, 9, null)).toBeNull();
    expect(validTrim(2, 1, null)).not.toBeNull();
  });
});

describe("listenAfterNewTake", () => {
  it("a part with a tab is heard as its new take", () => {
    expect(listenAfterNewTake({ alphatex: ":4 0.6 3.6" })).toBe("recording");
  });

  it("a part without a tab keeps its setting, so a later tab is what is heard", () => {
    expect(listenAfterNewTake({ alphatex: null })).toBeNull();
    expect(listenAfterNewTake({ alphatex: "" })).toBeNull();
    expect(listenAfterNewTake({ alphatex: "  \n " })).toBeNull();
  });
});
