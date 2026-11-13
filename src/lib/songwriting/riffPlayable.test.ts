/* eslint-disable @typescript-eslint/no-explicit-any --
 * Test reads alphaTab model objects whose types are not worth restating.
 */
import { describe, expect, it } from "vitest";
import * as alphaTab from "@coderline/alphatab";
import { brokenTabsMessage, buildPlayableRiffTex, buildPlayableSongTex, heardTabTexts, songSegments, texParses } from "./riffPlayable";
import { buildRiffTex } from "./riffScore";
import { newPartTabTex } from "./riffs";
import { tuningMidi } from "./tunings";

const RIFF = { tempo: 120, tsNum: 4, tsDen: 4 };
const tab = (id: string, body: string) => ({ id, name: id, tex: `\\track "x"\n.\n${body}` });
const G1 = tab("Guitar 1", ":4 0.6 3.6 5.6 3.6 | 0.6 3.6 5.6 3.6 |");
const G2 = tab("Guitar 2", ":4 7.5 5.5 3.5 2.5 |");
/** An unclosed chord: the kind of draft the tab editor saves while you type. */
const BROKEN = tab("Bass", ":4 0.4 (3.4 |");
/** Reads, but string 6 on a two-string tuning: alphaTab rejects the score. */
const WRONG_STRING = { id: "Odd", name: "Odd", tex: "\\tuning e5 b4\n.\n:4 0.6 |" };

describe("texParses", () => {
  it("is whether alphaTab can read the score", () => {
    expect(texParses(buildRiffTex({ ...RIFF, tabs: [G1] }).tex)).toBe(true);
    expect(texParses(BROKEN.tex)).toBe(false);
    expect(texParses(WRONG_STRING.tex)).toBe(false);
  });

  it("one broken tab makes the whole combined score unreadable (why the tabs are checked)", () => {
    expect(texParses(buildRiffTex({ ...RIFF, tabs: [G1, BROKEN] }).tex)).toBe(false);
  });
});

describe("buildPlayableRiffTex", () => {
  it("is the plain combined score when every tab reads", () => {
    const out = buildPlayableRiffTex({ ...RIFF, tabs: [G1, G2] });
    expect(out.tex).toBe(buildRiffTex({ ...RIFF, tabs: [G1, G2] }).tex);
    expect(out.tabs).toEqual([G1, G2]);
    expect(out.broken).toEqual([]);
  });

  it("leaves out a tab alphaTab cannot read, keeping the others in order", () => {
    const out = buildPlayableRiffTex({ ...RIFF, tabs: [G1, BROKEN, G2] });
    expect(out.tabs.map((t) => t.id)).toEqual(["Guitar 1", "Guitar 2"]);
    expect(out.broken.map((t) => t.id)).toEqual(["Bass"]);
    expect(out.tex).toBe(buildRiffTex({ ...RIFF, tabs: [G1, G2] }).tex);
    expect(texParses(out.tex)).toBe(true);
  });

  it("leaves out a tab that only fails as a score (a note on a string the tuning lacks)", () => {
    const out = buildPlayableRiffTex({ ...RIFF, tabs: [WRONG_STRING, G2] });
    expect(out.tabs.map((t) => t.id)).toEqual(["Guitar 2"]);
    expect(out.broken.map((t) => t.id)).toEqual(["Odd"]);
  });

  it("with every tab broken it is the clock alone", () => {
    const out = buildPlayableRiffTex({ ...RIFF, tabs: [BROKEN, WRONG_STRING] });
    expect(out.tabs).toEqual([]);
    expect(out.broken.map((t) => t.id)).toEqual(["Bass", "Odd"]);
    expect(out.tex).toBe(buildRiffTex({ ...RIFF, tabs: [] }).tex);
    expect(texParses(out.tex)).toBe(true);
  });

  it("repeats the playable tabs too", () => {
    const out = buildPlayableRiffTex({ ...RIFF, tabs: [BROKEN, G1], repeats: 3 });
    expect(out.tex).toBe(buildRiffTex({ ...RIFF, tabs: [G1], repeats: 3 }).tex);
  });
});

describe("brokenTabsMessage", () => {
  it("names the parts left out", () => {
    expect(brokenTabsMessage([])).toBeNull();
    expect(brokenTabsMessage(["Guitar 2"])).toBe("Guitar 2's tab has an error, so it is left out. Open it to fix it.");
    expect(brokenTabsMessage(["Guitar 2", "Bass"])).toBe(
      "The tabs of Guitar 2 and Bass have errors, so they are left out. Open them to fix them.",
    );
    expect(brokenTabsMessage(["Guitar 1", "Guitar 2", "Bass"])).toBe(
      "The tabs of Guitar 1, Guitar 2 and Bass have errors, so they are left out. Open them to fix them.",
    );
  });
});

