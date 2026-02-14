import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";

const MUSIC_DIR = process.env.MUSIC_DIR || path.join(process.cwd(), "music");

interface UpdateTabBody {
  title?: string;
  tempo?: number | null;
  timeSignature?: string | null;
  completed?: boolean;
}

// GET /api/tabs/[id] - Fetch a single tab with full alphaTex
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tab = await prisma.guitarTab.findUnique({
      where: { id },
    });

    if (!tab) {
      return NextResponse.json({ error: "Tab not found" }, { status: 404 });
    }

    return NextResponse.json(tab);
  } catch (error) {
    console.error("Error fetching tab:", error);
    return NextResponse.json(
      { error: "Failed to fetch tab" },
      { status: 500 }
    );
  }
}

// PATCH /api/tabs/[id] - Update a tab (metadata only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateTabBody = await request.json();

    const updateData: any = {};

    if (body.title !== undefined) {
      updateData.title = body.title.trim();
    }
    if (body.tempo !== undefined) {
      updateData.tempo = body.tempo;
    }
    if (body.timeSignature !== undefined) {
      updateData.timeSignature = body.timeSignature;
    }
    if (body.completed !== undefined) {
      updateData.completed = body.completed;
    }

    const updated = await prisma.guitarTab.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating tab:", error);
    return NextResponse.json(
      { error: "Failed to update tab" },
      { status: 500 }
    );
  }
}

// DELETE /api/tabs/[id] - Delete a tab and its file
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if tab exists
    const tab = await prisma.guitarTab.findUnique({
      where: { id },
    });

    if (!tab) {
      return NextResponse.json({ error: "Tab not found" }, { status: 404 });
    }

    // Delete file from disk
    try {
      const absolutePath = path.join(MUSIC_DIR, tab.filePath);
      await unlink(absolutePath);
    } catch (fileError) {
      console.warn("Warning: Could not delete file:", fileError);
      // Continue with database deletion even if file delete fails
    }

    // Delete from database
    await prisma.guitarTab.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting tab:", error);
    return NextResponse.json(
      { error: "Failed to delete tab" },
      { status: 500 }
    );
  }
}
