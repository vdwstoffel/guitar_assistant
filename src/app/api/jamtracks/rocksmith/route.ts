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
  songKey: string,
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

  // Find all SNG files for this song by song key.
  // SNG filenames follow the pattern: songs/bin/generic/<songkey>_<arrangement>.sng
  // Note: SongKey in manifest may have mixed case (e.g., "DarkTran") while
  // filenames are lowercase (e.g., "darktran_bass.sng"), so compare case-insensitively.
  const songKeyLower = songKey.toLowerCase();
  const sngIndices: number[] = [];
  for (let i = 0; i < allFiles.length; i++) {
    const filePath = allFiles[i].toLowerCase();
    if (filePath.endsWith(".sng") && filePath.includes(`/${songKeyLower}_`)) {
      sngIndices.push(i);
    }
  }

  // Collect all WEM audio files in the archive.
  // WEM filenames are numeric hashes (e.g., "audio/windows/18056767.wem")
  // and cannot be matched by persistent ID or song key.
  // For single-song PSARCs, we pick the largest WEM (full song vs preview).
  const wemIndices: number[] = [];
  for (let i = 0; i < allFiles.length; i++) {
    if (allFiles[i].endsWith(".wem")) {
      wemIndices.push(i);
    }
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
    // Extract the song key from the manifest JSON path (e.g., "manifests/songs_dlc_darktran/darktran_lead.json" → "darktran")
    const songGroups = new Map<string, { songKey: string; metadata: typeof arrangements[string] }>();

    for (const [, arr] of Object.entries(arrangements)) {
      // Skip arrangements with no song name (e.g., showlights)
      if (!arr.songName || !arr.artistName) continue;

      const groupKey = `${arr.artistName}|||${arr.songName}`;

      if (!songGroups.has(groupKey)) {
        // Derive song key from srcJson path or from raw SongKey attribute
        const rawSongKey = String(arr.raw.SongKey || "");
        const derivedKey = rawSongKey || path.basename(arr.srcJson, ".json").split("_")[0];
        songGroups.set(groupKey, { songKey: derivedKey, metadata: arr });
      }
    }

    console.log(`Found ${songGroups.size} unique song(s) in PSARC`);

    // Extract and import each song
    const musicPath = path.resolve(MUSIC_DIR);
    const allFiles = psarc.getFiles();
    const results = [];
    const errors = [];

    for (const [, { songKey, metadata }] of songGroups.entries()) {
      const songTitle = metadata.songName;
      const artistName = metadata.artistName;

      try {
        console.log(`Importing: ${artistName} - ${songTitle} (songKey: ${songKey})`);
        const jamTrack = await extractSong(
          psarc,
          songTitle,
          artistName,
          songKey,
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
