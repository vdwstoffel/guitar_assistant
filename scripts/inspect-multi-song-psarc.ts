#!/usr/bin/env tsx
/**
 * Inspect a multi-song PSARC file to understand file structure and audio organization.
 */
import * as path from "path";
import { PSARC } from "../src/lib/rocksmith/psarcParser";

const PSARC_FILE = path.join(__dirname, "..", "rs1compatibilitydisc_p.psarc");

async function main() {
  console.log("=== Multi-Song PSARC Inspector ===\n");
  console.log("File:", PSARC_FILE);

  const psarc = new PSARC(PSARC_FILE);
  await psarc.parse();

  const files = psarc.getFiles();
  console.log(`\nTotal files in archive: ${files.length}`);

  // Get arrangements
  const arrangements = await psarc.getArrangements();
  console.log(`Total arrangements: ${Object.keys(arrangements).length}`);

  // Group by song
  const songGroups = new Map<string, { persistentIDs: string[]; metadata: typeof arrangements[string] }>();

  for (const [persistentID, arr] of Object.entries(arrangements)) {
    const songKey = `${arr.artistName}|||${arr.songName}`;
    if (!songGroups.has(songKey)) {
      songGroups.set(songKey, { persistentIDs: [], metadata: arr });
    }
    songGroups.get(songKey)!.persistentIDs.push(persistentID);
  }

  console.log(`\nUnique songs: ${songGroups.size}`);
  console.log("\nSongs:");
  for (const [songKey, { persistentIDs, metadata }] of songGroups.entries()) {
    const [artist, song] = songKey.split("|||");
    console.log(`  ${artist} - ${song} (${persistentIDs.length} arrangements)`);
  }

  // Find all .wem files
  const wemFiles = files.filter(f => f.endsWith(".wem"));
  console.log(`\n.wem audio files: ${wemFiles.length}`);
  console.log("\nSample .wem files (first 10):");
  wemFiles.slice(0, 10).forEach(f => console.log(`  ${f}`));

  // Find all .sng files
  const sngFiles = files.filter(f => f.endsWith(".sng"));
  console.log(`\n.sng note files: ${sngFiles.length}`);
  console.log("\nSample .sng files (first 10):");
  sngFiles.slice(0, 10).forEach(f => console.log(`  ${f}`));

  // Find all .json files
  const jsonFiles = files.filter(f => f.endsWith(".json"));
  console.log(`\n.json manifest files: ${jsonFiles.length}`);
  console.log("\nSample .json files (first 5):");
  jsonFiles.slice(0, 5).forEach(f => console.log(`  ${f}`));

  // Check if persistent IDs appear in any filenames
  console.log("\n=== Testing Persistent ID Matching ===");
  const firstSong = Array.from(songGroups.values())[0];
  console.log(`\nTest song: ${firstSong.metadata.artistName} - ${firstSong.metadata.songName}`);
  console.log(`Persistent IDs for this song:`, firstSong.persistentIDs);

  console.log("\nChecking if persistent IDs appear in filenames:");
  for (const id of firstSong.persistentIDs) {
    const matchingSng = sngFiles.filter(f => f.includes(id));
    const matchingWem = wemFiles.filter(f => f.includes(id));
    const matchingJson = jsonFiles.filter(f => f.includes(id));

    console.log(`\n  ID: ${id}`);
    console.log(`    .sng matches: ${matchingSng.length} ${matchingSng.length > 0 ? `(${matchingSng[0]})` : ''}`);
    console.log(`    .wem matches: ${matchingWem.length} ${matchingWem.length > 0 ? `(${matchingWem[0]})` : ''}`);
    console.log(`    .json matches: ${matchingJson.length} ${matchingJson.length > 0 ? `(${matchingJson[0]})` : ''}`);
  }

  // Check if there are any patterns in the file structure
  console.log("\n=== File Organization Patterns ===");
  const uniqueDirs = new Set<string>();
  files.forEach(f => {
    const dir = path.dirname(f);
    if (dir !== ".") uniqueDirs.add(dir);
  });

  console.log(`\nUnique directories: ${uniqueDirs.size}`);
  console.log("Sample directories:");
  Array.from(uniqueDirs).slice(0, 15).forEach(d => console.log(`  ${d}`));

  // Try to find audio file references in metadata
  console.log("\n=== Checking Metadata for Audio References ===");
  const firstArr = Object.values(arrangements)[0];
  const audioKeys = Object.keys(firstArr.raw).filter(k =>
    k.toLowerCase().includes('audio') ||
    k.toLowerCase().includes('wem') ||
    k.toLowerCase().includes('sound') ||
    k.toLowerCase().includes('bank')
  );

  if (audioKeys.length > 0) {
    console.log("Audio-related keys found in metadata:");
    audioKeys.forEach(k => {
      console.log(`  ${k}: ${JSON.stringify(firstArr.raw[k]).slice(0, 100)}`);
    });
  } else {
    console.log("No obvious audio-related keys in metadata");
    console.log("\nAll metadata keys:");
    Object.keys(firstArr.raw).slice(0, 20).forEach(k => console.log(`  ${k}`));
  }

  console.log("\n=== Inspection Complete ===");
}

main().catch(console.error);
