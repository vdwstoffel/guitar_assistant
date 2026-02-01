import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";
import * as mm from "music-metadata";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
const SUPPORTED_EXTENSIONS = [".mp3", ".flac", ".wav", ".ogg", ".m4a", ".aac"];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const musicPath = path.resolve(MUSIC_DIR);
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
        // Save file to music directory
        const filePath = path.join(musicPath, file.name);
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(filePath, buffer);

        // Parse metadata
        const metadata = await mm.parseFile(filePath);
        const fileName = path.basename(file.name, ext);

        const title = metadata.common.title || fileName;
        const artistName = metadata.common.artist || "Unknown Artist";
        const albumName = metadata.common.album || "Unknown Album";
        const trackNumber = metadata.common.track?.no || 0;
        const duration = metadata.format.duration || 0;

        // Get or create artist
        const artist = await prisma.artist.upsert({
          where: { name: artistName },
          update: {},
          create: { name: artistName },
        });

        // Get or create album
        const album = await prisma.album.upsert({
          where: {
            name_artistId: {
              name: albumName,
              artistId: artist.id,
            },
          },
          update: {},
          create: {
            name: albumName,
            artistId: artist.id,
          },
        });

        // Create or update song
        await prisma.song.upsert({
          where: { filePath: file.name },
          update: {
            title,
            trackNumber,
            duration,
            albumId: album.id,
          },
          create: {
            title,
            trackNumber,
            duration,
            filePath: file.name,
            albumId: album.id,
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
      message: `Uploaded ${successCount} of ${files.length} files`,
      results,
    });
  } catch (error) {
    console.error("Error uploading files:", error);
    return NextResponse.json(
      { error: "Failed to upload files" },
      { status: 500 }
    );
  }
}
