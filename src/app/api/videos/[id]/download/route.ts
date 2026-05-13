import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";
import { execFile } from "child_process";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
const VIDEOS_FOLDER = "Videos";
const DOWNLOAD_TIMEOUT_MS = 600_000;

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

function videosDir(): string {
  return path.join(path.resolve(MUSIC_DIR), VIDEOS_FOLDER);
}

async function findExistingFile(id: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(videosDir());
    const match = entries.find((name) => name.startsWith(`${id}.`));
    return match ? path.join(videosDir(), match) : null;
  } catch {
    return null;
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }
    if (video.localPath) {
      return NextResponse.json(video);
    }

    const dir = videosDir();
    await fs.mkdir(dir, { recursive: true });

    const url = `https://www.youtube.com/watch?v=${video.youtubeId}`;
    const outputTemplate = path.join(dir, `${id}.%(ext)s`);

    try {
      await execFilePromise(
        "yt-dlp",
        [
          "-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
          "--merge-output-format", "mp4",
          "-o", outputTemplate,
          "--no-playlist",
          url,
        ],
        { timeout: DOWNLOAD_TIMEOUT_MS }
      );
    } catch (err) {
      const e = err as Error & { stderr?: string };
      console.error("Error downloading YouTube video:", e.message);
      console.error("yt-dlp stderr:", e.stderr);
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

    const absolutePath = await findExistingFile(id);
    if (!absolutePath) {
      return NextResponse.json(
        { error: "Download completed but video file was not found." },
        { status: 500 }
      );
    }

    const relativePath = path.join(VIDEOS_FOLDER, path.basename(absolutePath));
    const updated = await prisma.video.update({
      where: { id },
      data: { localPath: relativePath },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error downloading video:", error);
    return NextResponse.json({ error: "Failed to download video" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (video.localPath) {
      const absolutePath = path.resolve(MUSIC_DIR, video.localPath);
      const musicDirAbsolute = path.resolve(MUSIC_DIR);
      if (absolutePath.startsWith(musicDirAbsolute)) {
        try {
          await fs.unlink(absolutePath);
        } catch (err) {
          console.error("Error deleting video file:", err);
        }
      }
    }

    const updated = await prisma.video.update({
      where: { id },
      data: { localPath: null },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error removing downloaded video:", error);
    return NextResponse.json({ error: "Failed to remove download" }, { status: 500 });
  }
}
