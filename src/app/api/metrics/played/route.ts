import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { trackId, jamTrackId, bookVideoId, videoId } = await request.json();
    const now = new Date();

    if (trackId) {
      await prisma.track.update({ where: { id: trackId }, data: { lastPlayedAt: now } });
    } else if (jamTrackId) {
      await prisma.jamTrack.update({ where: { id: jamTrackId }, data: { lastPlayedAt: now } });
    } else if (bookVideoId) {
      await prisma.bookVideo.update({ where: { id: bookVideoId }, data: { lastPlayedAt: now } });
    } else if (videoId) {
      await prisma.video.update({ where: { id: videoId }, data: { lastPlayedAt: now } });
    } else {
      return NextResponse.json(
        { error: "trackId, jamTrackId, bookVideoId, or videoId required" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // A deleted item shouldn't 500 the client; playback tracking is best-effort.
    console.error("Error recording played:", error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
