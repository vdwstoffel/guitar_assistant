import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [tracks, jamTracks] = await Promise.all([
      prisma.track.findMany({
        where: { favorite: true },
        select: {
          id: true,
          title: true,
          bookId: true,
          book: {
            select: {
              name: true,
              authorId: true,
              author: { select: { name: true } },
            },
          },
        },
        orderBy: { title: "asc" },
      }),
      prisma.jamTrack.findMany({
        where: { favorite: true },
        select: {
          id: true,
          title: true,
        },
        orderBy: { title: "asc" },
      }),
    ]);

    return NextResponse.json({
      tracks: tracks.map((t) => ({
        trackId: t.id,
        title: t.title,
        bookId: t.bookId,
        bookName: t.book.name,
        authorId: t.book.authorId,
        authorName: t.book.author.name,
      })),
      jamTracks: jamTracks.map((jt) => ({
        jamTrackId: jt.id,
        title: jt.title,
      })),
    });
  } catch (error) {
    console.error("Error fetching favorites:", error);
    return NextResponse.json(
      { error: "Failed to fetch favorites" },
      { status: 500 }
    );
  }
}
