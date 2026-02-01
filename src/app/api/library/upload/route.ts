import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";
import * as mm from "music-metadata";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
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
        const tempPath = path.join(musicPath, file.name);
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(tempPath, buffer);

        // Parse metadata
        const metadata = await mm.parseFile(tempPath);
        const fileName = path.basename(file.name, ext);

        const title = metadata.common.title || fileName;
        const authorName = sanitizeName(metadata.common.artist || "Unknown Author");
        const bookName = sanitizeName(metadata.common.album || "Unknown Book");
        const trackNumber = metadata.common.track?.no || 0;
        const duration = metadata.format.duration || 0;

        // Create folder structure: music/Author/Book/
        const authorDir = path.join(musicPath, authorName);
        const bookDir = path.join(authorDir, bookName);
        await fs.mkdir(bookDir, { recursive: true });

        // Move file to organized location
        const finalPath = path.join(bookDir, file.name);
        const relativePath = path.join(authorName, bookName, file.name);

        // If file already exists at destination, remove temp and skip
        if (tempPath !== finalPath) {
          try {
            await fs.access(finalPath);
            // File exists, remove temp file
            await fs.unlink(tempPath);
          } catch {
            // File doesn't exist, move it
            await fs.rename(tempPath, finalPath);
          }
        }

        // Get or create author
        const author = await prisma.author.upsert({
          where: { name: authorName },
          update: {},
          create: { name: authorName },
        });

        // Get or create book
        const book = await prisma.book.upsert({
          where: {
            name_authorId: {
              name: bookName,
              authorId: author.id,
            },
          },
          update: {},
          create: {
            name: bookName,
            authorId: author.id,
          },
        });

        // Create or update track
        await prisma.track.upsert({
          where: { filePath: relativePath },
          update: {
            title,
            trackNumber,
            duration,
            bookId: book.id,
          },
          create: {
            title,
            trackNumber,
            duration,
            filePath: relativePath,
            bookId: book.id,
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
