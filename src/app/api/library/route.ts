import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [authorsRaw, jamTracks] = await Promise.all([
      prisma.author.findMany({
        include: {
          books: {
            orderBy: { name: "asc" },
            include: {
              _count: { select: { tracks: true } },
              tracks: {
                take: 1,
                orderBy: { trackNumber: "asc" },
                select: { filePath: true },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.jamTrack.findMany({
        include: {
          markers: {
            orderBy: { timestamp: "asc" },
          },
          tabSyncPoints: {
            orderBy: { audioTime: "asc" },
          },
        },
        orderBy: { title: "asc" },
      }),
    ]);

    // Transform to lightweight AuthorSummary format
    const authors = authorsRaw.map((author) => ({
      id: author.id,
      name: author.name,
      books: author.books.map((book) => ({
        id: book.id,
        name: book.name,
        authorId: book.authorId,
        pdfPath: book.pdfPath,
        inProgress: book.inProgress,
        trackCount: book._count.tracks,
        coverTrackPath: book.tracks[0]?.filePath ?? null,
      })),
    }));

    return NextResponse.json({ authors, jamTracks });
  } catch (error) {
    console.error("Error fetching library:", error);
    return NextResponse.json(
      { error: "Failed to fetch library" },
      { status: 500 }
    );
  }
}
