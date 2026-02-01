import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const authors = await prisma.author.findMany({
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
    });

    return NextResponse.json(authors);
  } catch (error) {
    console.error("Error fetching library:", error);
    return NextResponse.json(
      { error: "Failed to fetch library" },
      { status: 500 }
    );
  }
}
