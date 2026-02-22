import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("cover") as File;

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "Unsupported format. Use JPG, PNG, or WebP." },
        { status: 400 }
      );
    }

    const book = await prisma.book.findUnique({
      where: { id },
      include: { author: true },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Delete old custom cover if exists
    if (book.coverPath) {
      const oldPath = path.join(MUSIC_DIR, book.coverPath);
      await fs.unlink(oldPath).catch(() => {});
    }

    // Save new cover
    const bookDir = path.join(MUSIC_DIR, book.author.name, book.name);
    await fs.mkdir(bookDir, { recursive: true });

    const coverFileName = `cover${ext}`;
    const coverRelativePath = path.join(book.author.name, book.name, coverFileName);
    const coverAbsolutePath = path.join(MUSIC_DIR, coverRelativePath);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(coverAbsolutePath, buffer);

    await prisma.book.update({
      where: { id },
      data: { coverPath: coverRelativePath },
    });

    return NextResponse.json({ success: true, coverPath: coverRelativePath });
  } catch (error) {
    console.error("Error uploading cover:", error);
    return NextResponse.json({ error: "Failed to upload cover" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    if (book.coverPath) {
      const absolutePath = path.join(MUSIC_DIR, book.coverPath);
      await fs.unlink(absolutePath).catch(() => {});
    }

    await prisma.book.update({
      where: { id },
      data: { coverPath: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting cover:", error);
    return NextResponse.json({ error: "Failed to delete cover" }, { status: 500 });
  }
}
