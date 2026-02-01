import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Extract YouTube video ID from various URL formats
function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function GET() {
  try {
    const videos = await prisma.video.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(videos);
  } catch (error) {
    console.error("Error fetching videos:", error);
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, youtubeUrl } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const youtubeId = extractYoutubeId(youtubeUrl || "");
    if (!youtubeId) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    // Get the highest sortOrder to add new video at the end
    const lastVideo = await prisma.video.findFirst({
      orderBy: { sortOrder: "desc" },
    });
    const sortOrder = (lastVideo?.sortOrder ?? -1) + 1;

    const video = await prisma.video.create({
      data: {
        title: title.trim(),
        youtubeId,
        sortOrder,
      },
    });

    return NextResponse.json(video);
  } catch (error) {
    console.error("Error creating video:", error);
    return NextResponse.json({ error: "Failed to create video" }, { status: 500 });
  }
}
