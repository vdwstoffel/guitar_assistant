import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [tracks, jamTracks, bookVideos, videos] = await Promise.all([
      prisma.track.findMany({
        where: { inProgress: true, completed: false, book: { inProgress: true } },
        select: {
          id: true,
          title: true,
          bookId: true,
          sourceVideoId: true,
          lastPlayedAt: true,
          book: { select: { name: true, authorId: true } },
          sourceVideo: { select: { lastPlayedAt: true } },
        },
      }),
      prisma.jamTrack.findMany({
        where: { inProgress: true, completed: false },
        select: { id: true, title: true, lastPlayedAt: true },
      }),
      prisma.bookVideo.findMany({
        where: {
          inProgress: true,
          completed: false,
          extractedTrack: null,
          book: { inProgress: true },
        },
        select: {
          id: true,
          title: true,
          filename: true,
          bookId: true,
          lastPlayedAt: true,
          book: { select: { name: true, authorId: true } },
        },
      }),
      prisma.video.findMany({
        where: { inProgress: true, completed: false },
        select: { id: true, title: true, lastPlayedAt: true },
      }),
    ]);

    const items = [
      ...tracks.map((t) => {
        // Merge lastPlayed from the track and its linked extracted video; take the later.
        const trackLast = t.lastPlayedAt;
        const videoLast = t.sourceVideo?.lastPlayedAt ?? null;
        const lastPlayed =
          trackLast && videoLast
            ? trackLast > videoLast
              ? trackLast
              : videoLast
            : trackLast ?? videoLast ?? null;
        return {
          trackId: t.id, jamTrackId: null, bookVideoId: null, videoId: null,
          title: t.title, bookName: t.book.name, authorId: t.book.authorId, bookId: t.bookId,
          lastPracticed: lastPlayed?.toISOString() ?? null,
        };
      }),
      ...jamTracks.map((jt) => ({
        trackId: null, jamTrackId: jt.id, bookVideoId: null, videoId: null,
        title: jt.title, bookName: null, authorId: null, bookId: null,
        lastPracticed: jt.lastPlayedAt?.toISOString() ?? null,
      })),
      ...bookVideos.map((bv) => ({
        trackId: null, jamTrackId: null, bookVideoId: bv.id, videoId: null,
        title: bv.title ?? bv.filename, bookName: bv.book.name, authorId: bv.book.authorId, bookId: bv.bookId,
        lastPracticed: bv.lastPlayedAt?.toISOString() ?? null,
      })),
      ...videos.map((v) => ({
        trackId: null, jamTrackId: null, bookVideoId: null, videoId: v.id,
        title: v.title, bookName: null, authorId: null, bookId: null,
        lastPracticed: v.lastPlayedAt?.toISOString() ?? null,
      })),
    ];

    // Not-practiced-today first, practiced-today at the bottom.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    items.sort((a, b) => {
      const aToday = a.lastPracticed && new Date(a.lastPracticed) >= todayStart ? 1 : 0;
      const bToday = b.lastPracticed && new Date(b.lastPracticed) >= todayStart ? 1 : 0;
      return aToday - bToday;
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching in-progress items:", error);
    return NextResponse.json({ error: "Failed to fetch in-progress items" }, { status: 500 });
  }
}
