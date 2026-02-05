import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import ffmpeg from "fluent-ffmpeg";

// ffmpeg is installed in the system PATH via Docker

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".m4v"];

// Helper function to get video duration
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

// POST - Bulk upload videos for a book
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const authorName = formData.get("authorName") as string;
    const bookName = formData.get("bookName") as string;
    const files = formData.getAll("videos") as File[];

    if (!authorName || !bookName) {
      return NextResponse.json(
        { error: "Author name and book name are required" },
        { status: 400 }
      );
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No video files provided" },
        { status: 400 }
      );
    }

    // Upsert author
    const author = await prisma.author.upsert({
      where: { name: authorName },
      update: {},
      create: { name: authorName },
    });

    // Upsert book
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

    // Create videos directory
    const videosDir = path.join(MUSIC_DIR, authorName, bookName, "videos");
    if (!fs.existsSync(videosDir)) {
      fs.mkdirSync(videosDir, { recursive: true });
    }

    // Get highest sortOrder for this book
    const lastVideo = await prisma.bookVideo.findFirst({
      where: { bookId: book.id },
      orderBy: { sortOrder: "desc" },
    });
    let sortOrder = (lastVideo?.sortOrder ?? -1) + 1;

    const uploadedVideos = [];

    // Upload each video
    for (const file of files) {
      // Validate file extension
      const ext = path.extname(file.name).toLowerCase();
      if (!SUPPORTED_VIDEO_EXTENSIONS.includes(ext)) {
        console.error(`Skipping unsupported file: ${file.name}`);
        continue;
      }

      // Sanitize filename
      const sanitizedFilename = sanitizeFilename(file.name);

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
        console.error(`Error extracting video duration for ${finalFilename}:`, error);
      }

      // Get relative path from MUSIC_DIR
      const relativePath = path.join(authorName, bookName, "videos", finalFilename);

      // Create database record
      const bookVideo = await prisma.bookVideo.create({
        data: {
          filename: finalFilename,
          filePath: relativePath,
          duration,
          sortOrder,
          bookId: book.id,
        },
      });

      uploadedVideos.push(bookVideo);
      sortOrder++;
    }

    return NextResponse.json({
      author,
      book,
      videos: uploadedVideos,
      message: `Successfully uploaded ${uploadedVideos.length} video(s)`,
    });
  } catch (error) {
    console.error("Error uploading videos:", error);
    return NextResponse.json(
      { error: "Failed to upload videos" },
      { status: 500 }
    );
  }
}
