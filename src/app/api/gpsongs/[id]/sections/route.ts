import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeBarRange } from "@/lib/gp/sections";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json(
    await prisma.gpSongSection.findMany({ where: { gpSongId: id }, orderBy: { sortOrder: "asc" } }),
  );
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, startBar, endBar } = await request.json();

  const song = await prisma.gpSong.findUnique({ where: { id } });
  if (!song) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const range = normalizeBarRange({ startBar, endBar }, song.barCount);
  if (!range) {
    return NextResponse.json(
      { error: `Bars ${startBar}-${endBar} are not inside this song (it has ${song.barCount}).` },
      { status: 400 },
    );
  }

  const count = await prisma.gpSongSection.count({ where: { gpSongId: id } });
  const section = await prisma.gpSongSection.create({
    data: {
      gpSongId: id,
      // Bar numbers shown to a person are 1-based; everything stored is 0-based.
      name: String(name ?? "").trim() || `Bars ${range.startBar + 1}-${range.endBar + 1}`,
      startBar: range.startBar,
      endBar: range.endBar,
      sortOrder: count,
    },
  });
  return NextResponse.json(section);
}
