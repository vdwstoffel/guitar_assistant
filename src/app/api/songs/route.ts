import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { defaultSongName } from "@/lib/songwriting/songs";
import { songToJson, SONG_INCLUDE } from "@/lib/songwriting/songJson";
import type { SongListItem } from "@/types";

export async function GET() {
  try {
    const songs = await prisma.composition.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { sections: true } } },
    });
    const out: SongListItem[] = songs.map((s) => ({
      id: s.id,
      name: s.name,
      sectionCount: s._count.sections,
      updatedAt: s.updatedAt.toISOString(),
    }));
    return NextResponse.json(out);
  } catch (error) {
    console.error("Error listing songs:", error);
    return NextResponse.json({ error: "Failed to list songs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown = {};
    const text = await request.text();
    if (text.trim()) {
      try {
        body = JSON.parse(text);
      } catch {
        return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
      }
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
    }
    const raw = (body as Record<string, unknown>).name;
    let name: string;
    if (raw === undefined || raw === null) {
      const existing = await prisma.composition.findMany({ where: { name: { startsWith: "Song " } }, select: { name: true } });
      name = defaultSongName(existing.map((s) => s.name));
    } else {
      if (typeof raw !== "string" || raw.trim().length < 1 || raw.trim().length > 80) {
        return NextResponse.json({ error: "name must be 1-80 characters" }, { status: 400 });
      }
      name = raw.trim();
    }
    const song = await prisma.composition.create({ data: { name }, include: SONG_INCLUDE });
    return NextResponse.json(songToJson(song), { status: 201 });
  } catch (error) {
    console.error("Error creating song:", error);
    return NextResponse.json({ error: "Failed to create song" }, { status: 500 });
  }
}
