import { NextRequest, NextResponse } from "next/server";
import * as path from "path";
import * as fs from "fs/promises";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const filePath = decodeURIComponent(pathSegments.join("/"));
    const fullPath = path.join(path.resolve(MUSIC_DIR), filePath);

    // Security: ensure path is within MUSIC_DIR
    const resolvedPath = path.resolve(fullPath);
    const resolvedMusicDir = path.resolve(MUSIC_DIR);
    if (!resolvedPath.startsWith(resolvedMusicDir)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 403 });
    }

    const ext = path.extname(fullPath).toLowerCase();
    const mimeType = MIME_TYPES[ext];
    if (!mimeType) {
      return NextResponse.json({ error: "Unsupported image format" }, { status: 400 });
    }

    const data = await fs.readFile(fullPath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Cover not found" }, { status: 404 });
  }
}
