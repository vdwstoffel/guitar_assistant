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
    const firstArr = Object.values(arrangements)[0];
    if (!firstArr) {
      return NextResponse.json(
        { error: "No arrangements found in .psarc file" },
        { status: 400 }
      );
    }

    const songTitle = firstArr.songName || path.basename(file.name, ".psarc");
    const artistName = firstArr.artistName || "Unknown Artist";
    const folderName = sanitizeName(`${artistName} - ${songTitle}`);

    // Create folder for this jam track
    const musicPath = path.resolve(MUSIC_DIR);
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

    // Extract and convert audio (.wem → .ogg)
    const allFiles = psarc.getFiles();
    const wemIndices = psarc.findFiles(/\.wem$/);
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
          audioDuration = firstArr.songLength || 0;
        } catch (audioErr) {
          console.error("Audio conversion failed:", audioErr);
          // Continue without audio - user can add manually
        }
      }
    }

    if (!audioRelativePath) {
      return NextResponse.json(
        { error: "Failed to extract audio from .psarc file. Ensure vgmstream-cli and ffmpeg are installed." },
        { status: 500 }
      );
    }

    // Parse SNG files and generate AlphaTex for each arrangement
    const sngIndices = psarc.findFiles(/\.sng$/);
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
        const displayName =
          arrName.charAt(0).toUpperCase() + arrName.slice(1);
        const alphaTex = generateAlphaTex(
          song,
          displayName,
          songTitle,
          artistName
        );

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
      } catch (sngErr) {
        console.error(`Failed to parse SNG ${sngName}:`, sngErr);
      }
    }

    if (alphatexFiles.length === 0) {
      return NextResponse.json(
        { error: "Failed to parse any arrangements from .psarc file" },
        { status: 500 }
      );
    }

    // Create JamTrack and related records in database
    // Note: fileType is omitted from Prisma create because the generated client
    // hasn't been regenerated yet (requires Docker rebuild). We set it via raw SQL after.
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

    // Set fileType to "alphatex" for the created PDFs (workaround until Prisma client is regenerated)
    await prisma.$executeRawUnsafe(
      `UPDATE JamTrackPdf SET fileType = 'alphatex' WHERE jamTrackId = ?`,
      jamTrack.id
    );

    // Re-fetch to include the updated fileType in response
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

    return NextResponse.json(result);
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
