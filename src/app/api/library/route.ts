import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [authors, jamTracks] = await Promise.all([
      prisma.author.findMany({
        include: {
          books: {
            include: {
              tracks: {
                orderBy: { trackNumber: "asc" },
                include: {
                  markers: {
                    orderBy: { timestamp: "asc" },
                  },
                },
              },
            },
            orderBy: { name: "asc" },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.jamTrack.findMany({
        include: {
          markers: {
            orderBy: { timestamp: "asc" },
          },
          tabSyncPoints: {
            orderBy: { audioTime: "asc" },
          },
        },
        orderBy: { title: "asc" },
      }),
    ]);

    return NextResponse.json({ authors, jamTracks });
  } catch (error) {
    console.error("Error fetching library:", error);
    return NextResponse.json(
      { error: "Failed to fetch library" },
      { status: 500 }
    );
  }
}
