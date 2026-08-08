import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateLoopInput } from "@/lib/loops";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const parsed = validateLoopInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const loop = await prisma.jamTrackLoop.create({
      data: { jamTrackId: id, ...parsed.value },
    });

    return NextResponse.json(loop);
  } catch (error) {
    console.error("Error creating jam track loop:", error);
    return NextResponse.json({ error: "Failed to create loop" }, { status: 500 });
  }
}
