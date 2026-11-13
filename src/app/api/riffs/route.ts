import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { audioExtension } from "@/lib/recordings/mime";
import { defaultRiffName, parseRiffInput, riffAudioDir } from "@/lib/songwriting/riffs";
import { riffToJson } from "@/lib/songwriting/riffJson";
import type { RiffSummary } from "@/types";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

function timestampSlug(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

export async function GET() {
  try {
    const riffs = await prisma.riff.findMany({
      orderBy: { createdAt: "desc" },
      include: { parts: { orderBy: { sortOrder: "asc" } } },
    });
    const out: RiffSummary[] = riffs.map((r) => ({
      id: r.id,
      name: r.name,
      keyRoot: r.keyRoot,
      scale: r.scale,
      tuning: r.tuning,
      tempo: r.tempo,
      tsNum: r.tsNum,
      tsDen: r.tsDen,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      parts: r.parts.map((p) => ({
        id: p.id,
        kind: p.kind,
        name: p.name,
        hasTab: !!p.alphatex?.trim(),
        hasAudio: !!p.audioPath,
      })),
    }));
    return NextResponse.json(out);
  } catch (error) {
    console.error("Error listing riffs:", error);
    return NextResponse.json({ error: "Failed to list riffs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let riffDir: string | null = null;
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    let metaRaw: unknown;
    try {
      metaRaw = JSON.parse(String(formData.get("meta") ?? ""));
    } catch {
      return NextResponse.json({ error: "meta must be JSON" }, { status: 400 });
    }
    const parsed = parseRiffInput(metaRaw);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.value;
    const meta = metaRaw as Record<string, unknown>;

    const riffId = randomUUID();
    const partId = randomUUID();
    const mime = file.type || "audio/webm";
    const relDir = riffAudioDir(riffId);
    const relPath = `${relDir}/${partId}-${timestampSlug()}${audioExtension(mime)}`;

    const musicPath = path.resolve(MUSIC_DIR);
    riffDir = path.resolve(musicPath, relDir);
    await fs.mkdir(riffDir, { recursive: true });
    await fs.writeFile(path.resolve(musicPath, relPath), Buffer.from(await file.arrayBuffer()));

    const name =
      input.name ||
      defaultRiffName((await prisma.riff.findMany({ where: { name: { startsWith: "Riff " } }, select: { name: true } })).map((r) => r.name));
    const riff = await prisma.riff.create({
      data: {
        id: riffId,
        name,
        keyRoot: input.keyRoot,
        scale: input.scale,
        tuning: input.tuning,
        tempo: input.tempo,
        tsNum: input.tsNum,
        tsDen: input.tsDen,
        progression: input.progression.length ? JSON.stringify(input.progression) : null,
        parts: {
          create: {
            id: partId,
            kind: "guitar",
            name: "Guitar 1",
            sortOrder: 0,
            audioPath: relPath,
            audioMime: mime,
            audioDuration: num(meta.audioDuration),
            trimStart: num(meta.trimStart),
            trimEnd: num(meta.trimEnd),
          },
        },
      },
      include: { parts: true },
    });
    return NextResponse.json(riffToJson(riff), { status: 201 });
  } catch (error) {
    console.error("Error creating riff:", error);
    if (riffDir) await fs.rm(riffDir, { recursive: true, force: true }).catch(() => {});
    return NextResponse.json({ error: "Failed to create riff" }, { status: 500 });
  }
}
