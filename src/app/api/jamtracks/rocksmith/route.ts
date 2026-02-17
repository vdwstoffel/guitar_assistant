import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";
import { PSARC } from "@/lib/rocksmith/psarcParser";
import { parseSNG } from "@/lib/rocksmith/sngParser";
import { generateAlphaTex, generateSyncData, getBPM } from "@/lib/rocksmith/sngToAlphatex";
import { convertWemToOgg, findFullSongWem } from "@/lib/rocksmith/audioConverter";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
const JAM_TRACKS_FOLDER = "JamTracks";

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}

/**
 * Extract and import a single song from the PSARC archive
 */
async function extractSong(
  psarc: PSARC,
  songTitle: string,
  artistName: string,
  persistentIDs: string[],
  allFiles: string[],
  musicPath: string
) {
  const folderName = sanitizeName(`${artistName} - ${songTitle}`);
  const jamTracksPath = path.join(musicPath, JAM_TRACKS_FOLDER);
  const trackFolder = path.join(jamTracksPath, folderName);
  await fs.mkdir(trackFolder, { recursive: true });

  // If re-importing, delete the old JamTrack record (cascade deletes pdfs/markers)
  const existingTitle = `${artistName} - ${songTitle}`;
  const existing = await prisma.jamTrack.findFirst({
    where: { title: existingTitle },
  });
  if (existing) {
    await prisma.jamTrack.delete({ where: { id: existing.id } });
  }

  // Find all SNG files for this song (match by persistent ID in filename)
  const sngIndices: number[] = [];
  for (let i = 0; i < allFiles.length; i++) {
    const filePath = allFiles[i];
    if (filePath.endsWith(".sng") && persistentIDs.some((id) => filePath.includes(id))) {
      sngIndices.push(i);
    }
  }

  // Find all WEM audio files for this song
  // Note: WEM files might not contain persistent IDs in their paths
  // Log all WEM files to understand the structure
  const allWemFiles: string[] = [];
  for (let i = 0; i < allFiles.length; i++) {
    if (allFiles[i].endsWith(".wem")) {
      allWemFiles.push(allFiles[i]);
    }
  }

  console.log(`DEBUG: Total .wem files in archive: ${allWemFiles.length}`);
  console.log(`DEBUG: Sample .wem filenames:`, allWemFiles.slice(0, 5));
  console.log(`DEBUG: Looking for audio for "${songTitle}" with IDs:`, persistentIDs);

  const wemIndices: number[] = [];
  for (let i = 0; i < allFiles.length; i++) {
    const filePath = allFiles[i];
    if (filePath.endsWith(".wem") && persistentIDs.some((id) => filePath.includes(id))) {
      wemIndices.push(i);
    }
  }

  console.log(`DEBUG: Matched ${wemIndices.length} .wem files for this song`);
  if (wemIndices.length > 0) {
    console.log(`DEBUG: Matched files:`, wemIndices.map(i => allFiles[i]));
  }

  // Extract and convert audio (.wem → .ogg)
  const wemFiles: { index: number; name: string; size: number }[] = [];
  for (const idx of wemIndices) {
    const data = await psarc.readFile(idx);
    wemFiles.push({ index: idx, name: allFiles[idx], size: data?.length || 0 });
  }

  const fullSongWem = findFullSongWem(wemFiles);
  let audioRelativePath = "";
  let audioDuration = 0;

  if (fullSongWem) {
    const wemData = await psarc.readFile(fullSongWem.index);
    if (wemData) {
      try {
        const oggData = await convertWemToOgg(wemData);
        const audioFileName = `${sanitizeName(songTitle)}.ogg`;
        const audioPath = path.join(trackFolder, audioFileName);
        await fs.writeFile(audioPath, oggData);
        audioRelativePath = path.join(JAM_TRACKS_FOLDER, folderName, audioFileName);
        // Duration will be set from arrangement metadata below
      } catch (audioErr) {
        console.error(`Audio conversion failed for ${songTitle}:`, audioErr);
        throw new Error(`Failed to extract audio for ${songTitle}`);
      }
    }
  }

  if (!audioRelativePath) {
    throw new Error(`No audio found for ${songTitle}`);
  }

  // Parse SNG files and generate AlphaTex for each arrangement
  const alphatexFiles: { name: string; relativePath: string; sortOrder: number }[] = [];
  const sectionMarkers: { name: string; timestamp: number }[] = [];
  let bpm = 0;

  for (let sortOrder = 0; sortOrder < sngIndices.length; sortOrder++) {
    const sngIdx = sngIndices[sortOrder];
    const sngName = allFiles[sngIdx];

    // Determine arrangement name from filename
    const basename = path.basename(sngName, ".sng");
    const parts = basename.split("_");
    const arrName = parts[parts.length - 1]; // e.g., "lead", "rhythm", "bass", "vocals"

    // Skip vocals arrangement
    if (arrName === "vocals") continue;

    try {
      const sngData = await psarc.readFile(sngIdx);
      if (!sngData) continue;

      const song = parseSNG(sngData);
      const displayName = arrName.charAt(0).toUpperCase() + arrName.slice(1);
      const alphaTex = generateAlphaTex(song, displayName, songTitle, artistName);

      // Save AlphaTex file
      const atexFileName = `${sanitizeName(arrName)}.alphatex`;
      const atexPath = path.join(trackFolder, atexFileName);
      await fs.writeFile(atexPath, alphaTex, "utf-8");

      // Save sync data (beat grid mapping for accurate cursor sync)
      const syncData = generateSyncData(song);
      const syncFileName = `${sanitizeName(arrName)}.sync.json`;
      const syncPath = path.join(trackFolder, syncFileName);
      await fs.writeFile(syncPath, JSON.stringify(syncData), "utf-8");

      alphatexFiles.push({
        name: displayName,
        relativePath: path.join(JAM_TRACKS_FOLDER, folderName, atexFileName),
        sortOrder,
      });

      // Extract sections from the first arrangement for markers
      if (sectionMarkers.length === 0 && song.sections.length > 0) {
        for (const section of song.sections) {
          sectionMarkers.push({
            name: section.name,
            timestamp: section.startTime,
          });
        }
      }

      if (!bpm) {
        bpm = getBPM(song);
      }

      if (!audioDuration && song.metadata.songLength) {
        audioDuration = song.metadata.songLength;
      }
    } catch (sngErr) {
      console.error(`Failed to parse SNG ${sngName}:`, sngErr);
    }
  }

  if (alphatexFiles.length === 0) {
    throw new Error(`Failed to parse any arrangements for ${songTitle}`);
  }

  // Create JamTrack and related records in database
  const jamTrack = await prisma.jamTrack.create({
    data: {
      title: `${artistName} - ${songTitle}`,
      filePath: audioRelativePath,
      duration: audioDuration,
      tempo: bpm || null,
      timeSignature: "4/4",
      pdfs: {
        create: alphatexFiles.map((atex) => ({
          name: atex.name,
          filePath: atex.relativePath,
          sortOrder: atex.sortOrder,
        })),
      },
      markers: {
        create: sectionMarkers.map((marker) => ({
          name: marker.name,
          timestamp: marker.timestamp,
        })),
      },
    },
    include: {
      markers: { orderBy: { timestamp: "asc" } },
      pdfs: {
        include: { pageSyncPoints: { orderBy: { timeInSeconds: "asc" } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  // Set fileType to "alphatex" for the created PDFs
  await prisma.$executeRawUnsafe(
    `UPDATE JamTrackPdf SET fileType = 'alphatex' WHERE jamTrackId = ?`,
    jamTrack.id
  );

  // Re-fetch to include the updated fileType
  const result = await prisma.jamTrack.findUnique({
    where: { id: jamTrack.id },
    include: {
      markers: { orderBy: { timestamp: "asc" } },
      pdfs: {
        include: { pageSyncPoints: { orderBy: { timeInSeconds: "asc" } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".psarc")) {
      return NextResponse.json(
        { error: "Only .psarc files are supported" },
        { status: 400 }
      );
    }

    // Parse the PSARC archive
    const buffer = Buffer.from(await file.arrayBuffer());
    const psarc = new PSARC();
    await psarc.parse(buffer);

    // Get arrangement metadata from JSON manifests
    const arrangements = await psarc.getArrangements();
    if (Object.keys(arrangements).length === 0) {
      return NextResponse.json(
        { error: "No arrangements found in .psarc file" },
        { status: 400 }
      );
    }

    // Group arrangements by unique song (songName + artistName)
    const songGroups = new Map<string, { persistentIDs: string[]; metadata: typeof arrangements[string] }>();

    for (const [persistentID, arr] of Object.entries(arrangements)) {
      const songKey = `${arr.artistName}|||${arr.songName}`;

      if (!songGroups.has(songKey)) {
        songGroups.set(songKey, { persistentIDs: [], metadata: arr });
      }

      songGroups.get(songKey)!.persistentIDs.push(persistentID);
    }

    console.log(`Found ${songGroups.size} unique song(s) in PSARC`);

    // Extract and import each song
    const musicPath = path.resolve(MUSIC_DIR);
    const allFiles = psarc.getFiles();

    // Debug: Show all files in archive
    console.log(`DEBUG: Total files in archive: ${allFiles.length}`);
    console.log(`DEBUG: Sample files (first 30):`);
    allFiles.slice(0, 30).forEach(f => console.log(`  ${f}`));
    const results = [];
    const errors = [];

    for (const [, { persistentIDs, metadata }] of songGroups.entries()) {
      const songTitle = metadata.songName || "Unknown Song";
      const artistName = metadata.artistName || "Unknown Artist";

      try {
        console.log(`Importing: ${artistName} - ${songTitle}`);
        console.log(`DEBUG: Arrangement metadata keys:`, Object.keys(metadata.raw).filter(k => k.toLowerCase().includes('audio') || k.toLowerCase().includes('wem')));
        const jamTrack = await extractSong(
          psarc,
          songTitle,
          artistName,
          persistentIDs,
          allFiles,
          musicPath
        );
        results.push(jamTrack);
      } catch (err) {
        console.error(`Failed to import ${artistName} - ${songTitle}:`, err);
        errors.push({
          song: `${artistName} - ${songTitle}`,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // Return results
    if (results.length === 0) {
      return NextResponse.json(
        {
          error: "Failed to import any songs",
          details: errors,
        },
        { status: 500 }
      );
    }

    // If some songs failed but others succeeded
    if (errors.length > 0) {
      return NextResponse.json({
        imported: results,
        errors,
        message: `Imported ${results.length} song(s), ${errors.length} failed`,
      });
    }

    // All songs imported successfully
    return NextResponse.json({
      imported: results,
      message: `Successfully imported ${results.length} song(s)`,
    });
  } catch (error) {
    console.error("Error importing .psarc:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to import .psarc file",
      },
      { status: 500 }
    );
  }
}
