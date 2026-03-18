import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as path from "path";
import * as fs from "fs";
import { execFile } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import NodeID3 from "node-id3";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

function getLufs(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    execFile(
      "ffmpeg",
      ["-i", filePath, "-af", "loudnorm=print_format=json", "-f", "null", "-"],
      { timeout: 60000, maxBuffer: 10 * 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (error) {
          resolve(null);
          return;
        }
        const match = stderr.match(/"input_i"\s*:\s*"([-\d.]+)"/);
        if (match) {
          const lufs = parseFloat(match[1]);
          resolve(isFinite(lufs) ? lufs : null);
        } else {
          resolve(null);
        }
      }
    );
  });
}

function extractAudioFromVideo(
  inputPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec("libmp3lame")
      .audioBitrate(192)
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration || 0);
    });
  });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  try {
    const { id: bookId, videoId } = await params;

    const video = await prisma.bookVideo.findUnique({
      where: { id: videoId },
      include: {
        book: {
          include: { author: true },
        },
      },
    });

    if (!video || video.bookId !== bookId) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    const { book } = video;
    const authorName = book.author.name;
    const bookName = book.name;

    // Determine track number and title from the video
    const trackNumber = video.trackNumber || video.sortOrder + 1;
    const title =
      video.title ||
      video.filename.replace(/\.[^/.]+$/, "").replace(/^\d+\s*-\s*/, "");

    // Build output filename: "001 - Title.mp3"
    const paddedNum = String(trackNumber).padStart(3, "0");
    const safeTitle = title.replace(/[/\\?%*:|"<>]/g, "_");
    const outputFilename = `${paddedNum} - ${safeTitle}.mp3`;
    const relativeOutputPath = path.join(authorName, bookName, outputFilename);
    const absoluteOutputPath = path.join(MUSIC_DIR, relativeOutputPath);

    // Check if track already exists
    const existingTrack = await prisma.track.findUnique({
      where: { filePath: relativeOutputPath },
    });
    if (existingTrack) {
      return NextResponse.json(
        { error: "Audio already extracted for this video" },
        { status: 409 }
      );
    }

    // Also check if file exists on disk
    if (fs.existsSync(absoluteOutputPath)) {
      return NextResponse.json(
        { error: "Audio file already exists on disk" },
        { status: 409 }
      );
    }

    // Ensure output directory exists
    const outputDir = path.dirname(absoluteOutputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Extract audio from video
    const videoAbsPath = path.join(MUSIC_DIR, video.filePath);
    if (!fs.existsSync(videoAbsPath)) {
      return NextResponse.json(
        { error: "Video file not found on disk" },
        { status: 404 }
      );
    }

    try {
      await extractAudioFromVideo(videoAbsPath, absoluteOutputPath);
    } catch (err) {
      // Clean up partial file
      if (fs.existsSync(absoluteOutputPath)) {
        fs.unlinkSync(absoluteOutputPath);
      }
      console.error("ffmpeg extraction failed:", err);
      return NextResponse.json(
        { error: "Failed to extract audio from video" },
        { status: 500 }
      );
    }

    // Get duration of the new audio file
    let duration = 0;
    try {
      duration = await getAudioDuration(absoluteOutputPath);
    } catch {
      // Use video duration as fallback
      duration = video.duration || 0;
    }

    // Write ID3 tags
    const tags: NodeID3.Tags = {
      title,
      artist: authorName,
      album: bookName,
      trackNumber: String(trackNumber),
    };

    // Embed cover art if book has a custom cover
    if (book.coverPath) {
      const coverAbsPath = path.join(MUSIC_DIR, book.coverPath);
      if (fs.existsSync(coverAbsPath)) {
        const ext = path.extname(book.coverPath).toLowerCase();
        const mimeMap: Record<string, string> = {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".webp": "image/webp",
        };
        tags.image = {
          mime: mimeMap[ext] || "image/jpeg",
          type: { id: 3, name: "front cover" },
          description: "Cover",
          imageBuffer: fs.readFileSync(coverAbsPath),
        };
      }
    }

    NodeID3.write(tags, absoluteOutputPath);

    // Measure LUFS for normalization
    const lufs = await getLufs(absoluteOutputPath);

    // Create Track record
    const newTrack = await prisma.track.create({
      data: {
        title,
        trackNumber,
        filePath: relativeOutputPath,
        duration,
        lufs,
        bookId: video.bookId,
        chapterId: video.chapterId,
        pdfPage: video.pdfPage,
        sortOrder: video.sortOrder,
      },
      include: {
        markers: { orderBy: { timestamp: "asc" } },
        tabs: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json(
      { track: newTrack, message: `Audio extracted: ${outputFilename}` },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error extracting audio:", error);
    return NextResponse.json(
      { error: "Failed to extract audio from video" },
      { status: 500 }
    );
  }
}
