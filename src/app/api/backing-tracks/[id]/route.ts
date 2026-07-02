import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NOTES, SCALE_FORMULAS } from "@/lib/musicTheory";

function isValidRootNote(note: unknown): note is string {
  return typeof note === "string" && (NOTES as readonly string[]).includes(note);
}

function isValidScaleType(scale: unknown): scale is string {
  if (typeof scale !== "string") return false;
  if (scale === "None") return false;
  return Object.prototype.hasOwnProperty.call(SCALE_FORMULAS, scale);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const track = await prisma.backingTrack.findUnique({ where: { id } });
  if (!track) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(track);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { title?: unknown; rootNote?: unknown; scaleType?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: { title?: string; rootNote?: string; scaleType?: string } = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "title must be a non-empty string" }, { status: 400 });
    }
    data.title = body.title.trim();
  }

  if (body.rootNote !== undefined) {
    if (!isValidRootNote(body.rootNote)) {
      return NextResponse.json({ error: `Invalid rootNote. Must be one of: ${NOTES.join(", ")}` }, { status: 400 });
    }
    data.rootNote = body.rootNote;
  }

  if (body.scaleType !== undefined) {
    if (!isValidScaleType(body.scaleType)) {
      return NextResponse.json({ error: "Invalid scaleType." }, { status: 400 });
    }
    data.scaleType = body.scaleType;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const existing = await prisma.backingTrack.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.backingTrack.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.backingTrack.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.backingTrack.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
