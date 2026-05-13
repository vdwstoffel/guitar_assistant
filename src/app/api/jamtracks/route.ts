import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const jamTracks = await prisma.jamTrack.findMany({
      orderBy: { title: "asc" },
    });
    return NextResponse.json(jamTracks.map((jt) => ({ ...jt, markers: [] })));
  } catch (error) {
    console.error("Error fetching jam tracks:", error);
    return NextResponse.json(
      { error: "Failed to fetch jam tracks" },
      { status: 500 }
    );
  }
}
