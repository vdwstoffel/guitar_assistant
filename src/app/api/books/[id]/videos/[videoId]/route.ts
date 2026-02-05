import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

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
