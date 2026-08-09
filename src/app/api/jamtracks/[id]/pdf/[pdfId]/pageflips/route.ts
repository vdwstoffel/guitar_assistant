import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validatePageFlipInput } from "@/lib/pageFlips";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pdfId: string }> }
) {
  const { pdfId } = await params;
  const flips = await prisma.jamTrackPageFlip.findMany({
    where: { jamTrackPdfId: pdfId },
    orderBy: { timestamp: "asc" },
  });
  return NextResponse.json(flips);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pdfId: string }> }
) {
  const { pdfId } = await params;
  const parsed = validatePageFlipInput(await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const created = await prisma.jamTrackPageFlip.create({
    data: { jamTrackPdfId: pdfId, ...parsed.value },
  });
  return NextResponse.json(created);
}
