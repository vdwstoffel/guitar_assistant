import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

/**
 * Serves a Guitar Pro file's raw bytes.
 *
 * The browser needs them because alphaTab parses the file itself to render
 * and play it; the server-side parse at import only produces metadata.
 *
 * No range support, unlike the audio route: alphaTab reads the whole file in
 * one go, and these are small.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const absolutePath = path.resolve(path.join(MUSIC_DIR, ...segments));

  // Same guard as the audio route: a crafted "../" must not escape MUSIC_DIR.
  const root = path.resolve(MUSIC_DIR);
  if (!absolutePath.startsWith(root)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 403 });
  }

  try {
    const bytes = fs.readFileSync(absolutePath);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
