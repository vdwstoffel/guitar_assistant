import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
const VALID_TAB_EXTENSIONS = [".gp", ".gp3", ".gp4", ".gp5", ".gpx"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("tab") as File;

    if (!file) {
      return NextResponse.json({ error: "No tab file provided" }, { status: 400 });
    }

    const fileExt = path.extname(file.name).toLowerCase();
    if (!VALID_TAB_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json(
        { error: `File must be a Guitar Pro file (${VALID_TAB_EXTENSIONS.join(", ")})` },
        { status: 400 }
      );
    }

    const jamTrack = await prisma.jamTrack.findUnique({
      where: { id },
    });

    if (!jamTrack) {
      return NextResponse.json({ error: "Jam track not found" }, { status: 404 });
    }

    const audioDir = path.dirname(jamTrack.filePath);
    const tabFileName = `tab${fileExt}`;
    const tabPath = path.join(audioDir, tabFileName);
    const absolutePath = path.join(MUSIC_DIR, tabPath);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(absolutePath, buffer);

    const updatedJamTrack = await prisma.jamTrack.update({
      where: { id },
      data: { tabPath },
      include: {
        markers: {
          orderBy: { timestamp: "asc" },
        },
        tabSyncPoints: {
          orderBy: { audioTime: "asc" },
        },
      },
    });

    return NextResponse.json(updatedJamTrack);
  } catch (error) {
    console.error("Error uploading tab:", error);
    return NextResponse.json({ error: "Failed to upload tab" }, { status: 500 });
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

    if (jamTrack.tabPath) {
      const absolutePath = path.join(MUSIC_DIR, jamTrack.tabPath);
      try {
        await fs.unlink(absolutePath);
      } catch {
        // File may not exist, continue anyway
      }
    }

    // Clear tab path and delete all sync points
    await prisma.$transaction([
      prisma.tabSyncPoint.deleteMany({
        where: { jamTrackId: id },
      }),
      prisma.jamTrack.update({
        where: { id },
        data: { tabPath: null },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting tab:", error);
    return NextResponse.json({ error: "Failed to delete tab" }, { status: 500 });
  }
}
