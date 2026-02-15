/**
 * Spike test: Parse a .psarc file, extract SNG data, inspect note content.
 * Run with: npx tsx scripts/test-psarc.ts
 */
import { PSARC } from "../src/lib/rocksmith/psarcParser";
import { parseSNG, getMaxDifficultyLevel } from "../src/lib/rocksmith/sngParser";
import * as path from "path";

const PSARC_FILE = path.join(
  __dirname,
  "..",
  "Behemoth_Chant-for-Eschaton-2000_v1_p.psarc"
);

async function main() {
  console.log("=== PSARC + SNG Parser Spike Test ===\n");
  console.log("File:", PSARC_FILE);

  const psarc = new PSARC(PSARC_FILE);
  await psarc.parse();

  const files = psarc.getFiles();
  console.log(`Files in archive: ${files.length}`);

  // Get arrangements metadata from JSON
  const arrangements = await psarc.getArrangements();
  const firstArr = Object.values(arrangements)[0];
  if (firstArr) {
    console.log(`\nSong: ${firstArr.songName} by ${firstArr.artistName}`);
    console.log(`Tempo: ${firstArr.songAverageTempo} BPM, Length: ${firstArr.songLength.toFixed(1)}s`);
  }

  // Parse the lead SNG file
  const sngFiles = psarc.findFiles(/\.sng$/);
  console.log(`\n--- SNG files: ${sngFiles.length} ---`);
  for (const idx of sngFiles) {
    console.log(`  ${files[idx]}`);
  }

  // Parse the first SNG (lead arrangement)
  if (sngFiles.length === 0) {
    console.log("No SNG files found!");
    return;
  }

  const leadIdx = sngFiles[0];
  console.log(`\n=== Parsing SNG: ${files[leadIdx]} ===`);
  const sngData = await psarc.readFile(leadIdx);
  if (!sngData) {
    console.log("Failed to read SNG file");
    return;
  }

  console.log(`SNG size: ${sngData.length} bytes`);

  try {
    const song = parseSNG(sngData);

    console.log(`\n--- Beats: ${song.beats.length} ---`);
    if (song.beats.length > 0) {
      console.log(`  First beat: time=${song.beats[0].time.toFixed(3)}s, measure=${song.beats[0].measure}, beat=${song.beats[0].beat}`);
      console.log(`  Last beat: time=${song.beats[song.beats.length - 1].time.toFixed(3)}s`);
    }

    console.log(`\n--- Phrases: ${song.phrases.length} ---`);
    song.phrases.slice(0, 5).forEach((p) =>
      console.log(`  "${p.name}" maxDiff=${p.maxDifficulty} solo=${p.solo}`)
    );
    if (song.phrases.length > 5) console.log(`  ... (${song.phrases.length - 5} more)`);

    console.log(`\n--- Chord Templates: ${song.chordTemplates.length} ---`);
    song.chordTemplates.slice(0, 5).forEach((ct) =>
      console.log(`  "${ct.name}" frets=[${ct.frets.join(',')}]`)
    );

    console.log(`\n--- Sections: ${song.sections.length} ---`);
    song.sections.forEach((s) =>
      console.log(`  "${s.name}" #${s.number}: ${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s`)
    );

    console.log(`\n--- Phrase Iterations: ${song.phraseIterations.length} ---`);
    song.phraseIterations.slice(0, 5).forEach((pi) =>
      console.log(`  phraseId=${pi.phraseId}, time=${pi.time.toFixed(2)}s`)
    );

    console.log(`\n--- Levels: ${song.levels.length} ---`);
    song.levels.forEach((l) =>
      console.log(`  Difficulty ${l.difficulty}: ${l.notes.length} notes, ${l.anchors.length} anchors`)
    );

    // Get highest difficulty level
    const maxLevel = getMaxDifficultyLevel(song);
    if (maxLevel) {
      console.log(`\n--- Max Difficulty Level (${maxLevel.difficulty}) ---`);
      console.log(`  Notes: ${maxLevel.notes.length}`);
      console.log(`  Anchors: ${maxLevel.anchors.length}`);

      // Show first 10 notes
      console.log(`\n  First 10 notes:`);
      maxLevel.notes.slice(0, 10).forEach((n) => {
        const techniques: string[] = [];
        if (n.slideTo > 0) techniques.push(`slide→${n.slideTo}`);
        if (n.tap) techniques.push('tap');
        if (n.vibrato) techniques.push('vibrato');
        if (n.sustain > 0) techniques.push(`sustain=${n.sustain.toFixed(2)}s`);
        if (n.maxBend > 0) techniques.push(`bend=${n.maxBend}`);
        if (n.slap > 0) techniques.push('slap');
        if (n.pluck > 0) techniques.push('pluck');
        const isChord = n.chordId >= 0;
        const techStr = techniques.length > 0 ? ` [${techniques.join(', ')}]` : '';
        if (isChord) {
          const ct = song.chordTemplates[n.chordId];
          console.log(`    t=${n.time.toFixed(3)}s chord="${ct?.name}" frets=[${ct?.frets.join(',')}]${techStr}`);
        } else {
          console.log(`    t=${n.time.toFixed(3)}s string=${n.string} fret=${n.fret}${techStr}`);
        }
      });
    }

    console.log(`\n--- Metadata ---`);
    console.log(`  Song length: ${song.metadata.songLength.toFixed(1)}s`);
    console.log(`  Capo: ${song.metadata.capo}`);
    console.log(`  Tuning: [${song.metadata.tuning.join(', ')}]`);
    console.log(`  Max difficulty: ${song.metadata.maxDifficulty}`);
    console.log(`  First note time: ${song.metadata.firstNoteTime.toFixed(3)}s`);
    console.log(`  Max score: ${song.metadata.maxScore}`);

  } catch (err) {
    console.error("SNG parsing failed:", err);
    console.log("\nFirst 128 bytes of SNG data:");
    console.log(sngData.subarray(0, 128).toString("hex"));
  }

  console.log("\n=== Spike test complete ===");
}

main().catch(console.error);
