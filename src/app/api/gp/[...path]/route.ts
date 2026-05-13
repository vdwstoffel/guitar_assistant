import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
const ALLOWED_EXTENSIONS = [".gp", ".gp3", ".gp4", ".gp5", ".gpx", ".gp7"];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const filePath = path.join(MUSIC_DIR, ...pathSegments);
  const absolutePath = path.resolve(filePath);

  const musicDirAbsolute = path.resolve(MUSIC_DIR);
  if (!absolutePath.startsWith(musicDirAbsolute)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 403 });
  }

  const ext = path.extname(absolutePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  try {
    const stat = fs.statSync(absolutePath);
    const buffer = fs.readFileSync(absolutePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Length": stat.size.toString(),
        "Content-Type": "application/octet-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
