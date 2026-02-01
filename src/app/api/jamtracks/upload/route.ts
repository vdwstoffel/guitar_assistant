import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";
import * as mm from "music-metadata";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
const JAM_TRACKS_FOLDER = "JamTracks";
const SUPPORTED_EXTENSIONS = [".mp3", ".flac", ".wav", ".ogg", ".m4a", ".aac"];

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const musicPath = path.resolve(MUSIC_DIR);
    const jamTracksPath = path.join(musicPath, JAM_TRACKS_FOLDER);

    // Ensure JamTracks folder exists
    await fs.mkdir(jamTracksPath, { recursive: true });

    const results: { name: string; success: boolean; error?: string }[] = [];

    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase();

      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        results.push({
          name: file.name,
          success: false,
          error: `Unsupported file type: ${ext}`,
        });
        continue;
      }

      try {
        // Save file temporarily to parse metadata
        const tempPath = path.join(jamTracksPath, file.name);
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(tempPath, buffer);

        // Parse metadata
        const metadata = await mm.parseFile(tempPath);
        const fileName = path.basename(file.name, ext);
        const title = metadata.common.title || fileName;
        const duration = metadata.format.duration || 0;

        // Create folder for this jam track using sanitized title
        const folderName = sanitizeName(title);
        const trackFolder = path.join(jamTracksPath, folderName);
        await fs.mkdir(trackFolder, { recursive: true });

        // Move file to its folder
        const finalPath = path.join(trackFolder, file.name);
        const relativePath = path.join(JAM_TRACKS_FOLDER, folderName, file.name);

        // Move from temp location to final location
        if (tempPath !== finalPath) {
          try {
            await fs.access(finalPath);
            // File already exists at destination, remove temp
            await fs.unlink(tempPath);
          } catch {
            // File doesn't exist, move it
            await fs.rename(tempPath, finalPath);
          }
        }

        // Create jam track in database
        await prisma.jamTrack.upsert({
          where: { filePath: relativePath },
          update: {
            title,
            duration,
          },
          create: {
            title,
            duration,
            filePath: relativePath,
          },
        });

        results.push({ name: file.name, success: true });
      } catch (err) {
        console.error(`Error processing ${file.name}:`, err);
        results.push({
          name: file.name,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      message: `Uploaded ${successCount} of ${files.length} jam track${files.length !== 1 ? "s" : ""}`,
      results,
    });
  } catch (error) {
    console.error("Error uploading jam tracks:", error);
    return NextResponse.json(
      { error: "Failed to upload jam tracks" },
      { status: 500 }
    );
  }
}
