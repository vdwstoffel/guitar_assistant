import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

async function readImageFromRequest(
  request: NextRequest
): Promise<{ buffer: Buffer; ext: string } | { error: string; status: number }> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);
    const url: unknown = body?.url;
    if (typeof url !== "string" || !url.trim()) {
      return { error: "No image URL provided", status: 400 };
    }

    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      return { error: "Invalid URL", status: 400 };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { error: "URL must be http(s)", status: 400 };
    }

    let res: Response;
    try {
      res = await fetch(parsed.toString(), { redirect: "follow" });
    } catch {
      return { error: "Failed to fetch image from URL", status: 400 };
    }
    if (!res.ok) {
      return { error: `Failed to fetch image (HTTP ${res.status})`, status: 400 };
    }

    const remoteType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    let ext = MIME_TO_EXT[remoteType];
    if (!ext) {
      const urlExt = path.extname(parsed.pathname).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(urlExt)) ext = urlExt === ".jpeg" ? ".jpg" : urlExt;
    }
    if (!ext) {
      return { error: "Unsupported image format. Use JPG, PNG, or WebP.", status: 400 };
    }

    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength > MAX_FILE_SIZE) {
      return { error: "Image too large (max 10MB)", status: 400 };
    }
    return { buffer: Buffer.from(arrayBuf), ext };
  }

  const formData = await request.formData();
  const file = formData.get("cover") as File | null;
  if (!file) {
    return { error: "No image file provided", status: 400 };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: "File too large (max 10MB)", status: 400 };
  }
  const ext = path.extname(file.name).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return { error: "Unsupported format. Use JPG, PNG, or WebP.", status: 400 };
  }
  return { buffer: Buffer.from(await file.arrayBuffer()), ext: ext === ".jpeg" ? ".jpg" : ext };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await readImageFromRequest(request);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { buffer, ext } = result;

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
