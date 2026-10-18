/* eslint-disable @typescript-eslint/no-explicit-any --
 * Reads alphaTab's model and renders it, which has no published types here.
 */
import { describe, it, expect } from "vitest";
import * as alphaTabModule from "@coderline/alphatab";
import { styleBrokenBars, LONG_COLOR, SHORT_COLOR } from "./barStyles";
import { parseTex } from "./parse";

const alphaTab = alphaTabModule as any;
const { BarSubElement, BeatSubElement, NoteSubElement } = alphaTab.model;
const resources = () => new alphaTab.Settings().display.resources;
const enumSize = (e: Record<string, string | number>) => Object.values(e).filter((v) => typeof v === "number").length;

// exact | long by a quarter (only its last beat, a rest, does not fit) | short by a half
const TEX = "\\tempo 120\n.\n3.6.4 5.6 7.6 8.6 | 3.6.2 5.6.4 r r | 3.6.2\n";

function styled() {
  const score = parseTex(TEX).score;
  styleBrokenBars(alphaTab, score, resources());
  return score;
}
const barsOf = (score: any) => score.tracks[0].staves[0].bars;

describe("styleBrokenBars", () => {
  it("leaves a bar that adds up unstyled", () => {
    expect(barsOf(styled())[0].style ?? null).toBeNull();
  });

  it("colours a long bar's lines and number red, a short bar's amber", () => {
    const bars = barsOf(styled());
    for (const element of ["GuitarTabsStaffLine", "GuitarTabsBarLines", "GuitarTabsBarNumber"]) {
      expect(bars[1].style.colors.get(BarSubElement[element]).rgba, element).toBe(LONG_COLOR);
      expect(bars[2].style.colors.get(BarSubElement[element]).rgba, element).toBe(SHORT_COLOR);
    }
  });

  it("gives every sub-element an explicit colour, the defaults from the resources — never a gap, never null", () => {
    const res = resources();
    const bar = barsOf(styled())[1];
    expect(bar.style.colors.size).toBe(enumSize(BarSubElement));
    expect([...bar.style.colors.values()].every((c: any) => c && typeof c.rgba === "string")).toBe(true);
    expect(bar.style.colors.get(BarSubElement.GuitarTabsClef).rgba).toBe(res.mainGlyphColor.rgba);
    const beat = bar.voices[0].beats[3];
    expect(beat.style.colors.size).toBe(enumSize(BeatSubElement));
    expect(beat.style.colors.get(BeatSubElement.GuitarTabStem).rgba).toBe(res.mainGlyphColor.rgba);
  });

  it("colours the frets and rests that do not fit, and nothing else in the bar", () => {
    const beats = barsOf(styled())[1].voices[0].beats;
    expect(beats[3].style.colors.get(BeatSubElement.GuitarTabRests).rgba).toBe(LONG_COLOR);
    expect(beats.slice(0, 3).map((b: any) => b.style ?? null)).toEqual([null, null, null]);
    for (const note of beats[0].notes) expect(note.style ?? null).toBeNull();

    const over = parseTex("\\tempo 120\n.\n3.6.2 5.6.2{d}\n").score;
    styleBrokenBars(alphaTab, over, resources());
    const note = barsOf(over)[0].voices[0].beats[1].notes[0];
    expect(note.style.colors.get(NoteSubElement.GuitarTabFretNumber).rgba).toBe(LONG_COLOR);
    expect(note.style.colors.size).toBe(enumSize(NoteSubElement));
  });

  it("survives the render worker's serializer: bar, beat and note styles", () => {
    const roundTrip = (score: any) =>
      alphaTab.model.JsonConverter.jsObjectToScore(alphaTab.model.JsonConverter.scoreToJsObject(score), new alphaTab.Settings());
    const back = roundTrip(styled());
    expect(barsOf(back)[1].style.colors.get(BarSubElement.GuitarTabsStaffLine).rgba).toBe(LONG_COLOR);
    expect(barsOf(back)[1].voices[0].beats[3].style.colors.get(BeatSubElement.GuitarTabRests).rgba).toBe(LONG_COLOR);
    const over = parseTex("\\tempo 120\n.\n3.6.2 5.6.2{d}\n").score;
    styleBrokenBars(alphaTab, over, resources());
    const note = barsOf(roundTrip(over))[0].voices[0].beats[1].notes[0];
    expect(note.style.colors.get(NoteSubElement.GuitarTabFretNumber).rgba).toBe(LONG_COLOR);
  });

  it("draws in colour without moving anything, and only the broken bars", () => {
    const render = (score: any) => {
      for (const staff of score.tracks[0].staves) staff.showStandardNotation = false;
      const settings = new alphaTab.Settings();
      settings.core.engine = "svg";
      settings.core.enableLazyLoading = false;
      const renderer = new alphaTab.rendering.ScoreRenderer(settings);
      renderer.width = 1200;
      let svg = "";
      renderer.partialRenderFinished.on((r: any) => (svg += r.renderResult ?? ""));
      renderer.renderScore(score, [0]);
      return svg;
    };
    const plain = render(parseTex(TEX).score);
    const coloured = render(styled());
    const strip = (svg: string) => svg.replace(/ fill="#[0-9A-F]{6}"/g, "");
    expect(strip(coloured)).toBe(strip(plain));
    expect(coloured).toContain(`fill="${LONG_COLOR}"`);
    expect(coloured).toContain(`fill="${SHORT_COLOR}"`);
    // bar 1 keeps alphaTab's own bar number colour
    expect(coloured).toMatch(/fill="#C80000">1 /);

    // Element by element (the two drawings match but for fills): whatever changed colour became red
    // or amber, and the bar that adds up keeps alphaTab's grey staff lines and dark bar lines.
    const fills = (svg: string) => svg.split("<").map((element) => / fill="(#[0-9A-F]{6})"/.exec(element)?.[1] ?? null);
    const [before, after] = [fills(plain), fills(coloured)];
    expect(after.filter((fill, i) => fill !== before[i] && fill !== LONG_COLOR && fill !== SHORT_COLOR)).toEqual([]);
    const res = resources();
    expect(after).toContain(res.staffLineColor.rgba);
    expect(after).toContain(res.barSeparatorColor.rgba);
    // Only a rest overflows bar 2: the one red number drawn is the bar's own, no fret
    const redDigits = [...coloured.matchAll(new RegExp(`<text[^>]*fill="${LONG_COLOR}"[^>]*>([^<]*)`, "g"))]
      .map((match) => match[1].trim())
      .filter((content) => /^\d+$/.test(content));
    expect(redDigits).toEqual(["2"]);
  });
});
