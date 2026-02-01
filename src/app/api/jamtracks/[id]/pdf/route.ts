import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("pdf") as File;

    if (!file) {
      return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
    }

    // Get jam track to verify it exists
    const jamTrack = await prisma.jamTrack.findUnique({
      where: { id },
    });

    if (!jamTrack) {
      return NextResponse.json({ error: "Jam track not found" }, { status: 404 });
    }

    // Get the folder where the audio file lives
    const audioDir = path.dirname(jamTrack.filePath);
    const pdfFileName = "sheet.pdf";
    const pdfPath = path.join(audioDir, pdfFileName);
    const absolutePath = path.join(MUSIC_DIR, pdfPath);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(absolutePath, buffer);

    // Update jam track with PDF path
    const updatedJamTrack = await prisma.jamTrack.update({
      where: { id },
      data: { pdfPath },
      include: {
        markers: {
          orderBy: { timestamp: "asc" },
        },
      },
    });

    return NextResponse.json(updatedJamTrack);
  } catch (error) {
    console.error("Error uploading PDF:", error);
    return NextResponse.json({ error: "Failed to upload PDF" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const jamTrack = await prisma.jamTrack.findUnique({
      where: { id },
    });

    if (!jamTrack) {
      return NextResponse.json({ error: "Jam track not found" }, { status: 404 });
    }

    if (jamTrack.pdfPath) {
      const absolutePath = path.join(MUSIC_DIR, jamTrack.pdfPath);
      try {
        await fs.unlink(absolutePath);
      } catch {
        // File may not exist, continue anyway
      }
    }

    await prisma.jamTrack.update({
      where: { id },
      data: { pdfPath: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting PDF:", error);
    return NextResponse.json({ error: "Failed to delete PDF" }, { status: 500 });
  }
}
