import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [tracks, jamTracks] = await Promise.all([
      prisma.track.findMany({
        where: { completed: true },
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
          practiceSessions: {
            orderBy: { startTime: "desc" },
            take: 1,
            select: { startTime: true },
          },
        },
      }),
      prisma.jamTrack.findMany({
        where: { completed: true },
        select: {
          id: true,
          title: true,
          practiceSessions: {
            orderBy: { startTime: "desc" },
            take: 1,
            select: { startTime: true },
          },
        },
      }),
    ]);

    const items = [
      ...tracks.map((t) => ({
        trackId: t.id,
        jamTrackId: null,
        title: t.title,
        bookName: t.book.name,
        authorId: t.book.authorId,
        bookId: t.bookId,
        lastPracticed: t.practiceSessions[0]?.startTime.toISOString() ?? null,
      })),
      ...jamTracks.map((jt) => ({
        trackId: null,
        jamTrackId: jt.id,
        title: jt.title,
        bookName: null,
        authorId: null,
        bookId: null,
        lastPracticed: jt.practiceSessions[0]?.startTime.toISOString() ?? null,
      })),
    ];

    // Sort by lastPracticed ascending (oldest first = most in need of revisiting)
    // Tracks with no practice sessions go to the top
    items.sort((a, b) => {
      if (!a.lastPracticed && !b.lastPracticed) return 0;
      if (!a.lastPracticed) return -1;
      if (!b.lastPracticed) return 1;
      return new Date(a.lastPracticed).getTime() - new Date(b.lastPracticed).getTime();
    });

    // Seeded PRNG (LCG) — seed changes once per day so results are stable within a day
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    let seed = parseInt(today, 10);
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0xffffffff;
    };

    const oldest5 = items.slice(0, 5);
    const remaining = items.slice(5);

    // Pick 5 deterministic-random from the remaining pool
    const random5: typeof items = [];
    const pool = [...remaining];
    while (random5.length < 5 && pool.length > 0) {
      const idx = Math.floor(rand() * pool.length);
      random5.push(pool.splice(idx, 1)[0]);
    }

    // Combine and shuffle deterministically
    const combined = [...oldest5, ...random5];
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }

    return NextResponse.json(combined);
  } catch (error) {
    console.error("Error fetching revisit tracks:", error);
    return NextResponse.json(
      { error: "Failed to fetch revisit tracks" },
      { status: 500 }
    );
  }
}
