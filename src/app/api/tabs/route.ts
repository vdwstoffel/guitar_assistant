import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export interface TabPickerEntry {
  id: string;
  name: string;
  trackId: string;
  trackTitle: string;
}

export async function GET() {
  try {
    const tabs = await prisma.trackTab.findMany({
      include: { track: true },
      orderBy: [{ track: { title: "asc" } }, { sortOrder: "asc" }],
    });

    const entries: TabPickerEntry[] = tabs.map((tab) => ({
      id: tab.id,
      name: tab.name,
      trackId: tab.trackId,
      trackTitle: tab.track.title,
    }));

    return NextResponse.json(entries);
  } catch (error) {
    console.error("Error fetching tabs:", error);
    return NextResponse.json(
      { error: "Failed to fetch tabs" },
      { status: 500 }
    );
  }
}
