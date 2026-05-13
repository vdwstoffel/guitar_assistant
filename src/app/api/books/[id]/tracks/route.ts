import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import * as mm from "music-metadata";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
const SUPPORTED_EXTENSIONS = [".mp3", ".flac", ".wav", ".ogg", ".m4a", ".aac"];

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.\-_() ]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

// POST - Upload audio tracks for a book
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookId } = await params;

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: { author: true },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "No audio files provided" }, { status: 400 });
    }

    const bookDir = path.join(MUSIC_DIR, book.author.name, book.name);
    if (!fs.existsSync(bookDir)) {
      fs.mkdirSync(bookDir, { recursive: true });
    }

    // Get highest existing sortOrder for this book
    const lastTrack = await prisma.track.findFirst({
      where: { bookId },
      orderBy: { sortOrder: "desc" },
    });
    let nextSortOrder = (lastTrack?.sortOrder ?? -1) + 1;

    const results: { name: string; success: boolean; error?: string }[] = [];

    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase();

      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        results.push({
          name: file.name,
          success: false,
          error: `Unsupported format. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`,
        });
        continue;
      }

      try {
        const sanitizedFilename = sanitizeFilename(file.name);
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Handle duplicate filenames
        let finalFilename = sanitizedFilename;
        let counter = 1;
        while (fs.existsSync(path.join(bookDir, finalFilename))) {
          const nameWithoutExt = path.basename(sanitizedFilename, ext);
          finalFilename = `${nameWithoutExt} (${counter})${ext}`;
          counter++;
        }

        const filePath = path.join(bookDir, finalFilename);
        fs.writeFileSync(filePath, buffer);

        // Parse audio metadata
        const metadata = await mm.parseFile(filePath);
        const fileBaseName = path.basename(finalFilename, ext);
        const title = metadata.common.title || fileBaseName;
        const trackNumber = metadata.common.track?.no || 0;
        const duration = metadata.format.duration || 0;

        const relativePath = path.join(book.author.name, book.name, finalFilename);

        await prisma.track.upsert({
          where: { filePath: relativePath },
          update: {
            title,
            trackNumber,
            duration,
            bookId,
          },
          create: {
            title,
            trackNumber,
            duration,
            filePath: relativePath,
            sortOrder: nextSortOrder,
            bookId,
          },
        });

        nextSortOrder++;
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
    }, { status: 201 });
  } catch (error) {
    console.error("Error uploading audio tracks:", error);
    return NextResponse.json(
      { error: "Failed to upload audio tracks" },
      { status: 500 }
    );
  }
}
