import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoIds } = body;

    if (!Array.isArray(videoIds)) {
      return NextResponse.json({ error: "videoIds must be an array" }, { status: 400 });
    }

    // Update all videos with their new sort order
    await prisma.$transaction(
      videoIds.map((id: string, index: number) =>
        prisma.video.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    const videos = await prisma.video.findMany({
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(videos);
  } catch (error) {
    console.error("Error reordering videos:", error);
    return NextResponse.json({ error: "Failed to reorder videos" }, { status: 500 });
  }
}
