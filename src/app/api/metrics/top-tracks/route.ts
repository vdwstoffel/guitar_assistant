import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "20");
    const sortBy = searchParams.get("sortBy") ?? "playCount";

    // Get all sessions grouped by track
    const sessions = await prisma.practiceSession.findMany({
      select: {
        trackId: true,
        jamTrackId: true,
        bookVideoId: true,
        trackTitle: true,
        durationSeconds: true,
        playbackSpeed: true,
        startTime: true,
        completedSession: true,
        track: { select: { book: { select: { name: true } } } },
      },
      orderBy: { startTime: "desc" },
    });

    // Aggregate per track
    const trackMap = new Map<
      string,
      {
        trackId: string | null;
        jamTrackId: string | null;
        bookVideoId: string | null;
        title: string;
        bookName: string | null;
        playCount: number;
        totalPracticeTime: number;
        totalSpeed: number;
        lastPracticed: Date;
        completedCount: number;
      }
    >();

    for (const s of sessions) {
      const key = s.trackId ?? s.jamTrackId ?? s.bookVideoId ?? "unknown";
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
          title: s.trackTitle,
          bookName: s.track?.book?.name ?? null,
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
      title: t.title,
      bookName: t.bookName,
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
