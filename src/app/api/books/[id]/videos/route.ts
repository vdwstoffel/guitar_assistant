import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import ffmpeg from "fluent-ffmpeg";

// ffmpeg is installed in the system PATH via Docker

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".m4v"];

// Helper function to get video duration using ffmpeg
function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const duration = metadata.format.duration || 0;
        resolve(duration);
      }
    });
  });
}

// Helper function to sanitize filenames
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.\-_() ]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

// POST - Upload video
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookId } = await params;

    // Check if book exists
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: { author: true },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("video") as File;

    if (!file) {
      return NextResponse.json({ error: "No video file provided" }, { status: 400 });
    }

    // Validate file extension
    const ext = path.extname(file.name).toLowerCase();
    if (!SUPPORTED_VIDEO_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported video format. Supported: ${SUPPORTED_VIDEO_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Sanitize filename
    const sanitizedFilename = sanitizeFilename(file.name);

    // Create videos directory if it doesn't exist
    const videosDir = path.join(MUSIC_DIR, book.author.name, book.name, "videos");
    if (!fs.existsSync(videosDir)) {
      fs.mkdirSync(videosDir, { recursive: true });
    }

    // Check for duplicate filename
    let finalFilename = sanitizedFilename;
    let counter = 1;
    while (fs.existsSync(path.join(videosDir, finalFilename))) {
      const nameWithoutExt = path.basename(sanitizedFilename, ext);
      finalFilename = `${nameWithoutExt} (${counter})${ext}`;
      counter++;
    }

    // Save file
    const videoPath = path.join(videosDir, finalFilename);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    fs.writeFileSync(videoPath, buffer);

    // Extract video duration
    let duration: number | null = null;
    try {
      duration = await getVideoDuration(videoPath);
    } catch (error) {
      console.error("Error extracting video duration:", error);
      // Continue without duration
    }

    // Get relative path from MUSIC_DIR
    const relativePath = path.join(book.author.name, book.name, "videos", finalFilename);

    // Get the highest sortOrder for this book
    const lastVideo = await prisma.bookVideo.findFirst({
      where: { bookId },
      orderBy: { sortOrder: "desc" },
    });
    const sortOrder = (lastVideo?.sortOrder ?? -1) + 1;

    // Create database record
    const bookVideo = await prisma.bookVideo.create({
      data: {
        filename: finalFilename,
        filePath: relativePath,
        duration,
        sortOrder,
        bookId,
      },
    });

    return NextResponse.json(bookVideo, { status: 201 });
  } catch (error) {
    console.error("Error uploading video:", error);
    return NextResponse.json(
      { error: "Failed to upload video" },
      { status: 500 }
    );
  }
}

// GET - List videos for a book
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookId } = await params;

    const videos = await prisma.bookVideo.findMany({
      where: { bookId },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(videos);
  } catch (error) {
    console.error("Error fetching videos:", error);
    return NextResponse.json(
      { error: "Failed to fetch videos" },
      { status: 500 }
    );
  }
}
