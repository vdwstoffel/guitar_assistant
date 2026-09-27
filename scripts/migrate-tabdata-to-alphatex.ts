// One-off migration: convert legacy TabData JSON (stored in TrackTab.alphatex)
// to hand-written AlphaTex source, then leave every row as plain AlphaTex.
//
// The TabData conversion is inlined rather than imported from src/lib/tabData.ts,
// because Step 5 of this task deletes that file. Task 17 restores the database
// from a backup during its own verification, so this script must stay runnable
// afterwards.
//
// NOTE ON IMPORT PATH: the task brief specified `from "@prisma/client"`, but this
// repo's schema.prisma generates the client to a custom output path
// (`generator client { output = "../src/generated/prisma" }`), the same one
// src/lib/prisma.ts imports from. The bare `@prisma/client` package installed
// here does not contain the generated models (no TrackTab accessor), so this
// script imports the real generated client by relative path instead — mirroring
// the brief's own relative import of parseTex below.
import { PrismaClient } from "../src/generated/prisma/client";
import { parseTex } from "../src/lib/tabscore/parse";

const prisma = new PrismaClient();

interface TabBeat { strings: (number | null)[]; duration: number }
interface TabBar { beats: TabBeat[] }
interface TabData { _version: 1; tempo: number; timeSignature: string; defaultDuration: number; bars: TabBar[] }

function isTabDataJson(value: string | null): boolean {
  if (!value) return false;
  const t = value.trim();
  return t.startsWith("{") && t.includes('"_version"');
}

function parseTabData(value: string): TabData | null {
  try {
    const parsed = JSON.parse(value);
    if (parsed._version === 1 && Array.isArray(parsed.bars)) {
      if (parsed.slotsPerBar && !parsed.defaultDuration) parsed.defaultDuration = parsed.slotsPerBar;
      if (!parsed.defaultDuration) parsed.defaultDuration = 8;
      return parsed as TabData;
    }
    return null;
  } catch {
    return null;
  }
}

function tabDataToAlphaTex(data: TabData): string {
  const [num, den] = data.timeSignature.split("/").map(Number);
  const lines: string[] = [`\\tempo ${data.tempo}`];
  if (!(num === 4 && den === 4)) lines.push(`\\ts ${num} ${den}`);
  lines.push(".");

  const barStrings: string[] = [];
  for (const bar of data.bars) {
    const parts: string[] = [];
    for (const beat of bar.beats) {
      // strings[] index 0 = high e -> alphaTab string 1; index 5 = low E -> string 6
      const notes = beat.strings
        .map((fret, i) => (fret !== null ? `${fret}.${i + 1}` : null))
        .filter((x): x is string => x !== null);
      if (notes.length === 0) parts.push(`r.${beat.duration}`);
      else if (notes.length === 1) parts.push(`${notes[0]}.${beat.duration}`);
      else parts.push(`(${notes.join(" ")}).${beat.duration}`);
    }
    barStrings.push(parts.join(" "));
  }
  lines.push(barStrings.join(" | "));
  return lines.join("\n");
}

async function main() {
  const tabs = await prisma.trackTab.findMany();
  let migrated = 0;
  let skipped = 0;

  for (const tab of tabs) {
    if (!isTabDataJson(tab.alphatex)) {
      skipped++;
      continue;
    }
    const data = parseTabData(tab.alphatex!);
    if (!data) {
      console.error(`SKIP ${tab.id} (${tab.name}): unparseable TabData`);
      skipped++;
      continue;
    }
    const tex = tabDataToAlphaTex(data);
    const check = parseTex(tex);
    if (!check.ok) {
      console.error(`SKIP ${tab.id} (${tab.name}): converted tex does not parse`);
      console.error(check.diagnostics);
      skipped++;
      continue;
    }
    await prisma.trackTab.update({ where: { id: tab.id }, data: { alphatex: tex } });
    console.log(`OK   ${tab.name}`);
    migrated++;
  }

  console.log(`\nmigrated ${migrated}, skipped ${skipped}, total ${tabs.length}`);
}

main().finally(() => prisma.$disconnect());
