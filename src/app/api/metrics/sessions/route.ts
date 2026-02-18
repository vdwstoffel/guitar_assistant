import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackId, jamTrackId, durationSeconds, playbackSpeed, completedSession } = body;

    if (!trackId && !jamTrackId) {
      return NextResponse.json({ error: "trackId or jamTrackId required" }, { status: 400 });
    }
    if (!durationSeconds || durationSeconds < 10) {
      return NextResponse.json({ error: "durationSeconds must be >= 10" }, { status: 400 });
    }

    // Look up track title for snapshot
    let trackTitle = "Unknown";
    if (trackId) {
      const track = await prisma.track.findUnique({ where: { id: trackId }, select: { title: true } });
      if (!track) return NextResponse.json({ error: "Track not found" }, { status: 404 });
      trackTitle = track.title;
    } else if (jamTrackId) {
      const jamTrack = await prisma.jamTrack.findUnique({ where: { id: jamTrackId }, select: { title: true } });
      if (!jamTrack) return NextResponse.json({ error: "JamTrack not found" }, { status: 404 });
      trackTitle = jamTrack.title;
    }

    const session = await prisma.practiceSession.create({
      data: {
        trackId: trackId || null,
        jamTrackId: jamTrackId || null,
        durationSeconds,
        playbackSpeed: playbackSpeed ?? 100,
        completedSession: completedSession ?? false,
        trackTitle,
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("Error creating practice session:", error);
    return NextResponse.json({ error: "Failed to create practice session" }, { status: 500 });
  }
}
