import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("pdf") as File;
    const authorName = formData.get("authorName") as string;
    const bookName = formData.get("bookName") as string;

    if (!file || !authorName?.trim() || !bookName?.trim()) {
      return NextResponse.json(
        { error: "PDF file, author name, and book name are required" },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
    }

    const safeAuthor = sanitizeName(authorName.trim());
    const safeBook = sanitizeName(bookName.trim());

    // Create folder structure: music/Author/Book/
    const bookDir = path.join(MUSIC_DIR, safeAuthor, safeBook);
    await fs.mkdir(bookDir, { recursive: true });

    // Save PDF
    const pdfFileName = `${safeBook}.pdf`;
    const pdfRelPath = path.join(safeAuthor, safeBook, pdfFileName);
    const pdfAbsPath = path.join(MUSIC_DIR, pdfRelPath);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(pdfAbsPath, buffer);

    // Upsert author
    const author = await prisma.author.upsert({
      where: { name: safeAuthor },
      update: {},
      create: { name: safeAuthor },
    });

    // Upsert book with pdfPath
    const book = await prisma.book.upsert({
      where: {
        name_authorId: {
          name: safeBook,
          authorId: author.id,
        },
      },
      update: { pdfPath: pdfRelPath },
      create: {
        name: safeBook,
        authorId: author.id,
        pdfPath: pdfRelPath,
      },
    });

    return NextResponse.json({
      success: true,
      book: { id: book.id, name: book.name, authorName: safeAuthor },
    });
  } catch (error) {
    console.error("Error uploading PDF book:", error);
    return NextResponse.json(
      { error: "Failed to upload PDF book" },
      { status: 500 }
    );
  }
}
