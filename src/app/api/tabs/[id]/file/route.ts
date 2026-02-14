import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import path from "path";

const MUSIC_DIR = process.env.MUSIC_DIR || path.join(process.cwd(), "music");

// GET /api/tabs/[id]/file - Serve the Guitar Pro file
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tab = await prisma.guitarTab.findUnique({
      where: { id },
      select: { filePath: true },
    });

    if (!tab) {
      return NextResponse.json({ error: "Tab not found" }, { status: 404 });
    }

    const absolutePath = path.join(MUSIC_DIR, tab.filePath);
    const fileBuffer = await readFile(absolutePath);

    // Determine content type based on file extension
    const ext = path.extname(tab.filePath).toLowerCase();
    const contentType = "application/octet-stream"; // Generic binary type for GP files

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving tab file:", error);
    return NextResponse.json(
      { error: "Failed to load tab file" },
      { status: 500 }
    );
  }
}
