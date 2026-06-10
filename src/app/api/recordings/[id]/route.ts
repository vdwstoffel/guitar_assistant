import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: { title?: string; notes?: string | null } = {};
    if (typeof body.title === "string") data.title = body.title.trim();
    if (body.notes === null || typeof body.notes === "string") data.notes = body.notes;

    const recording = await prisma.recording.update({
      where: { id },
      data,
    });
    return NextResponse.json(recording);
  } catch (error) {
    console.error("Error updating recording:", error);
    return NextResponse.json(
      { error: "Failed to update recording" },
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
    const recording = await prisma.recording.findUnique({ where: { id } });
    if (!recording) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const musicPath = path.resolve(MUSIC_DIR);
    const absolutePath = path.resolve(path.join(musicPath, recording.filePath));
    if (absolutePath.startsWith(musicPath)) {
      try {
        await fs.unlink(absolutePath);
      } catch (err) {
        console.warn(`Could not delete file ${absolutePath}:`, err);
      }
    }

    await prisma.recording.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting recording:", error);
    return NextResponse.json(
      { error: "Failed to delete recording" },
      { status: 500 }
    );
  }
}
