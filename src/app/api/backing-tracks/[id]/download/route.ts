import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { downloadBackingTrackAudio, MUSIC_DIR } from "@/lib/backingTrackAudio";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const track = await prisma.backingTrack.findUnique({ where: { id } });
  if (!track) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Idempotent: if audio already exists on disk, return as-is.
  if (track.audioPath) {
    try {
      await fs.access(path.resolve(MUSIC_DIR, track.audioPath));
      return NextResponse.json(track);
    } catch {
      // file missing — fall through and re-download
    }
  }

  let audioPath: string;
  let duration: number;
  try {
    ({ audioPath, duration } = await downloadBackingTrackAudio(track.youtubeUrl, track.title));
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Download failed";
    return NextResponse.json({ error: detail }, { status: 422 });
  }

  const updated = await prisma.backingTrack.update({
    where: { id },
    data: { audioPath, duration },
  });
  return NextResponse.json(updated);
}
