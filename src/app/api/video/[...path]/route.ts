import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
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

  try {
    const stat = fs.statSync(absolutePath);
    const fileSize = stat.size;
    const range = request.headers.get("range");

    const ext = path.extname(absolutePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".webm": "video/webm",
      ".m4v": "video/x-m4v",
    };
    const contentType = mimeTypes[ext] || "application/octet-stream";

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const stream = fs.createReadStream(absolutePath, { start, end });
      const readableStream = new ReadableStream({
        start(controller) {
          stream.on("data", (chunk) => controller.enqueue(chunk));
          stream.on("end", () => controller.close());
          stream.on("error", (err) => controller.error(err));
        },
      });

      return new NextResponse(readableStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize.toString(),
          "Content-Type": contentType,
        },
      });
    }

    const stream = fs.createReadStream(absolutePath);
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(readableStream, {
      headers: {
        "Content-Length": fileSize.toString(),
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
