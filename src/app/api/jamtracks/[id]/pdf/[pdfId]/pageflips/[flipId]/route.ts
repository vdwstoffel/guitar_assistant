import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ flipId: string }> }
) {
  const { flipId } = await params;
  const body = await request.json();
  const data: { timestamp?: number; pdfPage?: number } = {};
  if (typeof body.timestamp === "number" && Number.isFinite(body.timestamp)) data.timestamp = body.timestamp;
  if (typeof body.pdfPage === "number" && Number.isInteger(body.pdfPage) && body.pdfPage >= 1) data.pdfPage = body.pdfPage;
  const updated = await prisma.jamTrackPageFlip.update({ where: { id: flipId }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ flipId: string }> }
) {
  const { flipId } = await params;
  await prisma.jamTrackPageFlip.delete({ where: { id: flipId } });
  return NextResponse.json({ success: true });
}
