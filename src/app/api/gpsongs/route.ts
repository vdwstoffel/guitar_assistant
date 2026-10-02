import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeGpSong } from "@/lib/gp/serialize";

export async function GET() {
  const rows = await prisma.gpSong.findMany({
    include: { sections: { orderBy: { sortOrder: "asc" } } },
    orderBy: { title: "asc" },
  });
  return NextResponse.json(rows.map(serializeGpSong));
}
