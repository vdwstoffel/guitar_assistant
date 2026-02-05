import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface CreateChapterBody {
  name: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookId } = await params;
    const body: CreateChapterBody = await request.json();
    const { name } = body;

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

    // Create the chapter
    const chapter = await prisma.chapter.create({
      data: {
        name: name.trim(),
        bookId,
        sortOrder,
      },
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

    return NextResponse.json(chapter, { status: 201 });
  } catch (error) {
    console.error("Error creating chapter:", error);
    return NextResponse.json(
      { error: "Failed to create chapter" },
      { status: 500 }
    );
  }
}
