import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string; markerId: string }> }
) {
  try {
    const { markerId } = await params;
    const body = await request.json();
    const { name, timestamp } = body;

    const marker = await prisma.bookVideoMarker.update({
      where: { id: markerId },
      data: {
        ...(name !== undefined && { name }),
        ...(timestamp !== undefined && { timestamp }),
      },
    });

    return NextResponse.json(marker);
  } catch (error) {
    console.error("Error updating book video marker:", error);
    return NextResponse.json({ error: "Failed to update marker" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string; markerId: string }> }
) {
  try {
    const { markerId } = await params;
    await prisma.bookVideoMarker.delete({ where: { id: markerId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting book video marker:", error);
    return NextResponse.json({ error: "Failed to delete marker" }, { status: 500 });
  }
}
