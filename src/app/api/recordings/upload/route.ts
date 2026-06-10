import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
const RECORDINGS_FOLDER = "Recordings";

const MIME_TO_EXT: Record<string, string> = {
  "audio/webm": ".webm",
  "audio/webm;codecs=opus": ".webm",
  "audio/ogg": ".ogg",
  "audio/ogg;codecs=opus": ".ogg",
  "audio/mp4": ".mp4",
  "audio/mp4;codecs=mp4a.40.2": ".mp4",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
};

function extFromMime(mime: string): string {
  if (MIME_TO_EXT[mime]) return MIME_TO_EXT[mime];
  const base = mime.split(";")[0].trim();
  return MIME_TO_EXT[base] || ".webm";
}

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}

function timestampSlug(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const titleRaw = formData.get("title");
    const durationRaw = formData.get("duration");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const mimeType = file.type || "audio/webm";
    const duration = durationRaw ? parseFloat(durationRaw.toString()) : 0;
    const ext = extFromMime(mimeType);
    const slug = timestampSlug();
    const fileName = `${slug}${ext}`;
    const title = titleRaw ? sanitizeName(titleRaw.toString()) || `Recording ${slug}` : `Recording ${slug}`;

    const musicPath = path.resolve(MUSIC_DIR);
    const recordingsPath = path.join(musicPath, RECORDINGS_FOLDER);
    await fs.mkdir(recordingsPath, { recursive: true });

    const finalPath = path.join(recordingsPath, fileName);
    const relativePath = path.join(RECORDINGS_FOLDER, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(finalPath, buffer);

    const recording = await prisma.recording.create({
      data: {
        title,
        filePath: relativePath,
        duration,
        mimeType,
      },
    });

    return NextResponse.json(recording);
  } catch (error) {
    console.error("Error uploading recording:", error);
    return NextResponse.json(
      { error: "Failed to upload recording" },
      { status: 500 }
    );
  }
}
