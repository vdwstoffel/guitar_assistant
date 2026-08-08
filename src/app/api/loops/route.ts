import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateLoopInput } from "@/lib/loops";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackId } = body ?? {};

    if (!trackId || typeof trackId !== "string") {
      return NextResponse.json({ error: "Missing required field: trackId" }, { status: 400 });
    }

    const parsed = validateLoopInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const loop = await prisma.loop.create({
      data: { trackId, ...parsed.value },
    });

    return NextResponse.json(loop);
  } catch (error) {
    console.error("Error creating loop:", error);
    return NextResponse.json({ error: "Failed to create loop" }, { status: 500 });
  }
}
