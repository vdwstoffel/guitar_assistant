import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "track";

    const where =
      type === "jamtrack" ? { jamTrackId: id } : { trackId: id };

    const sessions = await prisma.practiceSession.findMany({
      where,
      select: {
        startTime: true,
        playbackSpeed: true,
        durationSeconds: true,
        completedSession: true,
        trackTitle: true,
      },
      orderBy: { startTime: "asc" },
    });

    if (sessions.length === 0) {
      return NextResponse.json({ id, type, title: null, sessions: [] });
    }

    return NextResponse.json({
      id,
      type,
      title: sessions[sessions.length - 1].trackTitle,
      sessions: sessions.map((s) => ({
        date: s.startTime.toISOString(),
        speed: s.playbackSpeed,
        durationSeconds: Math.round(s.durationSeconds),
        completed: s.completedSession,
      })),
    });
  } catch (error) {
    console.error("Error fetching speed progression:", error);
    return NextResponse.json({ error: "Failed to fetch speed progression" }, { status: 500 });
  }
}
