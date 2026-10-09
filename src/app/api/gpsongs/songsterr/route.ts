import { NextRequest, NextResponse } from "next/server";
import { validateGpParent } from "@/lib/gp/parentLink";
import { importGpBytes } from "@/lib/gp/importGpBytes";
import { gpImportDeps } from "@/lib/gp/gpImportDeps";
import { songsterrUrlToGp } from "@/lib/songsterr";

/**
 * Import a Songsterr tab as a Guitar Pro file on a jam track or exercise.
 *
 * Answers in the same `{ results }` shape as the file upload, so the client
 * reports both the same way — this is one file's worth of import, it just
 * arrived over the network instead of through a file picker.
 */
export async function POST(request: NextRequest) {
  let url: string;
  let jamTrackId: string | null;
  let trackId: string | null;

  try {
    const body = await request.json();
    url = typeof body?.url === "string" ? body.url : "";
    jamTrackId = body?.jamTrackId || null;
    trackId = body?.trackId || null;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const parentError = validateGpParent({ jamTrackId, trackId });
  if (parentError) {
    return NextResponse.json({ error: parentError }, { status: 400 });
  }
  if (!url.trim()) {
    return NextResponse.json({ error: "Paste a Songsterr link first." }, { status: 400 });
  }

  let imported;
  try {
    imported = await songsterrUrlToGp(url);
  } catch (err) {
    // Everything that can go wrong here — a link to another site, a page
    // Songsterr has restructured, a CDN that will not answer — already
    // explains itself in a sentence meant for the person who pasted it.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not import that link." },
      { status: 400 },
    );
  }

  const result = await importGpBytes(
    { bytes: imported.bytes, fileName: imported.fileName, jamTrackId, trackId },
    gpImportDeps(),
  );

  return NextResponse.json({
    results: [result],
    // Reported but not treated as failure: a tab missing its vocal part, or
    // a slide Guitar Pro cannot spell, is still worth practising.
    missingPartIds: imported.missingPartIds,
    warningCount: imported.warnings.length,
  });
}
