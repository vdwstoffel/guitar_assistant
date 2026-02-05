import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface UpdateChapterBody {
  name?: string;
  sortOrder?: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const chapter = await prisma.chapter.findUnique({
      where: { id },
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

    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    return NextResponse.json(chapter);
  } catch (error) {
    console.error("Error fetching chapter:", error);
    return NextResponse.json(
      { error: "Failed to fetch chapter" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateChapterBody = await request.json();

    // Build update data
    const updateData: any = {};
    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return NextResponse.json(
          { error: "Chapter name cannot be empty" },
          { status: 400 }
        );
      }
      updateData.name = body.name.trim();
    }
    if (body.sortOrder !== undefined) {
      updateData.sortOrder = body.sortOrder;
    }

    const chapter = await prisma.chapter.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(chapter);
  } catch (error) {
    console.error("Error updating chapter:", error);
    return NextResponse.json(
      { error: "Failed to update chapter" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // First, move all tracks and videos to uncategorized (set chapterId to null)
    await prisma.$transaction([
      prisma.track.updateMany({
        where: { chapterId: id },
        data: { chapterId: null },
      }),
      prisma.bookVideo.updateMany({
        where: { chapterId: id },
        data: { chapterId: null },
      }),
    ]);

    // Now delete the chapter
    await prisma.chapter.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting chapter:", error);
    return NextResponse.json(
      { error: "Failed to delete chapter" },
      { status: 500 }
    );
  }
}
