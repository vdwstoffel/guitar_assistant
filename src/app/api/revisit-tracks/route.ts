import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const [tracks, jamTracks, todayTrackSessions, todayJamSessions] = await Promise.all([
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
          // Most recent practice session BEFORE today — keeps ranking stable
          // even after the user practices a track during the day.
          practiceSessions: {
            where: { startTime: { lt: startOfToday } },
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
            where: { startTime: { lt: startOfToday } },
            orderBy: { startTime: "desc" },
            take: 1,
            select: { startTime: true },
          },
        },
      }),
      prisma.practiceSession.findMany({
        where: { startTime: { gte: startOfToday }, trackId: { not: null } },
        select: { trackId: true },
        distinct: ["trackId"],
      }),
      prisma.practiceSession.findMany({
        where: { startTime: { gte: startOfToday }, jamTrackId: { not: null } },
        select: { jamTrackId: true },
        distinct: ["jamTrackId"],
      }),
    ]);

    const practicedTodayTrackIds = new Set(todayTrackSessions.map((s) => s.trackId!));
    const practicedTodayJamTrackIds = new Set(todayJamSessions.map((s) => s.jamTrackId!));

    const items = [
      ...tracks.map((t) => ({
        trackId: t.id,
        jamTrackId: null as string | null,
        title: t.title,
        bookName: t.book.name,
        authorId: t.book.authorId,
        bookId: t.bookId,
        lastPracticed: t.practiceSessions[0]?.startTime.toISOString() ?? null,
      })),
      ...jamTracks.map((jt) => ({
        trackId: null as string | null,
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

    // Drop items already practiced today so the user sees only what's left.
    const remainingForToday = combined.filter((item) => {
      if (item.trackId && practicedTodayTrackIds.has(item.trackId)) return false;
      if (item.jamTrackId && practicedTodayJamTrackIds.has(item.jamTrackId)) return false;
      return true;
    });

    return NextResponse.json(remainingForToday);
  } catch (error) {
    console.error("Error fetching revisit tracks:", error);
    return NextResponse.json(
      { error: "Failed to fetch revisit tracks" },
      { status: 500 }
    );
  }
}
