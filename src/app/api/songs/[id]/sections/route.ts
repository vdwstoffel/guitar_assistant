import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseSectionsInput } from "@/lib/songwriting/songs";
import { songToJson, SONG_INCLUDE } from "@/lib/songwriting/songJson";

type Ctx = { params: Promise<{ id: string }> };

class BadRequest extends Error {}

/** Replaces the song's whole ordered section list. */
export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
    }
    const parsed = parseSectionsInput(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const sections = parsed.value;

    const song = await prisma.$transaction(async (tx) => {
      if (!(await tx.composition.findUnique({ where: { id }, select: { id: true } }))) return null;
      const riffIds = [...new Set(sections.map((s) => s.riffId).filter((r): r is string => r !== null))];
      if (riffIds.length) {
        const found = await tx.riff.count({ where: { id: { in: riffIds } } });
        if (found !== riffIds.length) throw new BadRequest("riffId does not match a riff");
      }
      await tx.compositionSection.deleteMany({ where: { compositionId: id } });
      if (sections.length) {
        await tx.compositionSection.createMany({
          data: sections.map((s, i) => ({ compositionId: id, riffId: s.riffId, label: s.label, repeats: s.repeats, sortOrder: i })),
        });
      }
      // Touch the song so its updatedAt reflects the change.
      return tx.composition.update({ where: { id }, data: { updatedAt: new Date() }, include: SONG_INCLUDE });
    });
    if (!song) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(songToJson(song));
  } catch (error) {
    if (error instanceof BadRequest) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Error saving sections:", error);
    return NextResponse.json({ error: "Failed to save sections" }, { status: 500 });
  }
}
