import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { isValidYouTubeUrl, extractVideoId, thumbnailUrl } from "@/lib/youtube";
import { NOTES, SCALE_FORMULAS } from "@/lib/musicTheory";
import { downloadBackingTrackAudio } from "@/lib/backingTrackAudio";

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

  let audioPath: string;
  let duration: number;
  try {
    ({ audioPath, duration } = await downloadBackingTrackAudio(url, title));
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Download failed";
    return NextResponse.json({ error: detail }, { status: 422 });
  }

  try {
    const created = await prisma.backingTrack.create({
      data: {
        youtubeUrl: url,
        videoId,
        title,
        thumbnailUrl: thumbnailUrl(videoId),
        rootNote,
        scaleType,
        audioPath,
        duration,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const dup = await prisma.backingTrack.findUnique({ where: { youtubeUrl: url } });
      return NextResponse.json(
        { error: "A backing track with this URL already exists.", existingId: dup?.id },
        { status: 409 }
      );
    }
    throw err;
  }
}
