/* eslint-disable @typescript-eslint/no-explicit-any --
 * Test reads alphaTab model objects whose types are not worth restating.
 */
import { describe, expect, it } from "vitest";
import * as alphaTab from "@coderline/alphatab";
import { CLOCK_TRACK, buildRiffTex, buildSongTex, effectiveGains, heardTabs, heardTakes, playedBars } from "./riffScore";

function importTex(tex: string) {
  const importer = new alphaTab.importer.AlphaTexImporter();
  importer.initFromString(tex, new alphaTab.Settings());
  try {
    return importer.readScore();
  } catch (e) {
    const items = [importer.lexerDiagnostics, importer.parserDiagnostics, importer.semanticDiagnostics]
      .flatMap((b: any) => b?.items ?? []);
    throw new Error(`${(e as Error).message}: ${JSON.stringify(items.map((d: any) => d.message))}\n${tex}`);
  }
}

const gtr = (bars: string[], extra = "") =>
  `\\tempo 90\n\\tuning (e4 b3 g3 d3 a2 e2)\n\\instrument 30\n${extra}.\n${bars.join(" |\n")}\n`;
const bass = (bars: string[]) =>
  `\\tempo 90\n\\tuning (g2 d2 a1 e1)\n\\instrument 34\n.\n${bars.join(" |\n")}\n`;
const note = ":4 3.6 3.6 5.6 5.6";
const base = { tempo: 120, tsNum: 4, tsDen: 4 };
/** Beats in each bar of a track, and whether all of them are rests. */
const restCounts = (track: any) => track.staves[0].bars.map((b: any) => (b.voices[0].beats.every((x: any) => x.isRest) ? b.voices[0].beats.length : -1));

describe("buildRiffTex", () => {
  it("makes one track per tab plus the silent clock, padding the shorter tab with rests", () => {
    const { tex, trackOrder } = buildRiffTex({
      ...base,
      tabs: [{ name: "Guitar 1", tex: gtr([note, note]) }, { name: "Guitar 2", tex: gtr([note]) }],
    });
    expect(trackOrder).toEqual(["Guitar 1", "Guitar 2", CLOCK_TRACK]);
    const score = importTex(tex);
    expect(score.tracks.length).toBe(3);
    expect(score.tempo).toBe(120);
    expect(score.masterBars.length).toBe(2);
    expect(score.tracks[1].staves[0].tuning.length).toBe(6);
    expect(score.tracks[1].playbackInfo.program).toBe(30);
    const pad = score.tracks[1].staves[0].bars[1].voices[0];
    expect(pad.beats.length).toBeGreaterThan(0);
    expect(pad.beats.every((b: any) => b.isRest)).toBe(true);
    expect(restCounts(score.tracks[2])).toEqual([4, 4]);
  });

  it("keeps a bass tab's four strings and program", () => {
    const { tex } = buildRiffTex({ ...base, tabs: [{ name: "Bass", tex: bass([":4 0.4 0.4 0.4 0.4"]) }] });
    const score = importTex(tex);
    expect(score.tracks[0].staves[0].tuning.length).toBe(4);
    expect(score.tracks[0].playbackInfo.program).toBe(34);
  });

  it("writes the structure once per repeat", () => {
    const { tex } = buildRiffTex({
      ...base, repeats: 3, tabs: [{ name: "Guitar 1", tex: gtr([note, note]) }],
    });
    const score = importTex(tex);
    expect(score.masterBars.length).toBe(6);
    expect(score.tracks[1].staves[0].bars.length).toBe(6);
  });

  it("with no tabs (takes only) is a clock-only score as long as the takes, to the 16th", () => {
    // 3 bars of 4/4 and 5 sixteenths more.
    const { tex, trackOrder } = buildRiffTex({ ...base, tabs: [], takeSixteenths: 53 });
    expect(trackOrder).toEqual([CLOCK_TRACK]);
    const score = importTex(tex);
    expect(score.tracks.length).toBe(1);
    expect(score.masterBars.map((m: any) => `${m.timeSignatureNumerator}/${m.timeSignatureDenominator}`)).toEqual(["4/4", "4/4", "4/4", "5/16"]);
    expect(playedBars(score).endTick).toBe(53 * 240);
  });

  it("with no tabs and no take length is one bar", () => {
    expect(importTex(buildRiffTex({ ...base, tabs: [] }).tex).masterBars.length).toBe(1);
  });

  it("is as long as its tab, however long the takes", () => {
    const { tex } = buildRiffTex({ ...base, takeSixteenths: 200, tabs: [{ name: "Guitar 1", tex: gtr([note]) }] });
    expect(importTex(tex).masterBars.length).toBe(1);
  });

  it("ignores a tab's own tempo", () => {
    const { tex } = buildRiffTex({ ...base, tempo: 77, tabs: [{ name: "G", tex: gtr([note]) }] });
    expect(importTex(tex).tempo).toBe(77);
  });

  it("keeps a 6/8 riff's meter, the clock resting through each bar", () => {
    const six8 = `\\tempo 90\n\\tuning (e4 b3 g3 d3 a2 e2)\n\\instrument 30\n\\ts (6 8)\n.\n:8 3.6 3.6 3.6 3.6 3.6 3.6\n`;
    const { tex } = buildRiffTex({ ...base, tsNum: 6, tsDen: 8, tabs: [{ name: "G", tex: six8 }] });
    const score = importTex(tex);
    expect(score.masterBars[0].timeSignatureNumerator).toBe(6);
    expect(score.masterBars[0].timeSignatureDenominator).toBe(8);
    expect(restCounts(score.tracks[1])).toEqual([6]);
    expect(playedBars(score).endTick).toBe(3 * 960);
  });

  it("clock-only 6/8 riff", () => {
    const { tex } = buildRiffTex({ ...base, tsNum: 6, tsDen: 8, takeSixteenths: 24, tabs: [] });
    const score = importTex(tex);
    expect(score.masterBars.length).toBe(2);
    expect(score.masterBars[1].timeSignatureNumerator).toBe(6);
    expect(restCounts(score.tracks[0])).toEqual([6, 6]);
  });
});

