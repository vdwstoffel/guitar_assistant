import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractYoutubeId } from "@/lib/video/youtube";
import { enqueueDownload } from "@/lib/video/downloader";

export async function GET() {
  try {
    const videos = await prisma.video.findMany({ orderBy: { sortOrder: "asc" } });
    return NextResponse.json(videos);
  } catch (error) {
    console.error("Error fetching videos:", error);
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url, category } = await request.json();
    const youtubeId = extractYoutubeId(url || "");
    if (!youtubeId) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    const lastVideo = await prisma.video.findFirst({ orderBy: { sortOrder: "desc" } });
    const sortOrder = (lastVideo?.sortOrder ?? -1) + 1;

    const video = await prisma.video.create({
      data: {
        title: "Downloading…",
        youtubeId,
        sortOrder,
        category: category || null,
        status: "pending",
      },
    });

    enqueueDownload(video.id);
    return NextResponse.json(video);
  } catch (error) {
    console.error("Error creating video:", error);
    return NextResponse.json({ error: "Failed to create video" }, { status: 500 });
  }
}
