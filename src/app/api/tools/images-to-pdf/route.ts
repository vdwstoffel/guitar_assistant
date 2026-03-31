import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PDFDocument } from "pdf-lib";
import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png"];
const MAX_IMAGES = 50;

// A4 in PDF points (72 points per inch)
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

export async function POST(request: NextRequest) {
  const tempFiles: string[] = [];

  try {
    const formData = await request.formData();
    const bookId = formData.get("bookId") as string;
    const imageFiles = formData.getAll("images") as File[];

    if (!bookId) {
      return NextResponse.json({ error: "No book selected" }, { status: 400 });
    }
    if (!imageFiles.length) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }
    if (imageFiles.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMAGES} images allowed` },
        { status: 400 }
      );
    }

    // Validate file types
    for (const file of imageFiles) {
      const ext = path.extname(file.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.name}. Only JPG and PNG are supported.` },
          { status: 400 }
        );
      }
    }

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: { author: true },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Build PDF from images
    const pdfDoc = await PDFDocument.create();

    for (const file of imageFiles) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const ext = path.extname(file.name).toLowerCase();

      const image =
        ext === ".png"
          ? await pdfDoc.embedPng(bytes)
          : await pdfDoc.embedJpg(bytes);

      // Scale image to fit A4 while maintaining aspect ratio
      const imgAspect = image.width / image.height;
      const pageAspect = A4_WIDTH / A4_HEIGHT;

      let drawWidth: number;
      let drawHeight: number;

      if (imgAspect > pageAspect) {
        // Image is wider relative to A4 — fit to width
        drawWidth = A4_WIDTH;
        drawHeight = A4_WIDTH / imgAspect;
      } else {
        // Image is taller relative to A4 — fit to height
        drawHeight = A4_HEIGHT;
        drawWidth = A4_HEIGHT * imgAspect;
      }

      const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      // Center the image on the page
      const x = (A4_WIDTH - drawWidth) / 2;
      const y = (A4_HEIGHT - drawHeight) / 2;
      page.drawImage(image, { x, y, width: drawWidth, height: drawHeight });
    }

    const pdfBytes = await pdfDoc.save();

    if (book.pdfPath) {
      // Append to existing PDF via Ghostscript
      const existingAbsPath = path.join(MUSIC_DIR, book.pdfPath);

      try {
        await fs.access(existingAbsPath);
      } catch {
        return NextResponse.json(
          { error: "Existing PDF file not found on disk" },
          { status: 404 }
        );
      }

      const timestamp = Date.now();
      const tempNewPdf = `/tmp/img2pdf_new_${timestamp}.pdf`;
      const tempOutput = `/tmp/img2pdf_output_${timestamp}.pdf`;
      tempFiles.push(tempNewPdf, tempOutput);

      await fs.writeFile(tempNewPdf, pdfBytes);

      const command = `gs -dBATCH -dNOPAUSE -sDEVICE=pdfwrite -sOutputFile="${tempOutput}" "${existingAbsPath}" "${tempNewPdf}"`;
      await execAsync(command, { timeout: 120000 });
      await fs.copyFile(tempOutput, existingAbsPath);

      return NextResponse.json({
        success: true,
        message: `${imageFiles.length} image(s) converted and appended to existing PDF`,
      });
    } else {
      // Save as new PDF
      const bookDir = path.join(MUSIC_DIR, book.author.name, book.name);
      await fs.mkdir(bookDir, { recursive: true });

      const pdfFileName = `${book.name}.pdf`;
      const pdfRelPath = path.join(book.author.name, book.name, pdfFileName);
      const pdfAbsPath = path.join(MUSIC_DIR, pdfRelPath);

      await fs.writeFile(pdfAbsPath, pdfBytes);

      await prisma.book.update({
        where: { id: bookId },
        data: { pdfPath: pdfRelPath },
      });

      return NextResponse.json({
        success: true,
        message: `${imageFiles.length} image(s) converted to PDF and assigned to book`,
      });
    }
  } catch (error) {
    console.error("Error converting images to PDF:", error);
    return NextResponse.json(
      { error: "Failed to convert images to PDF" },
      { status: 500 }
    );
  } finally {
    for (const f of tempFiles) {
      await fs.unlink(f).catch(() => {});
    }
  }
}
