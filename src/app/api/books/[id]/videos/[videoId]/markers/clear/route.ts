import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  try {
    const { videoId } = await params;
    await prisma.bookVideoMarker.deleteMany({
      where: { bookVideoId: videoId },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing book video markers:", error);
    return NextResponse.json({ error: "Failed to clear markers" }, { status: 500 });
  }
}
