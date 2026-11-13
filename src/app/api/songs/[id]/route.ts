import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MAX_LYRICS } from "@/lib/songwriting/songs";
import { songToJson, SONG_INCLUDE } from "@/lib/songwriting/songJson";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const song = await prisma.composition.findUnique({ where: { id }, include: SONG_INCLUDE });
    if (!song) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(songToJson(song));
  } catch (error) {
    console.error("Error reading song:", error);
    return NextResponse.json({ error: "Failed to read song" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
    }
    const b = body as Record<string, unknown>;
    const data: { name?: string; lyrics?: string } = {};
    if (b.name !== undefined) {
      if (typeof b.name !== "string" || b.name.trim().length < 1 || b.name.trim().length > 80) {
        return NextResponse.json({ error: "name must be 1-80 characters" }, { status: 400 });
      }
      data.name = b.name.trim();
    }
    if (b.lyrics !== undefined) {
      if (typeof b.lyrics !== "string" || b.lyrics.length > MAX_LYRICS) {
        return NextResponse.json({ error: `lyrics must be text of at most ${MAX_LYRICS} characters` }, { status: 400 });
      }
      data.lyrics = b.lyrics;
    }
    if (!(await prisma.composition.findUnique({ where: { id }, select: { id: true } }))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const song = await prisma.composition.update({ where: { id }, data, include: SONG_INCLUDE });
    return NextResponse.json(songToJson(song));
  } catch (error) {
    console.error("Error updating song:", error);
    return NextResponse.json({ error: "Failed to update song" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!(await prisma.composition.findUnique({ where: { id }, select: { id: true } }))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.composition.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting song:", error);
    return NextResponse.json({ error: "Failed to delete song" }, { status: 500 });
  }
}
