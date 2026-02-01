import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { songId, name, timestamp } = body;

    if (!songId || !name || timestamp === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: songId, name, timestamp" },
        { status: 400 }
      );
    }

    const marker = await prisma.marker.create({
      data: {
        songId,
        name,
        timestamp,
      },
    });

    return NextResponse.json(marker);
  } catch (error) {
    console.error("Error creating marker:", error);
    return NextResponse.json(
      { error: "Failed to create marker" },
      { status: 500 }
    );
  }
}
