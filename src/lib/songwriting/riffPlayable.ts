import * as alphaTab from "@coderline/alphatab";
import type { RiffPart } from "@/types";
import { tabTexForPart, type RiffShape } from "./riffs";
import { buildSongTex, heardTabs, playedBars, type PlayedBars, type ScoreSection, type WrittenPass } from "./riffScore";
import type { Segment } from "./riffPlayback";

/** The score alphaTab reads from this AlphaTex (the importer `api.tex` uses: it throws on any error), or null. */
function readScore(tex: string): unknown | null {
  try {
    const importer = new alphaTab.importer.AlphaTexImporter();
    importer.initFromString(tex, new alphaTab.Settings());
    return importer.readScore();
  } catch {
    return null;
  }
}

/** Whether alphaTab can read this AlphaTex. */
export function texParses(tex: string): boolean {
  return readScore(tex) !== null;
}

type HeardPart = Pick<RiffPart, "id" | "kind" | "alphatex" | "audioPath" | "listen">;

/**
 * The tabs Play riff plays, by part id, each as the riff opens it in the
 * editor (`tabTexForPart`): in the riff's tuning — a bass in the one derived
 * from it (spec decisions 12 and 19) — whatever tuning the tab was saved in.
 */
export function heardTabTexts(riff: RiffShape & { parts: HeardPart[] }): { id: string; tex: string }[] {
  return heardTabs(riff.parts).map((p) => ({ id: p.id, tex: tabTexForPart(p, riff) }));
}

type SectionInput<T> = Omit<ScoreSection, "tabs"> & { tabs: T[] };

/**
 * The sections' combined score (one section for a riff) with every heard tab
 * alphaTab can read. The tab editor saves unparseable drafts on purpose, and
 * alphaTab rejects a whole score over one bad track, so a broken tab would
 * otherwise silence everything: the other tabs and (with no score to clock
 * them) the takes too. Such a tab is left out instead, and returned in
 * `broken`; `sections` holds the tabs kept, section by section, so tracks
 * still map to parts. `played` is what the score plays, its repeats and
 * endings taken, and `passes` the written passes in order.
 */
export function buildPlayableSongTex<T extends { name: string; tex: string }>(
  sections: SectionInput<T>[],
): { tex: string; sections: T[][]; broken: T[]; played: PlayedBars; passes: WrittenPass[] } {
  const whole = buildSongTex(sections);
  const score = readScore(whole.tex);
  if (score) return { tex: whole.tex, sections: sections.map((s) => s.tabs), broken: [], played: playedBars(score), passes: whole.passes };
  // Find the culprits: keep each tab whose addition still reads. Each build
  // is over the tabs kept so far, since a section's longest tab sets its bars.
  const kept: T[][] = sections.map(() => []);
  const broken: T[] = [];
  const withKept = () => sections.map((s, i) => ({ ...s, tabs: kept[i] }));
  let built = buildSongTex(withKept());
  let read = readScore(built.tex);
  sections.forEach((section, si) => {
    for (const tab of section.tabs) {
      kept[si].push(tab);
      const next = buildSongTex(withKept());
      const nextRead = readScore(next.tex);
      if (nextRead) {
        built = next;
        read = nextRead;
      } else {
        kept[si].pop();
        broken.push(tab);
      }
    }
  });
  // The clock track alone always reads; were it not to, nothing plays.
  return { tex: built.tex, sections: kept, broken, played: read ? playedBars(read) : { starts: [], masterBars: [], endTick: 0 }, passes: built.passes };
}

/** `buildPlayableSongTex` for one riff, written `repeats` times. */
export function buildPlayableRiffTex<T extends { name: string; tex: string }>(
  input: SectionInput<T>,
): { tex: string; tabs: T[]; broken: T[]; played: PlayedBars } {
  const { tex, sections, broken, played } = buildPlayableSongTex([input]);
  return { tex, tabs: sections[0], broken, played };
}

/**
 * The segments a played score falls into: one per written pass, from where
 * its first bar plays to where the next pass's does (or the end). Every pass
 * opens a repeat (buildSongTex), so a pass's bars play together, its repeats
 * taken. `firstBar` is the index of its first played bar, so the bar within
 * the pass can be shown.
 */
export function songSegments(played: PlayedBars, passes: readonly WrittenPass[]): Segment[] {
  const ranges: { from: number; to: number; section: number }[] = [];
  let offset = 0;
  for (const p of passes) {
    ranges.push({ from: offset, to: offset + p.bars, section: p.section });
    offset += p.bars;
  }
  const segments: (Segment & { pass: number })[] = [];
  played.masterBars.forEach((bar, i) => {
    const pass = ranges.findIndex((r) => bar >= r.from && bar < r.to);
    if (pass < 0) return;
    const last = segments[segments.length - 1];
    if (last && last.pass === pass) return;
    if (last) last.end = played.starts[i];
    segments.push({ start: played.starts[i], end: played.endTick, section: ranges[pass].section, firstBar: i, pass });
  });
  return segments.map(({ start, end, section, firstBar }) => ({ start, end, section, firstBar }));
}

/** What to tell the user about the tabs left out of the riff, or null. */
export function brokenTabsMessage(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]}'s tab has an error, so it is left out. Open it to fix it.`;
  const list = `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `The tabs of ${list} have errors, so they are left out. Open them to fix them.`;
}
