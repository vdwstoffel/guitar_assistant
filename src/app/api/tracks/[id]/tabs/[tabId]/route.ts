import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tabId: string }> }
) {
  try {
    const { tabId } = await params;
    const body = await request.json();
    const { name, alphatex, tempo } = body;

    const tab = await prisma.trackTab.update({
      where: { id: tabId },
      data: {
        ...(name !== undefined && { name }),
        ...(alphatex !== undefined && { alphatex }),
        ...(tempo !== undefined && { tempo }),
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
