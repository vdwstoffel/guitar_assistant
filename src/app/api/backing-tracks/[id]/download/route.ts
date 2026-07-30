import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { downloadBackingTrackAudio, MUSIC_DIR } from "@/lib/backingTrackAudio";
import { ndjsonStreamResponse } from "@/lib/ndjsonStream";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const track = await prisma.backingTrack.findUnique({ where: { id } });
  if (!track) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Idempotent: if audio already exists on disk, report done immediately.
  if (track.audioPath) {
    try {
      await fs.access(path.resolve(MUSIC_DIR, track.audioPath));
      return ndjsonStreamResponse(async (send) => { send({ type: "done", track }); });
    } catch {
      // file missing — fall through and re-download
    }
  }

  return ndjsonStreamResponse(async (send) => {
    let audioPath: string;
    let duration: number;
    try {
      ({ audioPath, duration } = await downloadBackingTrackAudio(track.youtubeUrl, track.title, (p) =>
        send({ type: "progress", percent: p.percent, phase: p.phase }),
      ));
    } catch (err) {
      send({ type: "error", error: err instanceof Error ? err.message : "Download failed" });
      return;
    }

    const updated = await prisma.backingTrack.update({
      where: { id },
      data: { audioPath, duration },
    });
    send({ type: "done", track: updated });
  });
}
