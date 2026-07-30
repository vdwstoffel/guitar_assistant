import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { isValidYouTubeUrl, extractVideoId, thumbnailUrl } from "@/lib/youtube";
import { NOTES, SCALE_FORMULAS } from "@/lib/musicTheory";
import * as fs from "fs/promises";
import { downloadBackingTrackAudio, backingTrackAudioDir } from "@/lib/backingTrackAudio";
import { ndjsonStreamResponse } from "@/lib/ndjsonStream";

const TITLE_FETCH_TIMEOUT_MS = 30_000;

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

function isValidRootNote(note: unknown): note is string {
  return typeof note === "string" && (NOTES as readonly string[]).includes(note);
}

function isValidScaleType(scale: unknown): scale is string {
  if (typeof scale !== "string") return false;
  if (scale === "None") return false; // backing tracks require a real scale
  return Object.prototype.hasOwnProperty.call(SCALE_FORMULAS, scale);
}

export async function GET() {
  const tracks = await prisma.backingTrack.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(tracks);
}

export async function POST(request: NextRequest) {
  let body: { url?: string; title?: string; rootNote?: string; scaleType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, title: providedTitle, rootNote, scaleType } = body;

  if (!url || typeof url !== "string" || !isValidYouTubeUrl(url)) {
    return NextResponse.json(
      { error: "Invalid YouTube URL. Supported formats: youtube.com/watch, youtu.be, youtube.com/shorts, music.youtube.com" },
      { status: 400 }
    );
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return NextResponse.json({ error: "Could not extract video id from URL" }, { status: 400 });
  }

  if (!isValidRootNote(rootNote)) {
    return NextResponse.json({ error: `Invalid rootNote. Must be one of: ${NOTES.join(", ")}` }, { status: 400 });
  }

  if (!isValidScaleType(scaleType)) {
    return NextResponse.json({ error: `Invalid scaleType.` }, { status: 400 });
  }

  // Duplicate check first (avoids running yt-dlp only to fail on unique constraint)
  const existing = await prisma.backingTrack.findUnique({ where: { youtubeUrl: url } });
  if (existing) {
    return NextResponse.json(
      { error: "A backing track with this URL already exists.", existingId: existing.id },
      { status: 409 }
    );
  }

  // Resolve title
  let title: string;
  if (providedTitle && typeof providedTitle === "string" && providedTitle.trim()) {
    title = providedTitle.trim();
  } else {
    try {
      const { stdout } = await execFilePromise("yt-dlp", ["--dump-json", url], {
        timeout: TITLE_FETCH_TIMEOUT_MS,
      });
      const metadata = JSON.parse(stdout);
      title = metadata.title || "Untitled";
    } catch (err) {
      const stderrMsg = (err as Error & { stderr?: string }).stderr || "";
      console.error("Error fetching YouTube title:", err);
      console.error("yt-dlp stderr:", stderrMsg);
      return NextResponse.json(
        { error: "Could not fetch video title automatically. Please provide a title.", needsTitle: true },
        { status: 422 }
      );
    }
  }

  // Validation passed — stream the download (progress) and final record as NDJSON.
  const validTitle = title;
  return ndjsonStreamResponse(async (send) => {
    let audioPath: string;
    let duration: number;
    try {
      ({ audioPath, duration } = await downloadBackingTrackAudio(url, validTitle, (p) =>
        send({ type: "progress", percent: p.percent, phase: p.phase }),
      ));
    } catch (err) {
      send({ type: "error", error: err instanceof Error ? err.message : "Download failed" });
      return;
    }

    try {
      const created = await prisma.backingTrack.create({
        data: {
          youtubeUrl: url,
          videoId,
          title: validTitle,
          thumbnailUrl: thumbnailUrl(videoId),
          rootNote,
          scaleType,
          audioPath,
          duration,
        },
      });
      send({ type: "done", track: created });
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // Race: another concurrent POST won the unique-constraint race.
        // Clean up the audio folder this request just downloaded to avoid orphans.
        try {
          await fs.rm(backingTrackAudioDir(audioPath), { recursive: true, force: true });
        } catch {
          // best-effort; ignore fs errors
        }
        const dup = await prisma.backingTrack.findUnique({ where: { youtubeUrl: url } });
        send({
          type: "error",
          error: "A backing track with this URL already exists.",
          existingId: dup?.id,
        });
        return;
      }
      send({ type: "error", error: "Failed to save backing track." });
    }
  });
}
