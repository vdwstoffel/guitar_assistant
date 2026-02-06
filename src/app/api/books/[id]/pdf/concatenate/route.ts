import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tempFiles: string[] = [];

  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("pdf") as File;

    if (!file) {
      return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
    }

    const book = await prisma.book.findUnique({
      where: { id },
      include: { author: true },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    if (!book.pdfPath) {
      return NextResponse.json(
        { error: "Book has no existing PDF. Use the standard upload endpoint." },
        { status: 400 }
      );
    }

    const existingAbsPath = path.join(MUSIC_DIR, book.pdfPath);

    // Verify existing PDF exists on disk
    try {
      await fs.access(existingAbsPath);
    } catch {
      return NextResponse.json(
        { error: "Existing PDF file not found on disk" },
        { status: 404 }
      );
    }

    // Save uploaded PDF to temp file
    const timestamp = Date.now();
    const tempUploadPath = `/tmp/pdf_concat_upload_${timestamp}.pdf`;
    const tempOutputPath = `/tmp/pdf_concat_output_${timestamp}.pdf`;
    tempFiles.push(tempUploadPath, tempOutputPath);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempUploadPath, buffer);

    // Concatenate using Ghostscript
    const command = `gs -dBATCH -dNOPAUSE -sDEVICE=pdfwrite -sOutputFile="${tempOutputPath}" "${existingAbsPath}" "${tempUploadPath}"`;

    console.log("Running Ghostscript concatenation:", command);
    const { stderr } = await execAsync(command, { timeout: 120000 });
    if (stderr) console.log("Ghostscript stderr:", stderr);

    // Replace the original PDF with the concatenated result
    await fs.copyFile(tempOutputPath, existingAbsPath);

    return NextResponse.json({
      success: true,
      message: "Pages appended successfully",
    });
  } catch (error) {
    console.error("Error concatenating PDF:", error);
    return NextResponse.json(
      { error: "PDF concatenation failed" },
      { status: 500 }
    );
  } finally {
    // Clean up temp files
    for (const tempFile of tempFiles) {
      await fs.unlink(tempFile).catch(() => {});
    }
  }
}
