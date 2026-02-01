import { NextRequest, NextResponse } from "next/server";
import * as path from "path";
import * as mm from "music-metadata";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const filePath = decodeURIComponent(pathSegments.join("/"));
    const fullPath = path.join(path.resolve(MUSIC_DIR), filePath);

    // Security check: ensure the path is within MUSIC_DIR
    const resolvedPath = path.resolve(fullPath);
    const resolvedMusicDir = path.resolve(MUSIC_DIR);
    if (!resolvedPath.startsWith(resolvedMusicDir)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 403 });
    }

    const metadata = await mm.parseFile(fullPath);
    const picture = metadata.common.picture?.[0];

    if (!picture) {
      // Return a 404 if no album art is found
      return NextResponse.json({ error: "No album art found" }, { status: 404 });
    }

    // Return the image with the correct content type
    return new NextResponse(Buffer.from(picture.data), {
      headers: {
        "Content-Type": picture.format,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error fetching album art:", error);
    return NextResponse.json(
      { error: "Failed to fetch album art" },
      { status: 500 }
    );
  }
}
