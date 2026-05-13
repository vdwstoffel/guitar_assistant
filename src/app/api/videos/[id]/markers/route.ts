import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const markers = await prisma.videoMarker.findMany({
      where: { videoId: id },
      orderBy: { timestamp: "asc" },
    });
    return NextResponse.json(markers);
  } catch (error) {
    console.error("Error fetching video markers:", error);
    return NextResponse.json({ error: "Failed to fetch markers" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, timestamp } = body;

    if (!name || timestamp === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: name, timestamp" },
        { status: 400 }
      );
    }

    const marker = await prisma.videoMarker.create({
      data: { videoId: id, name, timestamp },
    });

    return NextResponse.json(marker);
  } catch (error) {
    console.error("Error creating video marker:", error);
    return NextResponse.json({ error: "Failed to create marker" }, { status: 500 });
  }
}
