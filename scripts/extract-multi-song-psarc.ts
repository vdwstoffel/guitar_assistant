#!/usr/bin/env tsx
/**
 * Standalone extraction script for multi-song PSARC files.
 * Extracts to a separate output folder (not the app directory).
 *
 * Usage:
 *   npx tsx scripts/extract-multi-song-psarc.ts <psarc-file> [output-dir]
 *
 * Example:
 *   npx tsx scripts/extract-multi-song-psarc.ts rs1compatibilitydisc_p.psarc ./rocksmith_extracted
 */

import * as fs from "fs/promises";
import * as path from "path";
import { PSARC } from "../src/lib/rocksmith/psarcParser";
import { parseSNG } from "../src/lib/rocksmith/sngParser";
import { generateAlphaTex, generateSyncData, getBPM } from "../src/lib/rocksmith/sngToAlphatex";
import { convertWemToOgg } from "../src/lib/rocksmith/audioConverter";

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: npx tsx scripts/extract-multi-song-psarc.ts <psarc-file> [output-dir]");
    process.exit(1);
  }

  const psarcPath = path.resolve(args[0]);
  const outputDir = args[1] ? path.resolve(args[1]) : path.join(process.cwd(), "rocksmith_extracted");

  console.log(`\n📦 Extracting multi-song PSARC: ${psarcPath}`);
  console.log(`📂 Output directory: ${outputDir}\n`);

  // Parse PSARC
  const psarc = new PSARC(psarcPath);
  await psarc.parse();

  const allFiles = psarc.getFiles();
  const arrangements = await psarc.getArrangements();

  if (Object.keys(arrangements).length === 0) {
    console.error("❌ No arrangements found in PSARC file");
    process.exit(1);
  }

  // Group arrangements by song
  const songGroups = new Map<string, { persistentIDs: string[]; metadata: typeof arrangements[string] }>();

  for (const [persistentID, arr] of Object.entries(arrangements)) {
    const songKey = `${arr.artistName}|||${arr.songName}`;
    if (!songGroups.has(songKey)) {
      songGroups.set(songKey, { persistentIDs: [], metadata: arr });
    }
    songGroups.get(songKey)!.persistentIDs.push(persistentID);
  }

  // Filter out songs with empty names
  const validSongs = Array.from(songGroups.entries()).filter(([key]) => {
    const [artist, song] = key.split("|||");
    return artist && song && artist.trim() !== "" && song.trim() !== "";
  });

  console.log(`✅ Found ${validSongs.length} valid songs`);

  // Create output directory structure
  const songsDir = path.join(outputDir, "songs");
  const audioDir = path.join(outputDir, "_audio_files");
  await fs.mkdir(songsDir, { recursive: true });
  await fs.mkdir(audioDir, { recursive: true });

  // Step 1: Extract ALL audio files to shared folder
  console.log(`\n🎵 Extracting audio files...`);
  const wemFiles = allFiles.filter(f => f.endsWith(".wem"));
  console.log(`Found ${wemFiles.length} audio files`);

  const audioMetadata: { filename: string; duration: number; sizeMB: number }[] = [];

  for (let i = 0; i < allFiles.length; i++) {
    if (!allFiles[i].endsWith(".wem")) continue;

    const wemData = await psarc.readFile(i);
    if (!wemData) continue;

    try {
      const oggData = await convertWemToOgg(wemData);
      const wemId = path.basename(allFiles[i], ".wem");
      const oggFilename = `${wemId}.ogg`;
      const oggPath = path.join(audioDir, oggFilename);

      await fs.writeFile(oggPath, oggData);

      // Estimate duration from file size (rough approximation)
      const sizeMB = oggData.length / (1024 * 1024);
      const estimatedDuration = sizeMB * 60; // ~1 minute per MB at typical bitrates

      audioMetadata.push({
        filename: oggFilename,
        duration: estimatedDuration,
        sizeMB: Number(sizeMB.toFixed(2)),
      });
    } catch (err) {
      console.log(`  ⚠️  Failed to convert ${allFiles[i]}: ${err}`);
    }
  }

  console.log(`✅ Extracted ${audioMetadata.length} audio files to _audio_files/`);

  // Sort audio files by size (larger = full song, smaller = preview)
  audioMetadata.sort((a, b) => b.sizeMB - a.sizeMB);

  // Save audio metadata
  const audioIndexPath = path.join(audioDir, "AUDIO_INDEX.txt");
  let audioIndex = `# Audio Files Index\n\n`;
  audioIndex += `Total files: ${audioMetadata.length}\n\n`;
  audioIndex += `Files sorted by size (larger = full song, smaller = preview):\n\n`;

  audioMetadata.forEach((audio, i) => {
    audioIndex += `${i + 1}. ${audio.filename}\n`;
    audioIndex += `   Size: ${audio.sizeMB} MB\n`;
    audioIndex += `   Estimated duration: ${Math.floor(audio.duration / 60)}:${String(Math.floor(audio.duration % 60)).padStart(2, "0")}\n\n`;
  });

  await fs.writeFile(audioIndexPath, audioIndex, "utf-8");

  // Step 2: Extract songs with tabs
  console.log(`\n📁 Extracting songs...`);
  let successCount = 0;
  let failCount = 0;

  // Build song duration index for matching
  const songDurations: { song: string; duration: number }[] = [];

  for (const [songKey, { metadata }] of validSongs) {
    const [artistName, songName] = songKey.split("|||");
    songDurations.push({
      song: `${artistName} - ${songName}`,
      duration: metadata.songLength || 0,
    });
  }

  for (const [songKey, { persistentIDs, metadata }] of validSongs) {
    const [artistName, songName] = songKey.split("|||");
    const songTitle = songName || "Unknown Song";
    const artist = artistName || "Unknown Artist";

    console.log(`\n📁 ${artist} - ${songTitle}`);

    try {
      const folderName = sanitizeName(`${artist} - ${songTitle}`);
      const trackFolder = path.join(songsDir, folderName);
      await fs.mkdir(trackFolder, { recursive: true });

      // Find all SNG files for this song
      const songNameSlug = songTitle
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .replace(/\s+/g, "");

      const sngIndices: number[] = [];
      for (let i = 0; i < allFiles.length; i++) {
        const filePath = allFiles[i];
        if (!filePath.endsWith(".sng")) continue;

        const filename = path.basename(filePath, ".sng");
        const fileSlug = filename.split("_")[0].toLowerCase();

        if (
          songNameSlug.includes(fileSlug) ||
          fileSlug.includes(songNameSlug) ||
          fileSlug === songNameSlug
        ) {
          sngIndices.push(i);
        }
      }

      if (sngIndices.length === 0) {
        console.log(`  ⚠️  No tabs found, skipping`);
        failCount++;
        continue;
      }

      let extractedCount = 0;
      for (const sngIdx of sngIndices) {
        const sngName = allFiles[sngIdx];
        const basename = path.basename(sngName, ".sng");
        const parts = basename.split("_");
        const arrName = parts[parts.length - 1];

        if (arrName === "vocals") continue;

        try {
          const sngData = await psarc.readFile(sngIdx);
          if (!sngData) continue;

          const song = parseSNG(sngData);
          const displayName = arrName.charAt(0).toUpperCase() + arrName.slice(1);
          const alphaTex = generateAlphaTex(song, displayName, songTitle, artist);

          const atexFileName = `${sanitizeName(arrName)}.alphatex`;
          const atexPath = path.join(trackFolder, atexFileName);
          await fs.writeFile(atexPath, alphaTex, "utf-8");

          const syncData = generateSyncData(song);
          const syncFileName = `${sanitizeName(arrName)}.sync.json`;
          const syncPath = path.join(trackFolder, syncFileName);
          await fs.writeFile(syncPath, JSON.stringify(syncData), "utf-8");

          extractedCount++;
        } catch (err) {
          console.log(`    ❌ Failed ${arrName}: ${err}`);
        }
      }

      if (extractedCount > 0) {
        // Create README with audio matching hints
        const songDuration = metadata.songLength || 0;
        const songDurationStr = `${Math.floor(songDuration / 60)}:${String(Math.floor(songDuration % 60)).padStart(2, "0")}`;

        const readme = `# ${artist} - ${songTitle}

## Song Info
- Duration: ${songDurationStr}
- BPM: ${Math.round(metadata.songAverageTempo || 0)}
- Album: ${metadata.albumName || "Unknown"}

## Extracted Content
- ${extractedCount} tab arrangement(s) (AlphaTex format)

## Adding Audio
Audio files are in the "_audio_files" folder.
Song duration is ${songDurationStr} - look for audio files around ${(songDuration / 60).toFixed(1)} minutes.

Steps:
1. Find the matching audio file in _audio_files/ (check AUDIO_INDEX.txt)
2. Copy it to this folder
3. Rename it to match the song (e.g., "${sanitizeName(songTitle)}.ogg")
`;

        await fs.writeFile(path.join(trackFolder, "README.txt"), readme, "utf-8");
        console.log(`  ✅ ${extractedCount} arrangements`);
        successCount++;
      } else {
        await fs.rm(trackFolder, { recursive: true, force: true });
        failCount++;
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err}`);
      failCount++;
    }
  }

  // Create master README
  const masterReadme = `# Rocksmith Song Extract

Extracted ${successCount} songs from PSARC file.

## Directory Structure
- \`songs/\` - Individual song folders with tabs (.alphatex files)
- \`_audio_files/\` - All audio files (${audioMetadata.length} files)

## Next Steps
1. Match audio files to songs (check AUDIO_INDEX.txt in _audio_files/)
2. Copy the correct .ogg file into each song folder
3. Copy the entire \`songs/\` folder to your app's \`music/JamTracks/\` directory
4. Run "Scan Library" in the app

## Matching Tips
- Check song duration in each README.txt
- Larger audio files (>3MB) are usually full songs
- Smaller files (<1MB) are previews
- Audio files are named by Wwise IDs, not song names
`;

  await fs.writeFile(path.join(outputDir, "README.txt"), masterReadme, "utf-8");

  console.log(`\n${"=".repeat(60)}`);
  console.log(`✅ Successfully extracted: ${successCount} songs`);
  console.log(`🎵 Extracted: ${audioMetadata.length} audio files`);
  if (failCount > 0) {
    console.log(`❌ Failed: ${failCount} songs`);
  }
  console.log(`\n📂 Output: ${outputDir}`);
  console.log(`\n📋 Next steps:`);
  console.log(`   1. Check _audio_files/AUDIO_INDEX.txt`);
  console.log(`   2. Match and copy audio files to song folders`);
  console.log(`   3. Copy songs/ folder to music/JamTracks/`);
  console.log(`   4. Run "Scan Library" in app`);
  console.log(`${"=".repeat(60)}\n`);
}

main().catch(console.error);
