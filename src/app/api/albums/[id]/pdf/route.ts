import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

// Convert PDF using Ghostscript to replace JPEG 2000 with standard JPEG
async function convertPdfWithGhostscript(inputPath: string, outputPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Ghostscript command to convert PDF with JPEG 2000 to standard JPEG
    // -dCompatibilityLevel=1.4 ensures older PDF format without JPEG 2000
    // -dPDFSETTINGS=/ebook gives good quality while ensuring compatibility
    const command = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dBATCH -sOutputFile="${outputPath}" "${inputPath}"`;

    console.log("Running Ghostscript command:", command);
    const { stdout, stderr } = await execAsync(command, { timeout: 120000 }); // 2 minute timeout
    console.log("Ghostscript stdout:", stdout);
    if (stderr) console.log("Ghostscript stderr:", stderr);
    return { success: true };
  } catch (error: unknown) {
    const err = error as { message?: string; stderr?: string; stdout?: string };
    console.error("Ghostscript conversion failed:", err.message);
    if (err.stderr) console.error("Ghostscript stderr:", err.stderr);
    if (err.stdout) console.error("Ghostscript stdout:", err.stdout);
    return { success: false, error: err.message || "Unknown error" };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Get album to verify it exists
    const album = await prisma.album.findUnique({
      where: { id },
      include: { artist: true },
    });

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    // Create directory structure: Artist/Album/
    const albumDir = path.join(MUSIC_DIR, album.artist.name, album.name);
    await fs.mkdir(albumDir, { recursive: true });

    // Save PDF with standardized name
    const pdfFileName = `${album.name}.pdf`;
    const pdfPath = path.join(album.artist.name, album.name, pdfFileName);
    const absolutePath = path.join(MUSIC_DIR, pdfPath);

    const buffer = Buffer.from(await file.arrayBuffer());

    // Save PDF directly (use PATCH endpoint to fix JPEG 2000 compatibility if needed)
    await fs.writeFile(absolutePath, buffer);

    // Update album with PDF path
    const updatedAlbum = await prisma.album.update({
      where: { id },
      data: { pdfPath },
      include: {
        artist: true,
        songs: {
          orderBy: { trackNumber: "asc" },
          include: { markers: { orderBy: { timestamp: "asc" } } },
        },
      },
    });

    return NextResponse.json({ album: updatedAlbum });
  } catch (error) {
    console.error("Error uploading PDF:", error);
    return NextResponse.json({ error: "Failed to upload PDF" }, { status: 500 });
  }
}

// Convert existing PDF in place (for fixing JPEG 2000 issues)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const album = await prisma.album.findUnique({
      where: { id },
    });

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    if (!album.pdfPath) {
      return NextResponse.json({ error: "Album has no PDF" }, { status: 400 });
    }

    const absolutePath = path.join(MUSIC_DIR, album.pdfPath);
    console.log("PATCH: Converting PDF at:", absolutePath);
    console.log("PATCH: Album pdfPath:", album.pdfPath);

    // Check if file exists
    try {
      await fs.access(absolutePath);
    } catch (err) {
      console.error("PATCH: File not found:", absolutePath, err);
      return NextResponse.json({ error: `PDF file not found on disk: ${absolutePath}` }, { status: 404 });
    }

    // Check if we have write permission
    try {
      await fs.access(absolutePath, 2); // 2 = W_OK (write permission)
    } catch {
      return NextResponse.json({
        error: "No write permission. Run: sudo chown -R $USER music/"
      }, { status: 403 });
    }

    // Use a temp file in /tmp which we have write access to
    const tempInputPath = `/tmp/pdf_convert_input_${Date.now()}.pdf`;
    const tempOutputPath = `/tmp/pdf_convert_output_${Date.now()}.pdf`;

    // Copy original to temp
    console.log("PATCH: Copying to temp:", tempInputPath);
    await fs.copyFile(absolutePath, tempInputPath);
    console.log("PATCH: Copy successful, starting conversion");

    // Convert using Ghostscript
    const result = await convertPdfWithGhostscript(tempInputPath, tempOutputPath);
    console.log("PATCH: Conversion result:", result);

    if (!result.success) {
      // Clean up temp files
      await fs.unlink(tempInputPath).catch(() => {});
      await fs.unlink(tempOutputPath).catch(() => {});
      return NextResponse.json({ error: `Ghostscript conversion failed: ${result.error}` }, { status: 500 });
    }

    // Copy converted file back to original location
    await fs.copyFile(tempOutputPath, absolutePath);

    // Clean up temp files
    await fs.unlink(tempInputPath).catch(() => {});
    await fs.unlink(tempOutputPath).catch(() => {});

    return NextResponse.json({ success: true, message: "PDF converted successfully" });
  } catch (error) {
    console.error("Error converting PDF:", error);
    return NextResponse.json({ error: "Failed to convert PDF" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const album = await prisma.album.findUnique({
      where: { id },
    });

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    if (album.pdfPath) {
      const absolutePath = path.join(MUSIC_DIR, album.pdfPath);
      try {
        await fs.unlink(absolutePath);
      } catch {
        // File may not exist, continue anyway
      }
    }

    await prisma.album.update({
      where: { id },
      data: { pdfPath: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting PDF:", error);
    return NextResponse.json({ error: "Failed to delete PDF" }, { status: 500 });
  }
}
