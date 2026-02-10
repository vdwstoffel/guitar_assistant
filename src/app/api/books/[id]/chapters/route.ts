import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface CreateChapterBody {
  name: string;
  trackIds?: string[];
  videoIds?: string[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookId } = await params;
    const body: CreateChapterBody = await request.json();
    const { name, trackIds, videoIds } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Chapter name is required" },
        { status: 400 }
      );
    }

    // Verify book exists
    const book = await prisma.book.findUnique({
      where: { id: bookId },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Get the highest sortOrder for this book's chapters
    const lastChapter = await prisma.chapter.findFirst({
      where: { bookId },
      orderBy: { sortOrder: "desc" },
    });

    const sortOrder = lastChapter ? lastChapter.sortOrder + 1 : 0;

    // Create the chapter and assign tracks in a transaction
    const chapter = await prisma.$transaction(async (tx) => {
      const created = await tx.chapter.create({
        data: {
          name: name.trim(),
          bookId,
          sortOrder,
        },
      });

      // Assign tracks to the new chapter if trackIds provided
      if (trackIds && trackIds.length > 0) {
        await tx.track.updateMany({
          where: {
            id: { in: trackIds },
            bookId,
          },
          data: { chapterId: created.id },
        });
      }

      // Assign videos to the new chapter if videoIds provided
      if (videoIds && videoIds.length > 0) {
        await tx.bookVideo.updateMany({
          where: {
            id: { in: videoIds },
            bookId,
          },
          data: { chapterId: created.id },
        });
      }

      return tx.chapter.findUnique({
        where: { id: created.id },
        include: {
          tracks: {
            orderBy: { sortOrder: "asc" },
            include: {
              markers: {
                orderBy: { timestamp: "asc" },
              },
            },
          },
          videos: {
            orderBy: { sortOrder: "asc" },
          },
        },
      });
    });

    return NextResponse.json(chapter, { status: 201 });
  } catch (error) {
    console.error("Error creating chapter:", error);
    return NextResponse.json(
      { error: "Failed to create chapter" },
      { status: 500 }
    );
  }
}
