import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q");

    if (!query || query.length < 2) {
      return NextResponse.json({ tracks: [], books: [], jamTracks: [] });
    }

    const [tracks, books, jamTracks] = await Promise.all([
      prisma.track.findMany({
        where: {
          title: { contains: query },
        },
        take: 10,
        select: {
          id: true,
          title: true,
          trackNumber: true,
          bookId: true,
          book: {
            select: {
              id: true,
              name: true,
              authorId: true,
              pdfPath: true,
              author: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { title: "asc" },
      }),

      prisma.book.findMany({
        where: {
          name: { contains: query },
        },
        take: 5,
        select: {
          id: true,
          name: true,
          authorId: true,
          pdfPath: true,
          author: {
            select: { id: true, name: true },
          },
        },
        orderBy: { name: "asc" },
      }),

      prisma.jamTrack.findMany({
        where: {
          title: { contains: query },
        },
        take: 5,
        select: {
          id: true,
          title: true,
          duration: true,
        },
        orderBy: { title: "asc" },
      }),
    ]);

    return NextResponse.json({ tracks, books, jamTracks });
  } catch (error) {
    console.error("Error searching:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
