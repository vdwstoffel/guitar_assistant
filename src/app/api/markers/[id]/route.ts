import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, timestamp, pdfPage } = body;

    const marker = await prisma.marker.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(timestamp !== undefined && { timestamp }),
        ...(pdfPage !== undefined && { pdfPage }),
      },
    });

    return NextResponse.json(marker);
  } catch (error) {
    console.error("Error updating marker:", error);
    return NextResponse.json(
      { error: "Failed to update marker" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.marker.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting marker:", error);
    return NextResponse.json(
      { error: "Failed to delete marker" },
      { status: 500 }
    );
  }
}
