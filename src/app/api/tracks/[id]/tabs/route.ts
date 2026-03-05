import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: trackId } = await params;

    const tabs = await prisma.trackTab.findMany({
      where: { trackId },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(tabs);
  } catch (error) {
    console.error("Error fetching track tabs:", error);
    return NextResponse.json(
      { error: "Failed to fetch tabs" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: trackId } = await params;
    const body = await request.json();
    const { name, alphatex, tempo } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }

    const lastTab = await prisma.trackTab.findFirst({
      where: { trackId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const tab = await prisma.trackTab.create({
      data: {
        trackId,
        name,
        alphatex: alphatex ?? null,
        tempo: tempo ?? 120,
        sortOrder: (lastTab?.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json(tab);
  } catch (error) {
    console.error("Error creating track tab:", error);
    return NextResponse.json(
      { error: "Failed to create tab" },
      { status: 500 }
    );
  }
}
