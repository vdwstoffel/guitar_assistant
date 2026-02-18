import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") ?? "30");

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const sessions = await prisma.practiceSession.findMany({
      where: { startTime: { gte: since } },
      select: {
        startTime: true,
        durationSeconds: true,
        trackId: true,
        jamTrackId: true,
      },
      orderBy: { startTime: "asc" },
    });

    // Group by date
    const dayMap = new Map<string, { practiceSeconds: number; sessionCount: number; tracks: Set<string> }>();

    // Initialize all days in range
    for (let d = new Date(since); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split("T")[0];
      dayMap.set(key, { practiceSeconds: 0, sessionCount: 0, tracks: new Set() });
    }

    for (const s of sessions) {
      const key = new Date(s.startTime).toISOString().split("T")[0];
      const day = dayMap.get(key);
      if (day) {
        day.practiceSeconds += s.durationSeconds;
        day.sessionCount++;
        day.tracks.add(s.trackId ?? s.jamTrackId ?? "");
      }
    }

    const history = Array.from(dayMap.entries()).map(([date, data]) => ({
      date,
      practiceMinutes: Math.round(data.practiceSeconds / 60),
      sessionCount: data.sessionCount,
      uniqueTracks: data.tracks.size,
    }));

    return NextResponse.json(history);
  } catch (error) {
    console.error("Error fetching practice history:", error);
    return NextResponse.json({ error: "Failed to fetch practice history" }, { status: 500 });
  }
}
