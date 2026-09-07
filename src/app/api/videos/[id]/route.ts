import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, category, completed, inProgress, notes } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const data: Record<string, unknown> = {
      title: title.trim(),
      ...(category !== undefined && { category: category || null }),
    };
    if (completed !== undefined) {
      data.completed = completed;
      data.completedAt = completed ? new Date() : null;
      if (completed) data.inProgress = false;
    }
    if (inProgress !== undefined) {
      data.inProgress = inProgress;
      if (inProgress) data.completed = false;
    }
    if (notes !== undefined) {
      data.notes = notes;
    }

    const video = await prisma.video.update({
      where: { id },
      data,
    });

    return NextResponse.json(video);
  } catch (error) {
    console.error("Error updating video:", error);
    return NextResponse.json({ error: "Failed to update video" }, { status: 500 });
  }
}

// PATCH - Update playback settings (volume). Kept separate from the PUT
// handler above, which requires a title.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { volume } = await request.json();

    if (volume === undefined) {
      return NextResponse.json({ error: "No supported fields to update" }, { status: 400 });
    }

    if (volume !== null && (typeof volume !== "number" || volume < 0 || volume > 100)) {
      return NextResponse.json({ error: "Volume must be between 0 and 100" }, { status: 400 });
    }

    const video = await prisma.video.update({
      where: { id },
      data: { volume: volume === null ? null : Math.round(volume) },
    });

    return NextResponse.json(video);
  } catch (error) {
    console.error("Error updating video playback settings:", error);
    return NextResponse.json({ error: "Failed to update video" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Look up the video first so we can clean up local files.
    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
    const musicRoot = path.resolve(MUSIC_DIR);

    // Delete the local MP4 file if it exists and is safely inside MUSIC_DIR.
    if (video.localPath) {
      const mp4Path = path.resolve(MUSIC_DIR, video.localPath);
      if (mp4Path === musicRoot || mp4Path.startsWith(musicRoot + path.sep)) {
        try {
          await fs.unlink(mp4Path);
        } catch (err) {
          console.error(`Failed to delete video file ${mp4Path}:`, err);
        }
      }
    }

    // Delete the thumbnail (<id>.jpg) from music/Videos/.
    const thumbPath = path.resolve(MUSIC_DIR, "Videos", `${id}.jpg`);
    if (thumbPath === musicRoot || thumbPath.startsWith(musicRoot + path.sep)) {
      try {
        await fs.unlink(thumbPath);
      } catch (err) {
        console.error(`Failed to delete thumbnail ${thumbPath}:`, err);
      }
    }

    await prisma.video.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting video:", error);
    return NextResponse.json({ error: "Failed to delete video" }, { status: 500 });
  }
}
