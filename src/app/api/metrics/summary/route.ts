import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [totalSessions, totalPracticeTime, uniqueTracks, uniqueJamTracks, lastSession] =
      await Promise.all([
        prisma.practiceSession.count(),
        prisma.practiceSession.aggregate({ _sum: { durationSeconds: true } }),
        prisma.practiceSession.groupBy({ by: ["trackId"], where: { trackId: { not: null } } }),
        prisma.practiceSession.groupBy({ by: ["jamTrackId"], where: { jamTrackId: { not: null } } }),
        prisma.practiceSession.findFirst({ orderBy: { startTime: "desc" }, select: { startTime: true } }),
      ]);

    // Calculate current streak (consecutive days with practice)
    const sessions = await prisma.practiceSession.findMany({
      select: { startTime: true },
      orderBy: { startTime: "desc" },
    });

    let currentStreak = 0;
    if (sessions.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get unique practice dates
      const practiceDates = new Set<string>();
      for (const s of sessions) {
        const d = new Date(s.startTime);
        d.setHours(0, 0, 0, 0);
        practiceDates.add(d.toISOString());
      }

      const sortedDates = Array.from(practiceDates).sort().reverse();

      // Check if most recent session is today or yesterday
      const mostRecent = new Date(sortedDates[0]);
      const diffDays = Math.floor((today.getTime() - mostRecent.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        currentStreak = 0;
      } else {
        currentStreak = 1;
        for (let i = 1; i < sortedDates.length; i++) {
          const prev = new Date(sortedDates[i - 1]);
          const curr = new Date(sortedDates[i]);
          const gap = Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
          if (gap === 1) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }

    return NextResponse.json({
      totalSessions,
      totalPracticeTimeSeconds: totalPracticeTime._sum.durationSeconds ?? 0,
      uniqueTracksPlayed: uniqueTracks.length + uniqueJamTracks.length,
      currentStreak,
      lastPracticeDate: lastSession?.startTime ?? null,
    });
  } catch (error) {
    console.error("Error fetching metrics summary:", error);
    return NextResponse.json({ error: "Failed to fetch metrics summary" }, { status: 500 });
  }
}
