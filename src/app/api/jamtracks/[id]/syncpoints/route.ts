import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jamTrackId } = await params;

    const syncPoints = await prisma.tabSyncPoint.findMany({
      where: { jamTrackId },
      orderBy: { audioTime: "asc" },
    });

    return NextResponse.json(syncPoints);
  } catch (error) {
    console.error("Error fetching sync points:", error);
    return NextResponse.json(
      { error: "Failed to fetch sync points" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jamTrackId } = await params;
    const body = await request.json();
    const { audioTime, tabTick, barIndex } = body;

    if (audioTime === undefined || tabTick === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: audioTime, tabTick" },
        { status: 400 }
      );
    }

    const syncPoint = await prisma.tabSyncPoint.create({
      data: {
        jamTrackId,
        audioTime,
        tabTick,
        barIndex: barIndex ?? null,
      },
    });

    return NextResponse.json(syncPoint);
  } catch (error) {
    console.error("Error creating sync point:", error);
    return NextResponse.json(
      { error: "Failed to create sync point" },
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
    const syncPointId = searchParams.get("syncPointId");

    if (syncPointId) {
      await prisma.tabSyncPoint.delete({
        where: { id: syncPointId },
      });
    } else {
      await prisma.tabSyncPoint.deleteMany({
        where: { jamTrackId },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting sync point(s):", error);
    return NextResponse.json(
      { error: "Failed to delete sync point(s)" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params;
    const body = await request.json();
    const { syncPointId, audioTime, tabTick, barIndex } = body;

    if (!syncPointId) {
      return NextResponse.json(
        { error: "Missing required field: syncPointId" },
        { status: 400 }
      );
    }

    const syncPoint = await prisma.tabSyncPoint.update({
      where: { id: syncPointId },
      data: {
        ...(audioTime !== undefined && { audioTime }),
        ...(tabTick !== undefined && { tabTick }),
        ...(barIndex !== undefined && { barIndex }),
      },
    });

    return NextResponse.json(syncPoint);
  } catch (error) {
    console.error("Error updating sync point:", error);
    return NextResponse.json(
      { error: "Failed to update sync point" },
      { status: 500 }
    );
  }
}
