import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { parseRiffPatch, riffAudioDir } from "@/lib/songwriting/riffs";
import { riffToJson } from "@/lib/songwriting/riffJson";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const riff = await prisma.riff.findUnique({ where: { id }, include: { parts: true } });
    if (!riff) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(riffToJson(riff));
  } catch (error) {
    console.error("Error reading riff:", error);
    return NextResponse.json({ error: "Failed to read riff" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
    }
    const parsed = parseRiffPatch(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    if (!(await prisma.riff.findUnique({ where: { id }, select: { id: true } }))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const riff = await prisma.riff.update({ where: { id }, data: parsed.value, include: { parts: true } });
    return NextResponse.json(riffToJson(riff));
  } catch (error) {
    console.error("Error updating riff:", error);
    return NextResponse.json({ error: "Failed to update riff" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const riff = await prisma.riff.findUnique({ where: { id }, select: { id: true } });
    if (!riff) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.riff.delete({ where: { id } });

    const musicPath = path.resolve(MUSIC_DIR);
    const dir = path.resolve(musicPath, riffAudioDir(id));
    if (dir.startsWith(musicPath + path.sep)) {
      await fs.rm(dir, { recursive: true, force: true }).catch((err) => {
        console.warn(`Could not delete ${dir}:`, err);
      });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting riff:", error);
    return NextResponse.json({ error: "Failed to delete riff" }, { status: 500 });
  }
}
