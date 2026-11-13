import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { audioExtension } from "@/lib/recordings/mime";
import { listenAfterNewTake, riffAudioDir, validTrim } from "@/lib/songwriting/riffs";
import { riffToJson } from "@/lib/songwriting/riffJson";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

type Ctx = { params: Promise<{ id: string; partId: string }> };

function timestampSlug(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

const seconds = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

/** Replace the part's take (file first, then the row, then the old file). */
export async function POST(request: NextRequest, { params }: Ctx) {
  let written: string | null = null;
  try {
    const { id, partId } = await params;
    const part = await prisma.riffPart.findFirst({ where: { id: partId, riffId: id } });
    if (!part) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    let meta: Record<string, unknown>;
    try {
      const m = JSON.parse(String(formData.get("meta") ?? ""));
      if (!m || typeof m !== "object" || Array.isArray(m)) throw new Error();
      meta = m;
    } catch {
      return NextResponse.json({ error: "meta must be a JSON object" }, { status: 400 });
    }
    const audioDuration = seconds(meta.audioDuration);
    const trimStart = seconds(meta.trimStart);
    const trimEnd = seconds(meta.trimEnd);
    for (const key of ["audioDuration", "trimStart", "trimEnd"] as const) {
      if (meta[key] != null && seconds(meta[key]) === null) {
        return NextResponse.json({ error: `${key} must be a non-negative number` }, { status: 400 });
      }
    }
    const trimError = validTrim(trimStart, trimEnd, audioDuration);
    if (trimError) return NextResponse.json({ error: trimError }, { status: 400 });

    const mime = file.type || "audio/webm";
    const relDir = riffAudioDir(id);
    const relPath = `${relDir}/${partId}-${timestampSlug()}${audioExtension(mime)}`;
    const musicPath = path.resolve(MUSIC_DIR);
    const riffDir = path.resolve(musicPath, relDir);
    const target = path.resolve(musicPath, relPath);
    if (!target.startsWith(riffDir + path.sep)) return NextResponse.json({ error: "Bad path" }, { status: 400 });

    await fs.mkdir(riffDir, { recursive: true });
    await fs.writeFile(target, Buffer.from(await file.arrayBuffer()));
    written = target;

    // A part with a tab is heard as its new take from now on (in the same row update).
    const listen = listenAfterNewTake(part);
    const updated = await prisma.riffPart.update({
      where: { id: partId },
      data: { audioPath: relPath, audioMime: mime, audioDuration, trimStart, trimEnd, ...(listen && { listen }) },
    });
    written = null;

    if (part.audioPath && part.audioPath !== relPath) {
      const old = path.resolve(musicPath, part.audioPath);
      if (old.startsWith(riffDir + path.sep)) {
        await fs.rm(old, { force: true }).catch((err) => console.warn(`Could not delete ${old}:`, err));
      }
    }
    const riff = riffToJson(await prisma.riff.findUniqueOrThrow({ where: { id }, include: { parts: true } }));
    return NextResponse.json({ part: riff.parts.find((p) => p.id === updated.id), riff });
  } catch (error) {
    console.error("Error saving take:", error);
    if (written) await fs.rm(written, { force: true }).catch(() => {});
    return NextResponse.json({ error: "Failed to save take" }, { status: 500 });
  }
}
