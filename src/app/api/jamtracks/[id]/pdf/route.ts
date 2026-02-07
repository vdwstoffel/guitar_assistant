import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

const jamTrackInclude = {
  markers: { orderBy: { timestamp: "asc" as const } },
  pdfs: {
    include: { pageSyncPoints: { orderBy: { timeInSeconds: "asc" as const } } },
    orderBy: { sortOrder: "asc" as const },
  },
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("pdf") as File;
    const name = formData.get("name") as string;

    if (!file) {
      return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "PDF name is required" }, { status: 400 });
    }

    const jamTrack = await prisma.jamTrack.findUnique({ where: { id } });
    if (!jamTrack) {
      return NextResponse.json({ error: "Jam track not found" }, { status: 404 });
    }

    // Build file path in the jam track's folder
    const audioDir = path.dirname(jamTrack.filePath);
    const sanitizedName = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    let filename = `${sanitizedName}.pdf`;
    let filePath = path.join(audioDir, filename);
    let absolutePath = path.join(MUSIC_DIR, filePath);

    // Handle filename collisions
    let counter = 1;
    while (await fileExists(absolutePath)) {
      filename = `${sanitizedName}-${counter}.pdf`;
      filePath = path.join(audioDir, filename);
      absolutePath = path.join(MUSIC_DIR, filePath);
      counter++;
    }

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(absolutePath, buffer);

    // Get next sortOrder
    const maxPdf = await prisma.jamTrackPdf.findFirst({
      where: { jamTrackId: id },
      orderBy: { sortOrder: "desc" },
    });
    const nextSortOrder = (maxPdf?.sortOrder ?? -1) + 1;

    // Create JamTrackPdf record
    await prisma.jamTrackPdf.create({
      data: {
        name: name.trim(),
        filePath,
        sortOrder: nextSortOrder,
        jamTrackId: id,
      },
    });

    // Return updated jam track with all PDFs
    const updatedJamTrack = await prisma.jamTrack.findUnique({
      where: { id },
      include: jamTrackInclude,
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
    const { searchParams } = new URL(request.url);
    const pdfId = searchParams.get("pdfId");

    if (!pdfId) {
      return NextResponse.json({ error: "pdfId query parameter required" }, { status: 400 });
    }

    const jamTrackPdf = await prisma.jamTrackPdf.findUnique({ where: { id: pdfId } });
    if (!jamTrackPdf || jamTrackPdf.jamTrackId !== id) {
      return NextResponse.json({ error: "PDF not found" }, { status: 404 });
    }

    // Delete file from disk
    const absolutePath = path.join(MUSIC_DIR, jamTrackPdf.filePath);
    try {
      await fs.unlink(absolutePath);
    } catch {
      // File may not exist, continue anyway
    }

    // Delete database record (cascade will delete pageSyncPoints)
    await prisma.jamTrackPdf.delete({ where: { id: pdfId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting PDF:", error);
    return NextResponse.json({ error: "Failed to delete PDF" }, { status: 500 });
  }
}
