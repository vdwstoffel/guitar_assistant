import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

// PATCH - Update playback settings (volume). Kept separate from the `update`
// PUT route, which requires a filename and renames the file on disk.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  try {
    const { videoId } = await params;
    const { volume } = await request.json();

    if (volume === undefined) {
      return NextResponse.json(
        { error: "No supported fields to update" },
        { status: 400 }
      );
    }

    if (volume !== null && (typeof volume !== "number" || volume < 0 || volume > 100)) {
      return NextResponse.json(
        { error: "Volume must be between 0 and 100" },
        { status: 400 }
      );
    }

    const video = await prisma.bookVideo.update({
      where: { id: videoId },
      data: { volume: volume === null ? null : Math.round(volume) },
    });

    return NextResponse.json(video);
  } catch (error) {
    console.error("Error updating video playback settings:", error);
    return NextResponse.json(
      { error: "Failed to update video" },
      { status: 500 }
    );
  }
}

// DELETE - Remove video
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  try {
    const { videoId } = await params;

    // Get video info
    const video = await prisma.bookVideo.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Delete file from filesystem
    const videoPath = path.join(MUSIC_DIR, video.filePath);
    if (fs.existsSync(videoPath)) {
      try {
        fs.unlinkSync(videoPath);
      } catch (error) {
        console.error("Error deleting video file:", error);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete from database
    await prisma.bookVideo.delete({
      where: { id: videoId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting video:", error);
    return NextResponse.json(
      { error: "Failed to delete video" },
      { status: 500 }
    );
  }
}
