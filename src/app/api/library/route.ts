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
                orderBy: { trackNumber: "asc" },
                select: { filePath: true, completed: true },
              },
              videos: {
                select: { completed: true },
              },
              chapters: {
                include: {
                  tracks: {
                    select: { completed: true },
                  },
                  videos: {
                    select: { completed: true },
                  },
                },
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
          pdfs: {
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { title: "asc" },
      }),
    ]);

    // Transform to lightweight AuthorSummary format
    const authors = authorsRaw.map((author) => ({
      id: author.id,
      name: author.name,
      books: author.books.map((book) => {
        // Collect all tracks (from book and chapters)
        const allTracks = [
          ...book.tracks,
          ...book.chapters.flatMap(ch => ch.tracks),
        ];
        // Collect all videos (from book and chapters)
        const allVideos = [
          ...book.videos,
          ...book.chapters.flatMap(ch => ch.videos),
        ];

        // Calculate completion
        const completedTracks = allTracks.filter(t => t.completed).length;
        const completedVideos = allVideos.filter(v => v.completed).length;
        const completedCount = completedTracks + completedVideos;
        const totalCount = allTracks.length + allVideos.length;

        return {
          id: book.id,
          name: book.name,
          authorId: book.authorId,
          pdfPath: book.pdfPath,
          inProgress: book.inProgress,
          trackCount: book._count.tracks,
          coverTrackPath: book.tracks[0]?.filePath ?? null,
          completedCount,
          totalCount,
        };
      }),
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
