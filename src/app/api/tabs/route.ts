import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// Configure route for file uploads
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MUSIC_DIR = process.env.MUSIC_DIR || path.join(process.cwd(), "music");
const GUITAR_TABS_DIR = path.join(MUSIC_DIR, "GuitarTabs");

// GET /api/tabs - List all guitar tabs
export async function GET() {
  try {
    const tabs = await prisma.guitarTab.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        filePath: true,
        tempo: true,
        timeSignature: true,
        duration: true,
        completed: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(tabs);
  } catch (error) {
    console.error("Error fetching tabs:", error);
    return NextResponse.json(
      { error: "Failed to fetch tabs" },
      { status: 500 }
    );
  }
}

// POST /api/tabs - Upload a new guitar tab (Guitar Pro file)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file extension
    const filename = file.name;
    const ext = path.extname(filename).toLowerCase();
    const validExtensions = [".gp3", ".gp4", ".gp5", ".gpx", ".gp"];

    if (!validExtensions.includes(ext)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a Guitar Pro file (.gp3, .gp4, .gp5, .gpx, .gp)" },
        { status: 400 }
      );
    }

    // Extract title from filename (without extension)
    const title = path.basename(filename, ext);

    // Ensure GuitarTabs directory exists
    await mkdir(GUITAR_TABS_DIR, { recursive: true });

    // Generate unique filename to avoid collisions
    const timestamp = Date.now();
    const safeFilename = `${title.replace(/[^a-z0-9_-]/gi, '_')}_${timestamp}${ext}`;
    const filePath = path.join("GuitarTabs", safeFilename);
    const absolutePath = path.join(GUITAR_TABS_DIR, safeFilename);

    // Save file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(absolutePath, buffer);

    // Create database record
    const tab = await prisma.guitarTab.create({
      data: {
        title: title.trim(),
        filePath,
      },
    });

    return NextResponse.json(tab, { status: 201 });
  } catch (error) {
    console.error("Error uploading tab:", error);
    return NextResponse.json(
      { error: "Failed to upload tab" },
      { status: 500 }
    );
  }
}
