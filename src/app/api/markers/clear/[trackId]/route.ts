import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  try {
    const { trackId } = await params;

    await prisma.marker.deleteMany({
      where: { trackId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing markers:", error);
    return NextResponse.json(
      { error: "Failed to clear markers" },
      { status: 500 }
    );
  }
}
