import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const limitRaw = request.nextUrl.searchParams.get("limit");
    const limit = limitRaw !== null ? Number(limitRaw) : null;
    const take =
      limit !== null && Number.isFinite(limit) && limit > 0
        ? Math.floor(limit)
        : undefined;

    const recordings = await prisma.recording.findMany({
      orderBy: { createdAt: "desc" },
      ...(take !== undefined ? { take } : {}),
    });
    return NextResponse.json(recordings);
  } catch (error) {
    console.error("Error fetching recordings:", error);
    return NextResponse.json(
      { error: "Failed to fetch recordings" },
      { status: 500 }
    );
  }
}
