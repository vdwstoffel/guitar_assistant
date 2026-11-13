/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab's imported model is read through its untyped surface.
 */
import * as alphaTab from "@coderline/alphatab";
import type { RiffPart } from "@/types";

export interface MixState {
  level: number;
  muted: boolean;
  soloed: boolean;
}

/** Gain of each part: with any solo only soloed parts sound; muted is silent; else its level. */
export function effectiveGains(parts: MixState[]): number[] {
  const anySolo = parts.some((p) => p.soloed);
  return parts.map((m) => (m.muted || (anySolo && !m.soloed) ? 0 : m.level));
}

/** The name of the riff score's last track: silent, it keeps time for the takes and sets each bar's meter. */
export const CLOCK_TRACK = "Clock";

type Heard = Pick<RiffPart, "alphatex" | "audioPath" | "listen">;
const hasTab = (p: Heard) => !!p.alphatex && p.alphatex.trim() !== "";
const hasTake = (p: Heard) => !!p.audioPath;

/** Parts heard as a tab: it has a tab and (listen is tab, or it has no take). */
export function heardTabs<T extends Heard>(parts: T[]): T[] {
  return parts.filter((p) => hasTab(p) && (p.listen === "tab" || !hasTake(p)));
}

/** Parts heard as a take: it has a take and (listen is recording, or it has no tab). */
export function heardTakes<T extends Heard>(parts: T[]): T[] {
  return parts.filter((p) => hasTake(p) && (p.listen === "recording" || !hasTab(p)));
}

interface TabSplit {
  /** Metadata lines, minus \tempo and \ts (the riff rules both). */
  head: string[];
  /** One entry per bar, without the `|`. */
  bars: string[];
}

/** Split a tab's tex at its standalone `.` line; bars are cut at `|` outside strings and comments. */
function splitTab(tex: string): TabSplit {
  const lines = tex.replace(/\r\n?/g, "\n").split("\n");
  let dot = lines.findIndex((l) => l.trim() === ".");
  let headLines: string[];
  let bodyLines: string[];
  if (dot >= 0) {
    headLines = lines.slice(0, dot);
    bodyLines = lines.slice(dot + 1);
  } else {
    dot = lines.findIndex((l) => l.trim() !== "" && !l.trim().startsWith("\\"));
    if (dot < 0) dot = lines.length;
    headLines = lines.slice(0, dot);
    bodyLines = lines.slice(dot);
  }
  // Strip only the tokens the riff rules (tempo, time signature) or that are score-level
  // metadata; a one-line head keeps its tuning and instrument.
  const head = headLines
    .map((l) =>
      l
        .replace(/\\tempo\s+[\d.]+(\s+"[^"]*")?/g, "")
        .replace(/\\ts\s*(\([^)]*\)|\d+\s+\d+)/g, "")
        .replace(/\\(title|subtitle|artist|album|words|music|copyright|tab|instructions|notices)\s+("(?:[^"\\]|\\.)*"|\S+)/g, "")
        .trim(),
    )
    .filter((l) => l !== "");
  const bars: string[] = [];
  let cur = "";
  let inStr = false;
  let inLine = false;
  let inBlock = false;
  const body = bodyLines.join("\n");
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    const n = body[i + 1];
    if (inLine) { if (c === "\n") inLine = false; }
    else if (inBlock) { if (c === "*" && n === "/") { cur += "*/"; i++; inBlock = false; continue; } }
    else if (inStr) { if (c === "\\") { cur += c + (n ?? ""); i++; continue; } if (c === '"') inStr = false; }
    else if (c === '"') inStr = true;
    else if (c === "/" && n === "/") inLine = true;
    else if (c === "/" && n === "*") inBlock = true;
    else if (c === "|") { bars.push(cur); cur = ""; continue; }
    cur += c;
  }
  bars.push(cur);
  return { head, bars: bars.filter((b) => b.trim() !== "") };
}

type Meter = { num: number; den: number };

/** The bars a score plays, in playing order: its repeats and alternate endings taken, as alphaTab plays them. */
export interface PlayedBars {
  /** Start tick of each bar as it plays (a repeated bar is in here once for every time it plays). */
  starts: number[];
  /** Which master bar each of those is. */
  masterBars: number[];
  /** Where playing ends: the score's played length in ticks. */
  endTick: number;
}

/**
 * What alphaTab will play, read off its own MIDI generation (its tick lookup):
 * the player's ticks run through the repeats, so these are the ticks its
 * playhead reports.
 */
export function playedBars(score: any): PlayedBars {
  const generator = new alphaTab.midi.MidiFileGenerator(
    score,
    new alphaTab.Settings(),
    new alphaTab.midi.AlphaSynthMidiFileHandler(new alphaTab.midi.MidiFile()),
  );
  generator.generate();
  const bars: any[] = generator.tickLookup.masterBars;
  return {
    starts: bars.map((b) => b.start),
    masterBars: bars.map((b) => b.masterBar.index),
    endTick: bars.length > 0 ? bars[bars.length - 1].end : 0,
  };
}

/**
 * The master bars (meter of each) of one pass of the score. With tabs, they
 * are the longest tab's (ruling 1): a pass lasts as long as it PLAYS, its
 * repeats taken. With none (a riff of takes only), a pass lasts
 * `takeSixteenths` — whole bars of the riff's meter, then a shorter bar of
 * 16ths for what is left — so the takes loop at their own length.
 */
