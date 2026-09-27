import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clampPlaybackSpeed } from "@/lib/playbackSpeed";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tabId: string }> }
) {
  try {
    const { tabId } = await params;
    const body = await request.json();
    const { name, alphatex, tempo, playbackSpeed } = body;

    const tab = await prisma.trackTab.update({
      where: { id: tabId },
      data: {
        ...(name !== undefined && { name }),
        ...(alphatex !== undefined && { alphatex }),
        ...(tempo !== undefined && { tempo }),
        // Clamp server-side too: the client control clamps, but the route is
        // the actual boundary and a bad value would persist silently.
        ...(playbackSpeed !== undefined && {
          playbackSpeed: playbackSpeed === null ? null : clampPlaybackSpeed(playbackSpeed),
        }),
      },
    });

    return NextResponse.json(tab);
  } catch (error) {
    console.error("Error updating track tab:", error);
    return NextResponse.json(
      { error: "Failed to update tab" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; tabId: string }> }
) {
  try {
    const { tabId } = await params;

    await prisma.trackTab.delete({
      where: { id: tabId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting track tab:", error);
    return NextResponse.json(
      { error: "Failed to delete tab" },
      { status: 500 }
    );
  }
}
