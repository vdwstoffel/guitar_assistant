import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pdfId: string }> }
) {
  const { pdfId } = await params;
  const { name } = await request.json();
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }
  const updated = await prisma.jamTrackPdf.update({
    where: { id: pdfId },
    data: { name: name.trim() },
    include: { pageFlips: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; pdfId: string }> }
) {
  const { pdfId } = await params;
  const pdf = await prisma.jamTrackPdf.findUnique({ where: { id: pdfId } });
  if (!pdf) return NextResponse.json({ error: "PDF not found" }, { status: 404 });
  try {
    await fs.unlink(path.join(path.resolve(MUSIC_DIR), pdf.filePath));
  } catch { /* file may already be gone */ }
  await prisma.jamTrackPdf.delete({ where: { id: pdfId } });
  return NextResponse.json({ success: true });
}
