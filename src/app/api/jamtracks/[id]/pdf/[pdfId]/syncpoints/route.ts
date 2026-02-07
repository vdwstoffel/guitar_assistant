import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pdfId: string }> }
) {
  try {
    const { pdfId } = await params;

    const syncPoints = await prisma.pageSyncPoint.findMany({
      where: { jamTrackPdfId: pdfId },
      orderBy: { timeInSeconds: "asc" },
    });

    return NextResponse.json(syncPoints);
  } catch (error) {
    console.error("Error fetching page sync points:", error);
    return NextResponse.json({ error: "Failed to fetch sync points" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pdfId: string }> }
) {
  try {
    const { pdfId } = await params;
    const body = await request.json();
    const { timeInSeconds, pageNumber } = body;

    if (timeInSeconds === undefined || pageNumber === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: timeInSeconds, pageNumber" },
        { status: 400 }
      );
    }

    const syncPoint = await prisma.pageSyncPoint.create({
      data: {
        jamTrackPdfId: pdfId,
        timeInSeconds,
        pageNumber,
      },
    });

    return NextResponse.json(syncPoint);
  } catch (error) {
    console.error("Error creating page sync point:", error);
    return NextResponse.json({ error: "Failed to create sync point" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pdfId: string }> }
) {
  try {
    await params;
    const body = await request.json();
    const { syncPointId, timeInSeconds, pageNumber } = body;

    if (!syncPointId) {
      return NextResponse.json(
        { error: "Missing required field: syncPointId" },
        { status: 400 }
      );
    }

    const syncPoint = await prisma.pageSyncPoint.update({
      where: { id: syncPointId },
      data: {
        ...(timeInSeconds !== undefined && { timeInSeconds }),
        ...(pageNumber !== undefined && { pageNumber }),
      },
    });

    return NextResponse.json(syncPoint);
  } catch (error) {
    console.error("Error updating page sync point:", error);
    return NextResponse.json({ error: "Failed to update sync point" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pdfId: string }> }
) {
  try {
    const { pdfId } = await params;
    const { searchParams } = new URL(request.url);
    const syncPointId = searchParams.get("syncPointId");

    if (syncPointId) {
      await prisma.pageSyncPoint.delete({ where: { id: syncPointId } });
    } else {
      await prisma.pageSyncPoint.deleteMany({ where: { jamTrackPdfId: pdfId } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting page sync point:", error);
    return NextResponse.json({ error: "Failed to delete sync point" }, { status: 500 });
  }
}
