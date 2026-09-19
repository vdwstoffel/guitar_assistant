import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createDailyRandom, shuffleInPlace } from "@/lib/dailyRandom";

/** How many finished tracks get folded back into the practice list. */
const REVISIT_COUNT = 2;
/** The stalest N completed tracks the revisit picks are drawn from. */
const REVISIT_POOL_SIZE = 10;

interface PracticeItem {
  trackId: string | null;
  jamTrackId: string | null;
  bookVideoId: string | null;
  videoId: string | null;
  title: string;
  bookName: string | null;
  authorId: string | null;
  bookId: string | null;
  lastPracticed: string | null;
  isRevisit: boolean;
}

/**
 * The stalest completed track plus one random pick from the rest of the ten
 * stalest, so there is always a familiar piece in the rotation without it
 * being the same familiar piece every day.
 */
function pickRevisitItems(pool: PracticeItem[], rand: () => number): PracticeItem[] {
  const oldest = pool.slice(0, REVISIT_POOL_SIZE);
  if (oldest.length === 0) return [];

  const picks = [oldest[0]];
  const rest = oldest.slice(1);
  if (rest.length > 0 && picks.length < REVISIT_COUNT) {
    picks.push(rest[Math.floor(rand() * rest.length)]);
  }
  return picks;
}

export async function GET() {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [tracks, jamTracks, bookVideos, videos, completedTracks, completedJamTracks] =
      await Promise.all([
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
        prisma.track.findMany({
          where: { completed: true },
          select: {
            id: true,
            title: true,
            bookId: true,
            lastPlayedAt: true,
            book: { select: { name: true, authorId: true } },
          },
        }),
        prisma.jamTrack.findMany({
          where: { completed: true },
          select: { id: true, title: true, lastPlayedAt: true },
        }),
      ]);

    const items: PracticeItem[] = [
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
          isRevisit: false,
        };
      }),
      ...jamTracks.map((jt) => ({
        trackId: null, jamTrackId: jt.id, bookVideoId: null, videoId: null,
        title: jt.title, bookName: null, authorId: null, bookId: null,
        lastPracticed: jt.lastPlayedAt?.toISOString() ?? null,
        isRevisit: false,
      })),
      ...bookVideos.map((bv) => ({
        trackId: null, jamTrackId: null, bookVideoId: bv.id, videoId: null,
        title: bv.title ?? bv.filename, bookName: bv.book.name, authorId: bv.book.authorId, bookId: bv.bookId,
        lastPracticed: bv.lastPlayedAt?.toISOString() ?? null,
        isRevisit: false,
      })),
      ...videos.map((v) => ({
        trackId: null, jamTrackId: null, bookVideoId: null, videoId: v.id,
        title: v.title, bookName: null, authorId: null, bookId: null,
        lastPracticed: v.lastPlayedAt?.toISOString() ?? null,
        isRevisit: false,
      })),
    ];

    // Completed material, stalest first (never-played to the top), skipping
    // anything already replayed today.
    const revisitPool: PracticeItem[] = [
      ...completedTracks.map((t) => ({
        trackId: t.id, jamTrackId: null, bookVideoId: null, videoId: null,
        title: t.title, bookName: t.book.name, authorId: t.book.authorId, bookId: t.bookId,
        lastPracticed: t.lastPlayedAt?.toISOString() ?? null,
        isRevisit: true,
      })),
      ...completedJamTracks.map((jt) => ({
        trackId: null, jamTrackId: jt.id, bookVideoId: null, videoId: null,
        title: jt.title, bookName: null, authorId: null, bookId: null,
        lastPracticed: jt.lastPlayedAt?.toISOString() ?? null,
        isRevisit: true,
      })),
    ]
      .filter((it) => !it.lastPracticed || new Date(it.lastPracticed) < startOfToday)
      .sort((a, b) => {
        if (!a.lastPracticed && !b.lastPracticed) return 0;
        if (!a.lastPracticed) return -1;
        if (!b.lastPracticed) return 1;
        return new Date(a.lastPracticed).getTime() - new Date(b.lastPracticed).getTime();
      });

    // Seeded once per day: the picks and the running order hold for the whole
    // day, then shake up tomorrow.
    const rand = createDailyRandom();
    const combined = [...items, ...pickRevisitItems(revisitPool, rand)];
    shuffleInPlace(combined, rand);

    // Not-practiced-today first, practiced-today at the bottom.
    combined.sort((a, b) => {
      const aToday = a.lastPracticed && new Date(a.lastPracticed) >= startOfToday ? 1 : 0;
      const bToday = b.lastPracticed && new Date(b.lastPracticed) >= startOfToday ? 1 : 0;
      return aToday - bToday;
    });

    return NextResponse.json(combined);
  } catch (error) {
    console.error("Error fetching in-progress items:", error);
    return NextResponse.json({ error: "Failed to fetch in-progress items" }, { status: 500 });
  }
}
