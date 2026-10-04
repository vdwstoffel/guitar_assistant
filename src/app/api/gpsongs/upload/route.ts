import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";
import { parseGpMetadata, isGpFile, GP_EXTENSIONS } from "@/lib/gp/gpMetadata";
import { validateGpParent } from "@/lib/gp/parentLink";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
const GP_FOLDER = "GpSongs";

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    // Set when the import is "Add tab" on an existing jam track, or an
    // import onto a lesson track from that track's tabs list, so the link is
    // made at creation rather than by a second round trip.
    const jamTrackId = (formData.get("jamTrackId") as string | null) || null;
    const trackId = (formData.get("trackId") as string | null) || null;
    const parentError = validateGpParent({ jamTrackId, trackId });
    if (parentError) {
      return NextResponse.json({ error: parentError }, { status: 400 });
    }
    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const gpPath = path.join(path.resolve(MUSIC_DIR), GP_FOLDER);
    await fs.mkdir(gpPath, { recursive: true });

    const results: { name: string; success: boolean; error?: string }[] = [];

    for (const file of files) {
      if (!isGpFile(file.name)) {
        results.push({
          name: file.name,
          success: false,
          error: `Not a Guitar Pro file (expected ${GP_EXTENSIONS.join(", ")})`,
        });
        continue;
      }

      const safeName = sanitizeName(file.name);
      const relativePath = path.posix.join(GP_FOLDER, safeName);

      try {
        // Reject a duplicate before doing any work, so the user gets a
        // sentence instead of a unique-constraint error from Prisma.
        const clash = await prisma.gpSong.findUnique({ where: { filePath: relativePath } });
        if (clash) {
          results.push({
            name: file.name,
            success: false,
            error: `"${clash.title}" was already imported from a file of this name.`,
          });
          continue;
        }

        const bytes = new Uint8Array(await file.arrayBuffer());
        // Parse FIRST. A file that cannot be read never reaches the disk,
        // so there is no orphan to clean up and no name to collide with.
        const meta = await parseGpMetadata(bytes, path.parse(safeName).name);

        await fs.writeFile(path.join(gpPath, safeName), bytes);
        await prisma.gpSong.create({
          data: {
            title: meta.title,
            artist: meta.artist,
            filePath: relativePath,
            tempo: meta.tempo,
            trackNames: JSON.stringify(meta.trackNames),
            barCount: meta.barCount,
            jamTrackId,
            trackId,
          },
        });

        results.push({ name: file.name, success: true });
      } catch (err) {
        results.push({
          name: file.name,
          success: false,
          error: err instanceof Error ? err.message : "Could not read this file",
        });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
