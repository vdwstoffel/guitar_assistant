import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

// Helper function to sanitize filenames
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.\-_() ]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

// PUT - Update video filename and/or sortOrder
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  try {
    const { videoId } = await params;
    const { filename, sortOrder, title, trackNumber, pdfPage, completed, chapterId } = await request.json();

    if (!filename || !filename.trim()) {
      return NextResponse.json(
        { error: "Filename is required" },
        { status: 400 }
      );
    }

    // Get video info
    const video = await prisma.bookVideo.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Validate sortOrder if it changed
    if (sortOrder !== undefined && sortOrder !== video.sortOrder) {
      const videoCount = await prisma.bookVideo.count({
        where: { bookId: video.bookId },
      });

      if (sortOrder < 0 || sortOrder >= videoCount) {
        return NextResponse.json(
          { error: `Sort order must be between 0 and ${videoCount - 1}` },
          { status: 400 }
        );
      }
    }

    // Sanitize and validate new filename
    const sanitizedFilename = sanitizeFilename(filename.trim());
    const ext = path.extname(video.filename);

    // If the new filename doesn't have an extension, add the original one
    const newFilename = sanitizedFilename.endsWith(ext)
      ? sanitizedFilename
      : sanitizedFilename + ext;

    // Only rename file if filename has changed
    if (newFilename !== video.filename) {
      // Get the directory path
      const oldFullPath = path.join(MUSIC_DIR, video.filePath);
      const dir = path.dirname(oldFullPath);
      const newFullPath = path.join(dir, newFilename);

      // Check if new filename already exists
      if (fs.existsSync(newFullPath)) {
        return NextResponse.json(
          { error: "A video with this name already exists" },
          { status: 409 }
        );
      }

      // Rename the file
      try {
        fs.renameSync(oldFullPath, newFullPath);
      } catch (error) {
        console.error("Error renaming video file:", error);
        return NextResponse.json(
          { error: "Failed to rename video file" },
          { status: 500 }
        );
      }
    }

    // Handle sortOrder change if provided
    if (sortOrder !== undefined && sortOrder !== video.sortOrder) {
      // Get all videos for this book, ordered by sortOrder
      const allVideos = await prisma.bookVideo.findMany({
        where: { bookId: video.bookId },
        orderBy: { sortOrder: "asc" },
      });

      // Reorder videos
      const oldIndex = allVideos.findIndex((v) => v.id === videoId);
      const newIndex = sortOrder;

      if (oldIndex !== -1) {
        // Remove video from old position
        const videoToMove = allVideos[oldIndex];
        allVideos.splice(oldIndex, 1);

        // Insert at new position
        allVideos.splice(newIndex, 0, videoToMove);

        // Update sortOrder for all affected videos
        const updates = allVideos.map((v, index) =>
          prisma.bookVideo.update({
            where: { id: v.id },
            data: { sortOrder: index },
          })
        );

        await Promise.all(updates);
      }
    }

    // Update the database with filename changes and other fields
    const newFilePath = path.join(path.dirname(video.filePath), newFilename);
    const updateData: {
      filename: string;
      filePath: string;
      title?: string | null;
      trackNumber?: number | null;
      pdfPage?: number | null;
      completed?: boolean;
      chapterId?: string | null;
    } = {
      filename: newFilename,
      filePath: newFilePath,
    };

    // Add optional fields if provided
    if (title !== undefined) {
      updateData.title = title;
    }
    if (trackNumber !== undefined) {
      updateData.trackNumber = trackNumber;
    }
    if (pdfPage !== undefined) {
      updateData.pdfPage = pdfPage;
    }
    if (completed !== undefined) {
      updateData.completed = completed;
    }
    if (chapterId !== undefined) {
      updateData.chapterId = chapterId;
    }

    const updatedVideo = await prisma.bookVideo.update({
      where: { id: videoId },
      data: updateData,
    });

    return NextResponse.json(updatedVideo);
  } catch (error) {
    console.error("Error updating video:", error);
    return NextResponse.json(
      { error: "Failed to update video" },
      { status: 500 }
    );
  }
}
