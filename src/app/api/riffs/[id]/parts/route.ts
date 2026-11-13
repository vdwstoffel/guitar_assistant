import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextPartName } from "@/lib/songwriting/riffs";
import { riffToJson } from "@/lib/songwriting/riffJson";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
    }
    const kind = (body as { kind?: unknown } | null)?.kind;
    if (kind !== "guitar" && kind !== "bass") {
      return NextResponse.json({ error: 'kind must be "guitar" or "bass"' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      if (!(await tx.riff.findUnique({ where: { id }, select: { id: true } }))) return null;
      const parts = await tx.riffPart.findMany({ where: { riffId: id }, select: { name: true, sortOrder: true } });
      const part = await tx.riffPart.create({
        data: {
          riffId: id,
          kind,
          name: nextPartName(kind, parts.map((p) => p.name)),
          sortOrder: parts.reduce((m, p) => Math.max(m, p.sortOrder), -1) + 1,
        },
      });
      const riff = await tx.riff.findUniqueOrThrow({ where: { id }, include: { parts: true } });
      return { part, riff };
    });
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const riff = riffToJson(result.riff);
    return NextResponse.json({ part: riff.parts.find((p) => p.id === result.part.id), riff }, { status: 201 });
  } catch (error) {
    console.error("Error creating riff part:", error);
    return NextResponse.json({ error: "Failed to create part" }, { status: 500 });
  }
}
