import * as path from "path";

/**
 * What the app needs to know about a Guitar Pro file without re-reading it.
 *
 * Extracted once at import and stored on the row, because the alternative is
 * parsing every file on every list render. The file never changes after
 * import, so there is nothing to keep in step.
 */
export interface GpMetadata {
  title: string;
  artist: string | null;
  tempo: number | null;
  /** Track names in score order; index matches `score.tracks`. */
  trackNames: string[];
  barCount: number;
}

/** GP7 and GP8 both use ".gp"; alphaTab's Gp7To8Importer handles both. */
export const GP_EXTENSIONS = [".gp", ".gp3", ".gp4", ".gp5", ".gpx"] as const;

export function isGpFile(filename: string): boolean {
  return (GP_EXTENSIONS as readonly string[]).includes(
    path.extname(filename).toLowerCase(),
  );
}

/** Minimal shape of the alphaTab model this module walks. */
interface NoteCountable {
  staves: { bars: { voices: { beats: { notes: unknown[] }[] }[] }[] }[];
}

/** Every note in every voice of every bar, across all tracks. */
function countNotes(tracks: NoteCountable[]): number {
  let total = 0;
  for (const track of tracks) {
    for (const staff of track.staves ?? []) {
      for (const bar of staff.bars ?? []) {
        for (const voice of bar.voices ?? []) {
          for (const beat of voice.beats ?? []) {
            total += beat.notes?.length ?? 0;
          }
        }
      }
    }
  }
  return total;
}

/**
 * Which title to store: what the file says, or the filename.
 *
 * Its own function because the fallback branch is otherwise untestable —
 * every real fixture declares a title, so a test going through
 * `parseGpMetadata` can only ever assert the happy path.
 */
export function resolveTitle(declared: string | null | undefined, fallback: string): string {
  return (declared ?? "").trim() || fallback;
}

/**
 * Read a Guitar Pro file's metadata.
 *
 * Imported dynamically: alphaTab is a large browser-first bundle, and a
 * static import would pull it into every module that touches this one.
 *
 * Throws when the bytes are not a readable score, and when the score has no
 * tracks — a GP file with nothing in it is not something to practise, and
 * admitting one means a row the player cannot render.
 */
export async function parseGpMetadata(
  bytes: Uint8Array,
  fallbackTitle: string,
): Promise<GpMetadata> {
  const alphaTab = await import("@coderline/alphatab");
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
    bytes,
    new alphaTab.Settings(),
  );

  const tracks = score.tracks ?? [];
  if (tracks.length === 0) {
    throw new Error("This Guitar Pro file has no instrument tracks.");
  }

  // ScoreLoader does NOT reject bytes it cannot recognise: it falls through
  // to the AlphaTex importer, which accepts almost anything and returns a
  // one-track, one-bar score with no notes in it. So "did it parse?" cannot
  // tell a Guitar Pro file from a run of random bytes — only whether there
  // is any music in the result can.
  //
  // Counting notes rather than checking magic bytes, because that is
  // format-agnostic: GP3-5 announce themselves with "FICHIER GUITAR PRO",
  // GPX with a BCFZ/BCFS container, and GP7/8 with a plain zip header that
  // is shared with every other zip in the world. A file with no notes is
  // also, independently, nothing to practise.
  if (countNotes(tracks) === 0) {
    throw new Error("This file contains no music — it may not be a Guitar Pro file.");
  }

  const title = resolveTitle(score.title, fallbackTitle);
  const artist = (score.artist ?? "").trim() || null;
  const tempo =
    Number.isFinite(score.tempo) && score.tempo > 0 ? Math.round(score.tempo) : null;

  return {
    title,
    artist,
    tempo,
    trackNames: tracks.map((t, i) => (t.name ?? "").trim() || `Track ${i + 1}`),
    // Every track shares the same bar count; masterBars is the score-level
    // truth and is what bar-numbered sections refer to.
    barCount: score.masterBars?.length ?? tracks[0].staves[0].bars.length,
  };
}
