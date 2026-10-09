import * as path from "path";
import { isGpFile, GP_EXTENSIONS } from "./gpMetadata";
import type { UploadResult } from "./uploadErrors";
import type { GpMetadata } from "./gpMetadata";

/** Where every imported Guitar Pro file lives, under the music directory. */
export const GP_FOLDER = "GpSongs";

/** The row an import creates, as the caller's database layer takes it. */
export interface GpSongRow {
  title: string;
  artist: string | null;
  filePath: string;
  tempo: number | null;
  trackNames: string;
  barCount: number;
  jamTrackId: string | null;
  trackId: string | null;
}

/**
 * What an import needs from the outside world.
 *
 * Injected rather than imported so this can be tested on the host: the
 * generated Prisma client is built for the container's platform and will
 * not load here.
 */
export interface GpImportDeps {
  /** The existing row with this path, if the file name is already taken. */
  findByPath(filePath: string): Promise<{ title: string } | null>;
  create(row: GpSongRow): Promise<void>;
  /** Writes under the music directory; the path is relative to it. */
  writeFile(relativePath: string, bytes: Uint8Array): Promise<void>;
  parseMetadata(bytes: Uint8Array, fallbackTitle: string): Promise<GpMetadata>;
}

export interface GpImportRequest {
  bytes: Uint8Array;
  fileName: string;
  jamTrackId?: string | null;
  trackId?: string | null;
}

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}

/**
 * Take one Guitar Pro file into the library.
 *
 * Shared by both ways in — a file the user picked, and a score rebuilt from
 * a Songsterr link — so that the two cannot drift on what counts as a
 * duplicate, where files land, or which metadata is kept.
 *
 * Never throws: every outcome is a result the route can report per file,
 * because an upload of several files should not lose the good ones to the
 * first bad one.
 */
export async function importGpBytes(
  request: GpImportRequest,
  deps: GpImportDeps,
): Promise<UploadResult> {
  const { bytes, fileName, jamTrackId = null, trackId = null } = request;

  if (!isGpFile(fileName)) {
    return {
      name: fileName,
      success: false,
      error: `Not a Guitar Pro file (expected ${GP_EXTENSIONS.join(", ")})`,
    };
  }

  const safeName = sanitizeName(fileName);
  const relativePath = path.posix.join(GP_FOLDER, safeName);

  try {
    // Reject a duplicate before doing any work, so the user gets a sentence
    // instead of a unique-constraint error from Prisma.
    const clash = await deps.findByPath(relativePath);
    if (clash) {
      return {
        name: fileName,
        success: false,
        error: `"${clash.title}" was already imported from a file of this name.`,
      };
    }

    // Parse FIRST. A file that cannot be read never reaches the disk, so
    // there is no orphan to clean up and no name to collide with.
    const meta = await deps.parseMetadata(bytes, path.parse(safeName).name);

    await deps.writeFile(relativePath, bytes);
    await deps.create({
      title: meta.title,
      artist: meta.artist,
      filePath: relativePath,
      tempo: meta.tempo,
      trackNames: JSON.stringify(meta.trackNames),
      barCount: meta.barCount,
      jamTrackId,
      trackId,
    });

    return { name: fileName, success: true };
  } catch (err) {
    return {
      name: fileName,
      success: false,
      error: err instanceof Error ? err.message : "Could not read this file",
    };
  }
}
