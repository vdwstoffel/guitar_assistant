import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";
import { serializeGpSong } from "@/lib/gp/serialize";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  // Only these may be set from the client; the file path and the metadata
  // parsed out of the file are not the client's to change.
  const allowed = [
    "title", "favorite", "completed", "inProgress", "lastPlayedAt",
    "completedAt", "playbackSpeed", "lastTrackIndex",
    // Pairing this tab with an audio track, or breaking the pair with null.
    "jamTrackId",
  ] as const;
  const data: Record<string, unknown> = {};
  for (const key of allowed) if (key in body) data[key] = body[key];

  const row = await prisma.gpSong.update({
    where: { id },
    data,
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(serializeGpSong(row));
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.gpSong.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Row first, file second: a row with no file is a visible broken entry the
  // user can delete, while a file with no row is invisible litter that also
  // blocks re-importing the same name.
  await prisma.gpSong.delete({ where: { id } });
  await fs.unlink(path.resolve(path.join(MUSIC_DIR, row.filePath))).catch(() => {});
  return NextResponse.json({ success: true });
}
