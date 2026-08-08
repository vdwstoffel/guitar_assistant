import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueDownload } from "@/lib/video/downloader";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const updated = await prisma.video.update({
      where: { id },
      data: { status: "downloading", errorMessage: null },
    });

    enqueueDownload(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error retrying video download:", error);
    return NextResponse.json({ error: "Failed to retry download" }, { status: 500 });
  }
}
