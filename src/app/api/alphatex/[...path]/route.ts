import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const filePath = path.join(MUSIC_DIR, ...pathSegments);
  const absolutePath = path.resolve(filePath);

  // Security: ensure the path is within the music directory
  const musicDirAbsolute = path.resolve(MUSIC_DIR);
  if (!absolutePath.startsWith(musicDirAbsolute)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 403 });
  }

  if (!absolutePath.endsWith(".alphatex")) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  try {
    const content = await fs.readFile(absolutePath, "utf-8");
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
