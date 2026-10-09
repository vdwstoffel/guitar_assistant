import { NextRequest, NextResponse } from "next/server";
import { validateGpParent } from "@/lib/gp/parentLink";
import { importGpBytes } from "@/lib/gp/importGpBytes";
import { gpImportDeps } from "@/lib/gp/gpImportDeps";
import type { UploadResult } from "@/lib/gp/uploadErrors";

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

    const deps = gpImportDeps();
    const results: UploadResult[] = [];

    // One at a time, and one result each: a batch should report on every
    // file it was given, not stop at the first that cannot be read.
    for (const file of files) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        results.push(await importGpBytes({ bytes, fileName: file.name, jamTrackId, trackId }, deps));
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
