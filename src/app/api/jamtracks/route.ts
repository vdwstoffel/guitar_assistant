import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const jamTracks = await prisma.jamTrack.findMany({
      orderBy: { title: "asc" },
      include: {
        markers: { orderBy: { timestamp: "asc" } },
        loops: true,
        pdfs: { orderBy: { sortOrder: "asc" }, include: { pageFlips: true } },
      },
    });
    return NextResponse.json(jamTracks);
  } catch (error) {
    console.error("Error fetching jam tracks:", error);
    return NextResponse.json(
      { error: "Failed to fetch jam tracks" },
      { status: 500 }
    );
  }
}
