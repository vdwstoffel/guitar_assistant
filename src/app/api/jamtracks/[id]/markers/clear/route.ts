import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.jamTrackMarker.deleteMany({
      where: { jamTrackId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing jam track markers:", error);
    return NextResponse.json(
      { error: "Failed to clear markers" },
      { status: 500 }
    );
  }
}
