import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jamTrackId } = await params;
    const body = await request.json();
    const { name, timestamp } = body;

    if (!name || timestamp === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: name, timestamp" },
        { status: 400 }
      );
    }

    const marker = await prisma.jamTrackMarker.create({
      data: {
        jamTrackId,
        name,
        timestamp,
      },
    });

    return NextResponse.json(marker);
  } catch (error) {
    console.error("Error creating jam track marker:", error);
    return NextResponse.json(
      { error: "Failed to create marker" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jamTrackId } = await params;
    const { searchParams } = new URL(request.url);
    const markerId = searchParams.get("markerId");

    if (markerId) {
      // Delete specific marker
      await prisma.jamTrackMarker.delete({
        where: { id: markerId },
      });
    } else {
      // Clear all markers for this jam track
      await prisma.jamTrackMarker.deleteMany({
        where: { jamTrackId },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting jam track marker(s):", error);
    return NextResponse.json(
      { error: "Failed to delete marker(s)" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params; // Consume params to satisfy Next.js
    const body = await request.json();
    const { markerId, name, timestamp } = body;

    if (!markerId) {
      return NextResponse.json(
        { error: "Missing required field: markerId" },
        { status: 400 }
      );
    }

    const marker = await prisma.jamTrackMarker.update({
      where: { id: markerId },
      data: {
        ...(name !== undefined && { name }),
        ...(timestamp !== undefined && { timestamp }),
      },
    });

    return NextResponse.json(marker);
  } catch (error) {
    console.error("Error updating jam track marker:", error);
    return NextResponse.json(
      { error: "Failed to update marker" },
      { status: 500 }
    );
  }
}
