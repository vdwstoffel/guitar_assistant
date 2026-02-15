/**
 * Test: Parse the official DLC "Fear of the Dark" .psarc file.
 * This tests game-generated SNG (which may have symbols section even with 0 vocals).
 * Run with: npx tsx scripts/test-fear-of-dark.ts
 */
import { PSARC } from "../src/lib/rocksmith/psarcParser";
import { parseSNG } from "../src/lib/rocksmith/sngParser";
import * as path from "path";

const PSARC_FILE = path.join(__dirname, "..", "fearofthedark_p.psarc");

async function main() {
  console.log("=== Fear of the Dark - Official DLC Test ===\n");

  const psarc = new PSARC(PSARC_FILE);
  await psarc.parse();

  const files = psarc.getFiles();
  console.log(`Files in archive: ${files.length}`);
  files.forEach((f, i) => console.log(`  [${i}] ${f}`));

  const arrangements = await psarc.getArrangements();
  const firstArr = Object.values(arrangements)[0];
  if (firstArr) {
    console.log(`\nSong: ${firstArr.songName} by ${firstArr.artistName}`);
    console.log(`Tempo: ${firstArr.songAverageTempo} BPM, Length: ${firstArr.songLength.toFixed(1)}s`);
  }

  const sngFiles = psarc.findFiles(/\.sng$/);
  console.log(`\nSNG files: ${sngFiles.length}`);

  for (const idx of sngFiles) {
    const name = files[idx];
    console.log(`\n=== ${name} ===`);
    const data = await psarc.readFile(idx);
    if (!data) { console.log("  FAILED to read"); continue; }
    console.log(`  Size: ${data.length} bytes`);

    try {
      const song = parseSNG(data);
      console.log(`  Beats: ${song.beats.length}`);
      console.log(`  Phrases: ${song.phrases.length}`);
      console.log(`  Chords: ${song.chordTemplates.length}`);
      console.log(`  Sections: ${song.sections.length}`);
      for (const s of song.sections) {
        console.log(`    "${s.name}" #${s.number}: ${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s`);
      }
      console.log(`  Levels: ${song.levels.length}`);

      // Full arrangement
      const allNotes: { time: number; string: number; fret: number; chordId: number }[] = [];
      for (const pi of song.phraseIterations) {
        const phrase = song.phrases[pi.phraseId];
        if (!phrase) continue;
        const level = song.levels.find(l => l.difficulty === phrase.maxDifficulty);
        if (!level) continue;
        const piEnd = pi.endTime > 0 ? pi.endTime : Infinity;
        const notes = level.notes.filter(n => n.time >= pi.time && n.time < piEnd);
        allNotes.push(...notes.map(n => ({ time: n.time, string: n.string, fret: n.fret, chordId: n.chordId })));
      }
      allNotes.sort((a, b) => a.time - b.time);
      console.log(`  Full arrangement: ${allNotes.length} notes`);
      console.log(`  Metadata: length=${song.metadata.songLength.toFixed(1)}s tuning=[${song.metadata.tuning.join(',')}] capo=${song.metadata.capo} maxDiff=${song.metadata.maxDifficulty}`);
      console.log(`  OK`);
    } catch (err) {
      console.log(`  PARSE ERROR: ${err}`);
    }
  }
}

main().catch(console.error);
