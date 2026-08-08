import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body ?? {};

    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Missing or empty field: name" }, { status: 400 });
    }

    const loop = await prisma.loop.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json(loop);
  } catch (error) {
    console.error("Error updating loop:", error);
    return NextResponse.json({ error: "Failed to update loop" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.loop.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting loop:", error);
    return NextResponse.json({ error: "Failed to delete loop" }, { status: 500 });
  }
}
