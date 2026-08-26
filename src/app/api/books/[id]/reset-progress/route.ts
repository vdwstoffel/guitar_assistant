import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetProgressData } from "@/lib/progress";

// POST - Reset every track and video in a book back to its default state.
// Clears completed / in-progress; leaves lastPlayedAt, favorites, markers,
// loops, page flips and notes untouched.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const book = await prisma.book.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const data = resetProgressData();

    const [tracks, videos] = await prisma.$transaction([
      prisma.track.updateMany({ where: { bookId: id }, data }),
      prisma.bookVideo.updateMany({ where: { bookId: id }, data }),
      prisma.book.update({ where: { id }, data: { inProgress: false } }),
    ]);

    return NextResponse.json({
      success: true,
      tracks: tracks.count,
      videos: videos.count,
    });
  } catch (error) {
    console.error("Error resetting book progress:", error);
    return NextResponse.json(
      { error: "Failed to reset book progress" },
      { status: 500 }
    );
  }
}
