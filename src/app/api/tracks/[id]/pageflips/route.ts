import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validatePageFlipInput } from "@/lib/pageFlips";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const flips = await prisma.trackPageFlip.findMany({
    where: { trackId: id },
    orderBy: { timestamp: "asc" },
  });
  return NextResponse.json(flips);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsed = validatePageFlipInput(await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const created = await prisma.trackPageFlip.create({
    data: { trackId: id, ...parsed.value },
  });
  return NextResponse.json(created);
}
