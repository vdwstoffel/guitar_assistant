import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";
import * as mm from "music-metadata";
import { execFile } from "child_process";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
const JAM_TRACKS_FOLDER = "JamTracks";
const DOWNLOAD_TIMEOUT_MS = 120_000;

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}

const YOUTUBE_URL_REGEX =
  /^https?:\/\/(www\.)?(youtube\.com\/(watch\?.*v=|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?.*v=)/;

function isValidYouTubeUrl(url: string): boolean {
  return YOUTUBE_URL_REGEX.test(url);
}

function execFilePromise(
  command: string,
  args: string[],
  options: { timeout?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: options.timeout, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const enriched = error as Error & { stderr?: string };
        enriched.stderr = stderr;
        reject(enriched);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, title: userTitle } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    if (!isValidYouTubeUrl(url)) {
      return NextResponse.json(
        { error: "Invalid YouTube URL. Supported formats: youtube.com/watch, youtu.be, youtube.com/shorts, music.youtube.com" },
        { status: 400 }
      );
    }

    // Fetch metadata from YouTube, or use user-provided title as fallback
    let title: string;
    if (userTitle && typeof userTitle === "string" && userTitle.trim()) {
      title = userTitle.trim();
    } else {
      try {
        const { stdout } = await execFilePromise("yt-dlp", ["--dump-json", url], {
          timeout: 30_000,
        });
        const metadata = JSON.parse(stdout);
        title = metadata.title || "Untitled";
      } catch (err) {
        const stderrMsg = (err as Error & { stderr?: string }).stderr || "";
        console.error("Error fetching YouTube metadata:", err);
        console.error("yt-dlp stderr:", stderrMsg);
        const errorLines = stderrMsg.split("\n").filter((l: string) => l.startsWith("ERROR:"));
        const detail = errorLines.length > 0 ? errorLines[errorLines.length - 1].replace("ERROR: ", "") : "";
        return NextResponse.json(
          { error: detail || "Could not fetch video metadata automatically.", needsTitle: true },
          { status: 422 }
        );
      }
    }

    // Set up paths
    const musicPath = path.resolve(MUSIC_DIR);
    const jamTracksPath = path.join(musicPath, JAM_TRACKS_FOLDER);
    await fs.mkdir(jamTracksPath, { recursive: true });

    const folderName = sanitizeName(title);
    const trackFolder = path.join(jamTracksPath, folderName);
    await fs.mkdir(trackFolder, { recursive: true });

    const fileName = `${sanitizeName(title)}.mp3`;
    const outputPath = path.join(trackFolder, fileName);
    const relativePath = path.join(JAM_TRACKS_FOLDER, folderName, fileName);

    // Download audio from YouTube
    try {
      await execFilePromise(
        "yt-dlp",
        [
          "-x",
          "--audio-format", "mp3",
          "--audio-quality", "0",
          "-o", outputPath,
          "--no-playlist",
          url,
        ],
        { timeout: DOWNLOAD_TIMEOUT_MS }
      );
    } catch (err) {
      // Clean up folder on failure
      try {
        await fs.rm(trackFolder, { recursive: true });
      } catch {
        // ignore cleanup errors
      }
      const e = err as Error & { stderr?: string; code?: number | string; killed?: boolean };
      console.error("Error downloading YouTube audio:", e.message);
      console.error("yt-dlp stderr:", e.stderr);
      console.error("exit code:", e.code, "killed:", e.killed);
      // Try to extract a meaningful error from stderr or the error message
      const stderrMsg = e.stderr || "";
      const errorLines = stderrMsg.split("\n").filter((l: string) => l.startsWith("ERROR:"));
      const detail = errorLines.length > 0
        ? errorLines[errorLines.length - 1].replace("ERROR: ", "")
        : stderrMsg.trim().split("\n").filter(Boolean).pop() || e.message || "";
      return NextResponse.json(
        { error: `yt-dlp failed: ${detail}` },
        { status: 422 }
      );
    }

    // Verify the file was created
    try {
      await fs.access(outputPath);
    } catch {
      // Clean up folder
      try {
        await fs.rm(trackFolder, { recursive: true });
      } catch {
        // ignore cleanup errors
      }
      return NextResponse.json(
        { error: "Download completed but audio file was not found. Conversion may have failed." },
        { status: 500 }
      );
    }

    // Parse duration from downloaded MP3
    let duration = 0;
    try {
      const metadata = await mm.parseFile(outputPath);
      duration = metadata.format.duration || 0;
    } catch (err) {
      console.error("Error parsing audio metadata:", err);
    }

    // Create database record
    const jamTrack = await prisma.jamTrack.upsert({
      where: { filePath: relativePath },
      update: { title, duration },
      create: { title, duration, filePath: relativePath },
      include: { markers: true, pdfs: { include: { pageSyncPoints: { orderBy: { timeInSeconds: "asc" } } } } },
    });

    return NextResponse.json({
      message: `Successfully imported "${title}" from YouTube`,
      jamTrack,
    });
  } catch (error) {
    console.error("Error importing from YouTube:", error);
    return NextResponse.json(
      { error: "Failed to import from YouTube" },
      { status: 500 }
    );
  }
}