describe("buildSongTex", () => {
  const six = (bars: string[]) => `\\tempo 90\n\\tuning (e4 b3 g3 d3 a2 e2)\n\\ts (3 4)\n.\n${bars.join(" |\n")}\n`;
  const A = { tempo: 120, tsNum: 4, tsDen: 4, repeats: 2, tabs: [{ name: "a1", tex: gtr([note, note]) }] };
  const B = { tempo: 152, tsNum: 3, tsDen: 4, repeats: 1, tabs: [{ name: "b1", tex: six(["3.6 3.6 5.6"]) }] };

  it("plays the sections back to back, each pass, in one score", () => {
    const { tex, trackOrder, passes } = buildSongTex([A, B]);
    expect(trackOrder).toEqual(["a1", "b1", CLOCK_TRACK]);
    expect(passes).toEqual([{ section: 0, bars: 2 }, { section: 0, bars: 2 }, { section: 1, bars: 1 }]);
    const score = importTex(tex);
    expect(score.masterBars.map((m: any) => `${m.timeSignatureNumerator}/${m.timeSignatureDenominator}`)).toEqual(["4/4", "4/4", "4/4", "4/4", "3/4"]);
    expect(playedBars(score).masterBars).toEqual([0, 1, 2, 3, 4]);
  });

  it("states each section's tempo on its first bar", () => {
    const score = importTex(buildSongTex([A, B]).tex);
    const tempos = score.masterBars.map((m: any) => (m.tempoAutomations ?? []).map((t: any) => t.value));
    expect(tempos).toEqual([[120], [], [], [], [152]]);
  });

  it("rests each track through the sections it is not in", () => {
    const score = importTex(buildSongTex([A, B]).tex);
    const rests = (track: any) => track.staves[0].bars.map((b: any) => b.voices[0].beats.every((x: any) => x.isRest));
    expect(rests(score.tracks[0])).toEqual([false, false, false, false, true]);
    expect(rests(score.tracks[1])).toEqual([true, true, true, true, false]);
  });

  it("a riff used in two sections is one track playing in both", () => {
    const { tex, trackOrder } = buildSongTex([{ ...A, repeats: 1 }, B, { ...A, repeats: 1 }]);
    expect(trackOrder).toEqual(["a1", "b1", CLOCK_TRACK]);
    const score = importTex(tex);
    const notes = score.tracks[0].staves[0].bars.map((b: any) => b.voices[0].beats.some((x: any) => !x.isRest));
    expect(notes).toEqual([true, true, false, true, true]);
  });

  it("a riff's repeat signs stay inside its own pass", () => {
    const twice = gtr([`\\ro ${note}`, `\\rc 2 ${note}`]);
    const score = importTex(buildSongTex([{ ...A, repeats: 1, tabs: [{ name: "a1", tex: twice }] }, B]).tex);
    expect(playedBars(score).masterBars).toEqual([0, 1, 0, 1, 2]);
  });
});