describe("heardTabTexts: the riff's tuning reaches playback", () => {
  const riff = { tempo: 100, tsNum: 4, tsDen: 4, tuning: "drop-c" };
  const part = (id: string, kind: "guitar" | "bass", alphatex: string) =>
    ({ id, kind, alphatex, audioPath: null, listen: "tab" as const });
  /** Saved while the riff was in E standard. */
  const guitar = newPartTabTex({ ...riff, tuning: "standard" }).replace("r.4 r r r", ":4 0.6 3.6 5.6 3.6");
  const bass = newPartTabTex({ ...riff, tuning: "standard" }, "bass").replace("r.4 r r r", ":4 0.4 3.4 5.4 3.4");
  /** Open strings, lowest first, of each track of the combined score. */
  const tunings = (tabs: { id: string; tex: string }[]) => {
    const { tex } = buildPlayableRiffTex({ ...riff, tabs: tabs.map((t) => ({ ...t, name: t.id })) });
    const importer = new alphaTab.importer.AlphaTexImporter();
    importer.initFromString(tex, new alphaTab.Settings());
    return (importer.readScore() as any).tracks.slice(0, -1).map((t: any) => [...t.staves[0].tuning].reverse());
  };

  it("a guitar tab saved in standard plays in the riff's drop C; a bass in the derived bass drop C", () => {
    const tabs = heardTabTexts({ ...riff, parts: [part("g", "guitar", guitar), part("b", "bass", bass)] });
    expect(tabs.map((t) => t.id)).toEqual(["g", "b"]);
    expect(tunings(tabs)).toEqual([tuningMidi("drop-c"), tuningMidi("bass-drop-c")]);
  });

  it("follows the riff when its tuning changes", () => {
    const tabs = heardTabTexts({ ...riff, tuning: "c-standard", parts: [part("g", "guitar", guitar), part("b", "bass", bass)] });
    expect(tunings(tabs)).toEqual([tuningMidi("c-standard"), tuningMidi("bass-c-standard")]);
  });

  it("only the parts heard as a tab", () => {
    const parts = [part("g", "guitar", guitar), { ...part("t", "guitar", guitar), audioPath: "x.webm", listen: "recording" as const }];
    expect(heardTabTexts({ ...riff, parts }).map((t) => t.id)).toEqual(["g"]);
  });
});

describe("songSegments: a pass is as long as it plays", () => {
  /** Two bars played twice. */
  const REPEATED = tab("Guitar 1", "\\ro :4 0.6 3.6 5.6 3.6 | \\rc 2 0.6 3.6 5.6 3.6 |");
  const segmentsOf = (sections: Parameters<typeof buildPlayableSongTex>[0]) => {
    const { played, passes } = buildPlayableSongTex(sections);
    return songSegments(played, passes);
  };

  it("a repeated tab: one pass is the four bars it plays, not its two written ones", () => {
    expect(segmentsOf([{ ...RIFF, tabs: [REPEATED] }])).toEqual([{ start: 0, end: 4 * 3840, section: 0, firstBar: 0 }]);
  });

  it("three times through (a song section ×3): each pass the same, the takes restart every four bars", () => {
    const segs = segmentsOf([{ ...RIFF, tabs: [REPEATED], repeats: 3 }]);
    expect(segs.map((s) => [s.start, s.end, s.firstBar])).toEqual([
      [0, 15360, 0],
      [15360, 30720, 4],
      [30720, 46080, 8],
    ]);
  });

  it("a song: each section's passes, at its own length, in order", () => {
    const segs = segmentsOf([
      { ...RIFF, tabs: [G1], repeats: 2 },
      { ...RIFF, tsNum: 3, tsDen: 4, tabs: [], takeSixteenths: 12 },
    ]);
    expect(segs).toEqual([
      { start: 0, end: 7680, section: 0, firstBar: 0 },
      { start: 7680, end: 15360, section: 0, firstBar: 2 },
      { start: 15360, end: 18240, section: 1, firstBar: 4 },
    ]);
  });

  it("a broken tab left out does not count, in whichever section", () => {
    const out = buildPlayableSongTex([{ ...RIFF, tabs: [G2] }, { ...RIFF, tabs: [BROKEN, G1] }]);
    expect(out.broken).toEqual([BROKEN]);
    expect(out.sections).toEqual([[G2], [G1]]);
    expect(songSegments(out.played, out.passes).map((s) => s.end - s.start)).toEqual([3840, 7680]);
  });
});
