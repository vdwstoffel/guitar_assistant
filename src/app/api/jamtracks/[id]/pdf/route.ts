import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "_") || "tab";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pdfs = await prisma.jamTrackPdf.findMany({
    where: { jamTrackId: id },
    orderBy: { sortOrder: "asc" },
    include: { pageFlips: true },
  });
  return NextResponse.json(pdfs);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const jamTrack = await prisma.jamTrack.findUnique({ where: { id } });
    if (!jamTrack) return NextResponse.json({ error: "Jam track not found" }, { status: 404 });

    const form = await request.formData();
    const file = form.get("file") as File | null;
    const rawName = (form.get("name") as string | null)?.trim();
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (path.extname(file.name).toLowerCase() !== ".pdf") {
      return NextResponse.json({ error: "Only .pdf files are supported" }, { status: 400 });
    }
    const displayName = rawName || file.name.replace(/\.pdf$/i, "");

    const musicPath = path.resolve(MUSIC_DIR);
    const trackFolder = path.dirname(path.join(musicPath, jamTrack.filePath));
    await fs.mkdir(trackFolder, { recursive: true });

    // Unique filename within the folder
    let base = sanitize(displayName);
    let fileName = `${base}.pdf`;
    let n = 1;
    while (await fs.stat(path.join(trackFolder, fileName)).then(() => true).catch(() => false)) {
      fileName = `${base}_${n++}.pdf`;
    }
    const targetAbs = path.join(trackFolder, fileName);
    await fs.writeFile(targetAbs, Buffer.from(await file.arrayBuffer()));

    const count = await prisma.jamTrackPdf.count({ where: { jamTrackId: id } });
    const created = await prisma.jamTrackPdf.create({
      data: {
        jamTrackId: id,
        name: displayName,
        filePath: path.relative(musicPath, targetAbs),
        sortOrder: count,
      },
      include: { pageFlips: true },
    });
    return NextResponse.json(created);
  } catch (e) {
    console.error("Error uploading jam track PDF:", e);
    return NextResponse.json({ error: "Failed to upload PDF" }, { status: 500 });
  }
}