function structure(tabTexts: string[], riff: { tsNum: number; tsDen: number }, takeSixteenths: number): Meter[] {
  const riffMeter: Meter = { num: riff.tsNum, den: riff.tsDen };
  let meters: Meter[] = [];
  let longest: string | null = null;
  let longestBars = 0;
  for (const t of tabTexts) {
    const n = splitTab(t).bars.length;
    if (n > longestBars) { longestBars = n; longest = t; }
  }
  if (longest) {
    try {
      const importer = new alphaTab.importer.AlphaTexImporter();
      importer.initFromString(longest, new alphaTab.Settings());
      meters = importer.readScore().masterBars.map((m: any) => ({ num: m.timeSignatureNumerator, den: m.timeSignatureDenominator }));
    } catch {
      meters = [];
    }
    if (meters.length !== longestBars) meters = Array.from({ length: longestBars }, () => riffMeter);
    if (meters.length > 0) return meters;
  }
  const perBar = Math.max(1, Math.round((riffMeter.num * 16) / riffMeter.den));
  const total = Math.max(1, Math.round(takeSixteenths));
  meters = Array.from({ length: Math.floor(total / perBar) }, () => riffMeter);
  if (total % perBar > 0) meters.push({ num: total % perBar, den: 16 });
  return meters;
}

function restBar(m: Meter): string {
  return Array.from({ length: m.num }, (_, i) => (i === 0 ? `r.${m.den}` : "r")).join(" ");
}

/** One section of a played score: a riff's tabs (named by part), its tempo and metre, played `repeats` times. */
export interface ScoreSection {
  tempo: number;
  tsNum: number;
  tsDen: number;
  tabs: { name: string; tex: string }[];
  /** With no tabs: how long a pass is, in 16ths (the longest take's length). */
  takeSixteenths?: number;
  repeats?: number;
}

/** One pass of one section, as written: which section, and how many master bars it takes. */
export interface WrittenPass {
  section: number;
  bars: number;
}

/**
 * The sections' combined AlphaTex, back to back, so a song plays as one score
 * with no stop between sections: one track per tab name across all sections
 * (its tuning, instrument and notes, repeat signs and endings; its own tempo
 * and time signature dropped), resting through the sections it is not in,
 * then the silent clock track. A section's bars follow its longest tab (ruling
 * 1), shorter tabs padded with rest bars; with no tabs, a pass is
 * `takeSixteenths` long (one bar if not given). The clock track, written bar
 * by bar, sets every master bar's meter, opens a repeat at every pass and
 * states each section's tempo on its first bar. What it plays — repeats taken
 * — is `playedBars` of the imported score; `passes` lists the written passes
 * in order.
 */
export function buildSongTex(sections: ScoreSection[]): { tex: string; trackOrder: string[]; passes: WrittenPass[] } {
  const shapes = sections.map((sec) => {
    const repeats = Math.max(1, Math.floor(sec.repeats ?? 1));
    const perBar = Math.round((sec.tsNum * 16) / sec.tsDen);
    const once = structure(sec.tabs.map((t) => t.tex), sec, sec.takeSixteenths ?? perBar);
    return { repeats, once, tabs: new Map(sec.tabs.map((t) => [t.name, splitTab(t.tex)])) };
  });
  const passes: WrittenPass[] = shapes.flatMap((sh, section) => Array.from({ length: sh.repeats }, () => ({ section, bars: sh.once.length })));
  const ts = (m: Meter) => `\\ts (${m.num} ${m.den})`;
  const lines: string[] = [`\\tempo ${sections[0]?.tempo ?? 120}`];

  // Every tab name, in the order it first plays.
  const names = [...new Set(sections.flatMap((sec) => sec.tabs.map((t) => t.name)))];
  names.forEach((name, ti) => {
    const head = shapes.find((sh) => sh.tabs.has(name))!.tabs.get(name)!.head;
    const body: string[] = [];
    shapes.forEach((sh) => {
      const bars = sh.tabs.get(name)?.bars ?? [];
      for (let r = 0; r < sh.repeats; r++) sh.once.forEach((m, i) => body.push(i < bars.length ? bars[i].trim() : restBar(m)));
    });
    lines.push(`\\track ${JSON.stringify(name)}`, ...head);
    if (ti === 0) lines.push(ts(shapes[0].once[0]));
    lines.push(".", body.join("\n|\n") + "\n|");
  });

  lines.push(`\\track ${JSON.stringify(CLOCK_TRACK)}`);
  // The clock, written last, sets every master bar's meter: each bar states
  // its own, since a tab's mid-tab \ts (and the bars after it, which inherit
  // it) would otherwise carry into the next bar or the next pass. Each pass
  // opens a repeat, so a tab's closing sign without an opening one repeats to
  // the top of its own pass, never back into the pass before. And each
  // section states its tempo on its first bar.
  const clockBars: string[] = [];
  shapes.forEach((sh, si) => {
    for (let r = 0; r < sh.repeats; r++) {
      sh.once.forEach((m, i) => {
        const marks = `${i === 0 ? " \\ro" : ""}${r === 0 && i === 0 ? ` \\tempo ${sections[si].tempo}` : ""}`;
        clockBars.push(`${ts(m)}${marks}\n${restBar(m)}`);
      });
    }
  });
  lines.push(clockBars.join(" |\n") + " |");
  return { tex: lines.join("\n"), trackOrder: [...names, CLOCK_TRACK], passes };
}

/**
 * One riff's AlphaTex: `buildSongTex` with the riff as its only section,
 * written `repeats` times.
 */
export function buildRiffTex(input: ScoreSection): { tex: string; trackOrder: string[] } {
  const { tex, trackOrder } = buildSongTex([input]);
  return { tex, trackOrder };
}
