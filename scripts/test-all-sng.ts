/**
 * Test: Parse all SNG files in a .psarc to verify parser robustness.
 * Run with: npx tsx scripts/test-all-sng.ts
 */
import { PSARC } from "../src/lib/rocksmith/psarcParser";
import { parseSNG } from "../src/lib/rocksmith/sngParser";
import * as path from "path";

const PSARC_FILE = path.join(__dirname, "..", "Behemoth_Chant-for-Eschaton-2000_v1_p.psarc");

async function main() {
  const psarc = new PSARC(PSARC_FILE);
  await psarc.parse();
  const files = psarc.getFiles();
  const sngFiles = psarc.findFiles(/\.sng$/);

  console.log(`Found ${sngFiles.length} SNG files\n`);

  for (const idx of sngFiles) {
    const name = files[idx];
    console.log(`=== ${name} ===`);
    const data = await psarc.readFile(idx);
    if (!data) { console.log("  FAILED to read"); continue; }

    try {
      const song = parseSNG(data);
      console.log(`  Beats: ${song.beats.length}`);
      console.log(`  Phrases: ${song.phrases.length} (${song.phrases.map(p => `"${p.name}" maxDiff=${p.maxDifficulty}`).join(', ')})`);
      console.log(`  Chords: ${song.chordTemplates.length}`);
      console.log(`  Sections: ${song.sections.length}`);
      console.log(`  Levels: ${song.levels.length}`);

      // Show total notes across all levels at max difficulty
      const maxDiff = song.metadata.maxDifficulty;
      const maxLevel = song.levels.find(l => l.difficulty === maxDiff);
      if (maxLevel) {
        console.log(`  Max diff level ${maxDiff}: ${maxLevel.notes.length} notes, ${maxLevel.anchors.length} anchors`);
      }

      // For the "true" full arrangement, gather notes from each phrase's max difficulty
      const allNotes: { time: number; string: number; fret: number; chordId: number }[] = [];
      for (const pi of song.phraseIterations) {
        const phrase = song.phrases[pi.phraseId];
        if (!phrase) continue;
        const targetDiff = phrase.maxDifficulty;
        const level = song.levels.find(l => l.difficulty === targetDiff);
        if (!level) continue;
        // Get notes in this phrase iteration's time range
        const piEnd = pi.endTime > 0 ? pi.endTime : Infinity;
        const notes = level.notes.filter(n => n.time >= pi.time && n.time < piEnd);
        allNotes.push(...notes.map(n => ({ time: n.time, string: n.string, fret: n.fret, chordId: n.chordId })));
      }
      allNotes.sort((a, b) => a.time - b.time);
      console.log(`  Full arrangement (merged): ${allNotes.length} notes`);
      if (allNotes.length > 0) {
        console.log(`  First note: t=${allNotes[0].time.toFixed(3)}s string=${allNotes[0].string} fret=${allNotes[0].fret}`);
        console.log(`  Last note: t=${allNotes[allNotes.length - 1].time.toFixed(3)}s`);
      }

      console.log(`  Metadata: length=${song.metadata.songLength.toFixed(1)}s tuning=[${song.metadata.tuning.join(',')}] maxDiff=${song.metadata.maxDifficulty}`);
      console.log(`  OK\n`);
    } catch (err) {
      console.log(`  PARSE ERROR: ${err}\n`);
    }
  }
}

main().catch(console.error);
