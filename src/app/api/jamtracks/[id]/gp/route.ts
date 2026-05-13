import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
const SUPPORTED_EXTENSIONS = [".gp", ".gp3", ".gp4", ".gp5", ".gpx", ".gp7"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const jamTrack = await prisma.jamTrack.findUnique({ where: { id } });
    if (!jamTrack) {
      return NextResponse.json({ error: "Jam track not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${ext}. Use .gp, .gp3-7, or .gpx.` },
        { status: 400 }
      );
    }

    const musicPath = path.resolve(MUSIC_DIR);
    const audioAbs = path.join(musicPath, jamTrack.filePath);
    const trackFolder = path.dirname(audioAbs);
    await fs.mkdir(trackFolder, { recursive: true });

    // Replace any existing GP file for this jam track
    if (jamTrack.gpFilePath) {
      const oldAbs = path.join(musicPath, jamTrack.gpFilePath);
      try {
        await fs.unlink(oldAbs);
      } catch {
        /* ignore */
      }
    }

    const fileName = `tab${ext}`;
    const targetAbs = path.join(trackFolder, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(targetAbs, buffer);

    const relPath = path.relative(musicPath, targetAbs);
    const updated = await prisma.jamTrack.update({
      where: { id },
      data: { gpFilePath: relPath },
    });

    return NextResponse.json({ ...updated, markers: [] });
  } catch (error) {
    console.error("Error uploading GP file:", error);
    return NextResponse.json(
      { error: "Failed to upload GP file" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const jamTrack = await prisma.jamTrack.findUnique({ where: { id } });
    if (!jamTrack) {
      return NextResponse.json({ error: "Jam track not found" }, { status: 404 });
    }

    if (jamTrack.gpFilePath) {
      const musicPath = path.resolve(MUSIC_DIR);
      const abs = path.join(musicPath, jamTrack.gpFilePath);
      try {
        await fs.unlink(abs);
      } catch {
        /* ignore */
      }
    }

    const updated = await prisma.jamTrack.update({
      where: { id },
      data: { gpFilePath: null },
    });
    return NextResponse.json({ ...updated, markers: [] });
  } catch (error) {
    console.error("Error removing GP file:", error);
    return NextResponse.json(
      { error: "Failed to remove GP file" },
      { status: 500 }
    );
  }
}
