import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "20");
    const sortBy = searchParams.get("sortBy") ?? "playCount";
    const days = searchParams.get("days");

    // Optional time filter
    const where: Record<string, unknown> = {};
    if (days) {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(days));
      where.startTime = { gte: since };
    }

    // Get all sessions grouped by track
    const sessions = await prisma.practiceSession.findMany({
      where,
      select: {
        trackId: true,
        jamTrackId: true,
        bookVideoId: true,
        videoId: true,
        trackTitle: true,
        durationSeconds: true,
        playbackSpeed: true,
        startTime: true,
        completedSession: true,
        track: { select: { completed: true, bookId: true, book: { select: { name: true, authorId: true } } } },
        jamTrack: { select: { completed: true } },
        bookVideo: { select: { completed: true, bookId: true, book: { select: { name: true, authorId: true } } } },
      },
      orderBy: { startTime: "desc" },
    });

    // Filter out tracks/jamTracks/bookVideos marked as completed
    const filtered = sessions.filter((s) => {
      if (s.track?.completed) return false;
      if (s.jamTrack?.completed) return false;
      if (s.bookVideo?.completed) return false;
      return true;
    });

    // Aggregate per track
    const trackMap = new Map<
      string,
      {
        trackId: string | null;
        jamTrackId: string | null;
        bookVideoId: string | null;
        videoId: string | null;
        title: string;
        bookName: string | null;
        authorId: string | null;
        bookId: string | null;
        playCount: number;
        totalPracticeTime: number;
        totalSpeed: number;
        lastPracticed: Date;
        completedCount: number;
      }
    >();

    for (const s of filtered) {
      const key = s.trackId ?? s.jamTrackId ?? s.bookVideoId ?? s.videoId ?? "unknown";
      const existing = trackMap.get(key);
      if (existing) {
        existing.playCount++;
        existing.totalPracticeTime += s.durationSeconds;
        existing.totalSpeed += s.playbackSpeed;
        if (s.completedSession) existing.completedCount++;
        if (s.startTime > existing.lastPracticed) {
          existing.lastPracticed = s.startTime;
          existing.title = s.trackTitle;
        }
      } else {
        trackMap.set(key, {
          trackId: s.trackId,
          jamTrackId: s.jamTrackId,
          bookVideoId: s.bookVideoId,
          videoId: s.videoId,
          title: s.trackTitle,
          bookName: s.track?.book?.name ?? s.bookVideo?.book?.name ?? null,
          authorId: s.track?.book?.authorId ?? s.bookVideo?.book?.authorId ?? null,
          bookId: s.track?.bookId ?? s.bookVideo?.bookId ?? null,
          playCount: 1,
          totalPracticeTime: s.durationSeconds,
          totalSpeed: s.playbackSpeed,
          lastPracticed: s.startTime,
          completedCount: s.completedSession ? 1 : 0,
        });
      }
    }

    let tracks = Array.from(trackMap.values()).map((t) => ({
      trackId: t.trackId,
      jamTrackId: t.jamTrackId,
      bookVideoId: t.bookVideoId,
      videoId: t.videoId,
      title: t.title,
      bookName: t.bookName,
      authorId: t.authorId,
      bookId: t.bookId,
      playCount: t.playCount,
      totalPracticeTime: Math.round(t.totalPracticeTime),
      averageSpeed: Math.round(t.totalSpeed / t.playCount),
      lastPracticed: t.lastPracticed.toISOString(),
      completionRate: Math.round((t.completedCount / t.playCount) * 100),
    }));

    // Sort
    if (sortBy === "totalTime") {
      tracks.sort((a, b) => b.totalPracticeTime - a.totalPracticeTime);
    } else if (sortBy === "lastPracticed") {
      tracks.sort((a, b) => new Date(b.lastPracticed).getTime() - new Date(a.lastPracticed).getTime());
    } else {
      tracks.sort((a, b) => b.playCount - a.playCount);
    }

    tracks = tracks.slice(0, limit);

    return NextResponse.json(tracks);
  } catch (error) {
    console.error("Error fetching top tracks:", error);
    return NextResponse.json({ error: "Failed to fetch top tracks" }, { status: 500 });
  }
}
