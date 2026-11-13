import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { riffAudioDir, riffWriteBack, validTrim } from "@/lib/songwriting/riffs";
import { riffToJson } from "@/lib/songwriting/riffJson";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

type Ctx = { params: Promise<{ id: string; partId: string }> };

const MAX_TEX = 2_000_000;
const seconds = (v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0);

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { id, partId } = await params;
    let body: Record<string, unknown>;
    try {
      const b = await request.json();
      if (!b || typeof b !== "object" || Array.isArray(b)) throw new Error();
      body = b;
    } catch {
      return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
    }

    const data: {
      alphatex?: string;
      playbackSpeed?: number;
      trimStart?: number | null;
      trimEnd?: number | null;
      name?: string;
      listen?: "tab" | "recording";
      level?: number;
      muted?: boolean;
      soloed?: boolean;
    } = {};
    if (body.listen !== undefined) {
      if (body.listen !== "tab" && body.listen !== "recording") {
        return NextResponse.json({ error: 'listen must be "tab" or "recording"' }, { status: 400 });
      }
      data.listen = body.listen;
    }
    if (body.level !== undefined) {
      if (typeof body.level !== "number" || !(body.level >= 0 && body.level <= 1)) {
        return NextResponse.json({ error: "level must be a number 0-1" }, { status: 400 });
      }
      data.level = body.level;
    }
    for (const key of ["muted", "soloed"] as const) {
      if (body[key] === undefined) continue;
      if (typeof body[key] !== "boolean") {
        return NextResponse.json({ error: `${key} must be a boolean` }, { status: 400 });
      }
      data[key] = body[key] as boolean;
    }
    if (body.alphatex !== undefined) {
      if (typeof body.alphatex !== "string" || body.alphatex.length > MAX_TEX) {
        return NextResponse.json({ error: "alphatex must be a string" }, { status: 400 });
      }
      data.alphatex = body.alphatex;
    }
    if (body.playbackSpeed !== undefined) {
      const s = body.playbackSpeed;
      if (typeof s !== "number" || !Number.isInteger(s) || s < 10 || s > 400) {
        return NextResponse.json({ error: "playbackSpeed must be an integer 10-400" }, { status: 400 });
      }
      data.playbackSpeed = s;
    }
    for (const key of ["trimStart", "trimEnd"] as const) {
      if (body[key] === undefined) continue;
      if (!seconds(body[key])) {
        return NextResponse.json({ error: `${key} must be a non-negative number or null` }, { status: 400 });
      }
      data[key] = body[key] as number | null;
    }
    if (body.name !== undefined) {
      const n = typeof body.name === "string" ? body.name.trim() : "";
      if (n.length < 1 || n.length > 80) {
        return NextResponse.json({ error: "name must be 1-80 characters" }, { status: 400 });
      }
      data.name = n;
    }

    const result = await prisma.$transaction(async (tx) => {
      const part = await tx.riffPart.findFirst({ where: { id: partId, riffId: id } });
      if (!part) return null;
      if (data.trimStart !== undefined || data.trimEnd !== undefined) {
        const err = validTrim(
          data.trimStart !== undefined ? data.trimStart : part.trimStart,
          data.trimEnd !== undefined ? data.trimEnd : part.trimEnd,
          part.audioDuration,
        );
        if (err) return { error: err };
      }
      const updated = await tx.riffPart.update({ where: { id: partId }, data });
      if (data.alphatex !== undefined) {
        const riff = await tx.riff.findUniqueOrThrow({ where: { id } });
        const back = riffWriteBack(data.alphatex, riff, part.kind === "bass" ? "bass" : "guitar");
        if (back.tempo !== undefined || back.tuning !== undefined) {
          await tx.riff.update({ where: { id }, data: back });
        }
      }
      const riff = await tx.riff.findUniqueOrThrow({ where: { id }, include: { parts: true } });
      return { part: updated, riff };
    });
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ part: riffToJson(result.riff).parts.find((p) => p.id === partId), riff: riffToJson(result.riff) });
  } catch (error) {
    console.error("Error updating riff part:", error);
    return NextResponse.json({ error: "Failed to update part" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const { id, partId } = await params;
    const outcome = await prisma.$transaction(async (tx) => {
      const part = await tx.riffPart.findFirst({ where: { id: partId, riffId: id } });
      if (!part) return "missing" as const;
      if ((await tx.riffPart.count({ where: { riffId: id } })) <= 1) return "last" as const;
      await tx.riffPart.delete({ where: { id: partId } });
      return part;
    });
    if (outcome === "missing") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (outcome === "last") return NextResponse.json({ error: "A riff needs at least one part" }, { status: 400 });

    if (outcome.audioPath) {
      const riffDir = path.resolve(MUSIC_DIR, riffAudioDir(id));
      const file = path.resolve(MUSIC_DIR, outcome.audioPath);
      if (file.startsWith(riffDir + path.sep)) {
        await fs.rm(file, { force: true }).catch((err) => console.warn(`Could not delete ${file}:`, err));
      }
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting riff part:", error);
    return NextResponse.json({ error: "Failed to delete part" }, { status: 500 });
  }
}