describe("effectiveGains", () => {
  const m = (level: number, muted = false, soloed = false) => ({ level, muted, soloed });
  it("uses each level when nothing is soloed, 0 when muted", () => {
    expect(effectiveGains([m(0.8), m(0.5, true)])).toEqual([0.8, 0]);
  });
  it("with a solo only the soloed parts sound", () => {
    expect(effectiveGains([m(0.8, false, true), m(0.5)])).toEqual([0.8, 0]);
  });
  it("a soloed and muted part stays silent", () => {
    expect(effectiveGains([m(0.8, true, true), m(0.5)])).toEqual([0, 0]);
  });
});

describe("heard parts", () => {
  const p = (alphatex: string | null, audioPath: string | null, listen: "tab" | "recording") =>
    ({ alphatex, audioPath, listen }) as any;
  it("picks tab or take by listen, falling back to whichever exists", () => {
    const parts = [p("x", "a", "tab"), p("x", "a", "recording"), p("x", null, "recording"), p(null, "a", "tab"), p(null, null, "tab")];
    expect(heardTabs(parts).map((x: any) => parts.indexOf(x))).toEqual([0, 2]);
    expect(heardTakes(parts).map((x: any) => parts.indexOf(x))).toEqual([1, 3]);
  });
});

describe("loop length", () => {
  /** Quarter-note beats the combined score plays. */
  const beatsPlayed = (tabs: string[], riff: { tsNum: number; tsDen: number; takeSixteenths?: number; repeats?: number }) =>
    playedBars(importTex(buildRiffTex({ ...base, ...riff, tabs: tabs.map((tex, i) => ({ name: `T${i}`, tex })) }).tex)).endTick / 960;
  it("counts quarter-note beats", () => {
    expect(beatsPlayed([gtr([note, note])], { tsNum: 4, tsDen: 4 })).toBe(8);
    expect(beatsPlayed([], { tsNum: 6, tsDen: 8, takeSixteenths: 36 })).toBe(9);
    expect(beatsPlayed([gtr([note])], { tsNum: 4, tsDen: 4, repeats: 3 })).toBe(12);
  });
});

