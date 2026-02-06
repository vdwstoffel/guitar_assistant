import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [book, totalTrackCount] = await Promise.all([
      prisma.book.findUnique({
        where: { id },
        include: {
          tracks: {
            where: { chapterId: null },
            orderBy: { trackNumber: "asc" },
            include: {
              markers: {
                orderBy: { timestamp: "asc" },
              },
            },
          },
          chapters: {
            orderBy: { sortOrder: "asc" },
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
          },
          videos: {
            where: { chapterId: null },
            orderBy: { sortOrder: "asc" },
          },
        },
      }),
      prisma.track.count({ where: { bookId: id } }),
    ]);

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Find cover track path (first track by trackNumber across all tracks)
    const firstTrack = await prisma.track.findFirst({
      where: { bookId: id },
      orderBy: { trackNumber: "asc" },
      select: { filePath: true },
    });

    return NextResponse.json({
      ...book,
      trackCount: totalTrackCount,
      coverTrackPath: firstTrack?.filePath ?? null,
    });
  } catch (error) {
    console.error("Error fetching book detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch book detail" },
      { status: 500 }
    );
  }
}
