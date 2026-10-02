import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeBarRange } from "@/lib/gp/sections";

type Ctx = { params: Promise<{ id: string; sectionId: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id, sectionId } = await params;
  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;

  if ("startBar" in body || "endBar" in body) {
    const song = await prisma.gpSong.findUnique({ where: { id } });
    const existing = await prisma.gpSongSection.findUnique({ where: { id: sectionId } });
    if (!song || !existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const range = normalizeBarRange(
      { startBar: body.startBar ?? existing.startBar, endBar: body.endBar ?? existing.endBar },
      song.barCount,
    );
    if (!range) return NextResponse.json({ error: "Bar range is outside this song" }, { status: 400 });
    data.startBar = range.startBar;
    data.endBar = range.endBar;
  }

  return NextResponse.json(await prisma.gpSongSection.update({ where: { id: sectionId }, data }));
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { sectionId } = await params;
  await prisma.gpSongSection.delete({ where: { id: sectionId } });
  return NextResponse.json({ success: true });
}
