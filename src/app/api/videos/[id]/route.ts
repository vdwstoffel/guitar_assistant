import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, category, completed, inProgress, notes } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const data: Record<string, unknown> = {
      title: title.trim(),
      ...(category !== undefined && { category: category || null }),
    };
    if (completed !== undefined) {
      data.completed = completed;
      if (completed) data.inProgress = false;
    }
    if (inProgress !== undefined) {
      data.inProgress = inProgress;
      if (inProgress) data.completed = false;
    }
    if (notes !== undefined) {
      data.notes = notes;
    }

    const video = await prisma.video.update({
      where: { id },
      data,
    });

    return NextResponse.json(video);
  } catch (error) {
    console.error("Error updating video:", error);
    return NextResponse.json({ error: "Failed to update video" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.video.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting video:", error);
    return NextResponse.json({ error: "Failed to delete video" }, { status: 500 });
  }
}