describe("repeat signs and endings play as written", () => {
  /** Two bars, the pair played twice. */
  const twice = gtr([`\\ro ${note}`, `\\rc 2 ${note}`]);
  const meters = (tex: string) =>
    importTex(tex).masterBars.map((m: any) => `${m.timeSignatureNumerator}/${m.timeSignatureDenominator}`);
  const played = (tex: string) => playedBars(importTex(tex));

  it("a repeated two-bar tab loops as long as it plays: four bars", () => {
    const { tex } = buildRiffTex({ ...base, tabs: [{ name: "G", tex: twice }] });
    const score = importTex(tex);
    expect(score.masterBars.length).toBe(2);
    const p = played(tex);
    expect(p.masterBars).toEqual([0, 1, 0, 1]);
    expect(p.endTick).toBe(4 * 3840);
    expect(score.tracks[0].staves[0].bars.every((b: any) => b.voices[0].beats.some((x: any) => !x.isRest))).toBe(true);
  });

  it("each pass of a repeated section repeats within itself", () => {
    const { tex } = buildRiffTex({ ...base, repeats: 3, tabs: [{ name: "G", tex: twice }] });
    expect(played(tex).masterBars).toEqual([0, 1, 0, 1, 2, 3, 2, 3, 4, 5, 4, 5]);
    expect(played(tex).endTick).toBe(3 * 4 * 3840);
  });

  it("a closing sign without an opening one repeats to the top of its own pass", () => {
    const closeOnly = gtr([note, `\\rc 2 ${note}`]);
    const one = played(buildRiffTex({ ...base, tabs: [{ name: "G", tex: closeOnly }] }).tex);
    expect(one.masterBars).toEqual([0, 1, 0, 1]);
    const two = played(buildRiffTex({ ...base, repeats: 2, tabs: [{ name: "G", tex: closeOnly }] }).tex);
    expect(two.masterBars).toEqual([0, 1, 0, 1, 2, 3, 2, 3]);
  });

  it("keeps alternate endings", () => {
    const endings = gtr([`\\ro ${note}`, `\\ae 1 \\rc 2 ${note}`, `\\ae 2 ${note}`]);
    const two = played(buildRiffTex({ ...base, repeats: 2, tabs: [{ name: "G", tex: endings }] }).tex);
    expect(two.masterBars).toEqual([0, 1, 0, 2, 3, 4, 3, 5]);
    expect(two.endTick).toBe(8 * 3840);
  });

  it("a mid-tab time signature: every pass of a section keeps the tab's meters", () => {
    const tab = gtr([note, `\\ts (3 4) 3.6 3.6 5.6`]);
    const once = buildRiffTex({ ...base, tabs: [{ name: "G", tex: tab }] }).tex;
    expect(meters(once)).toEqual(["4/4", "3/4"]);
    const twice = buildRiffTex({ ...base, repeats: 2, tabs: [{ name: "G", tex: tab }] }).tex;
    expect(meters(twice)).toEqual(["4/4", "3/4", "4/4", "3/4"]);
    // Two passes of 4 + 3 beats, and the clock rests through each bar exactly.
    expect(played(twice).endTick).toBe(14 * 960);
    expect(restCounts(importTex(twice).tracks[1])).toEqual([4, 3, 4, 3]);
  });
});

describe("buildRiffTex keeps a tab intact", () => {
  const beatCounts = (tex: string, track: number) =>
    importTex(tex).tracks[track].staves[0].bars.map((b: any) => b.voices[0].beats.length);
  it("a trailing // comment does not swallow the bar separator", () => {
    const t = `\\tuning (g2 d2 a1 e1)\n\\instrument 34\n.\n:4 0.4 0.4 0.4 0.4 // first\n|\n0.4 0.4 0.4 0.4 // second\n`;
    const { tex } = buildRiffTex({ ...base, tabs: [{ name: "Bass", tex: t }] });
    expect(importTex(tex).masterBars.length).toBe(2);
    expect(beatCounts(tex, 0)).toEqual([4, 4]);
    expect(beatCounts(tex, 1)).toEqual([4, 4]);
  });
  it("keeps tuning and instrument when the head is on one line", () => {
    const t = `\\tempo 90 \\tuning (g2 d2 a1 e1) \\instrument 34\n.\n:4 0.4 0.4 0.4 0.4\n`;
    const score = importTex(buildRiffTex({ ...base, tabs: [{ name: "Bass", tex: t }] }).tex);
    expect(score.tracks[0].staves[0].tuning.length).toBe(4);
    expect(score.tracks[0].playbackInfo.program).toBe(34);
    expect(score.tempo).toBe(120);
  });
  it("handles CRLF and a leading \\title", () => {
    const t = `\\title "Riff"\r\n` + gtr([note, note]).replace(/\n/g, "\r\n");
    const score = importTex(buildRiffTex({ ...base, tabs: [{ name: "G", tex: t }] }).tex);
    expect(score.masterBars.length).toBe(2);
    expect(score.tracks[0].staves[0].tuning.length).toBe(6);
    expect(score.tracks.length).toBe(2);
  });
});
