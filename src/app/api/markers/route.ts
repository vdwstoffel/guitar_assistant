import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackId, name, timestamp, pdfPage } = body;

    if (!trackId || !name || timestamp === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: trackId, name, timestamp" },
        { status: 400 }
      );
    }

    const marker = await prisma.marker.create({
      data: {
        trackId,
        name,
        timestamp,
        ...(pdfPage != null && { pdfPage }),
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
