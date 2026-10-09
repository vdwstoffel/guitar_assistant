import { fetchSongsterrScore } from "./fetchScore";
import { gpFileNameFor } from "./fileName";
import { SongsterrToAlphaTabConverter } from "./converter/songsterr-to-alphatab.converter";
import type { ConversionWarning } from "./converter/types";
import type { FetchScoreOptions } from "./types";

export interface SongsterrImport {
  bytes: Uint8Array;
  fileName: string;
  title: string;
  artist: string;
  /** Parts the CDN withheld; the rest of the song converted regardless. */
  missingPartIds: number[];
  /** Things the Songsterr score says that Guitar Pro cannot express. */
  warnings: ConversionWarning[];
}

/**
 * A Songsterr link, as a Guitar Pro file ready to import.
 *
 * Songsterr does not serve Guitar Pro files, so there is nothing to
 * download: the score is rebuilt from the per-part JSON its player reads,
 * and written out by alphaTab's GP7 exporter. The result is faithful but
 * not identical — `warnings` lists what could not be carried across.
 */
export async function songsterrUrlToGp(
  url: string,
  options: FetchScoreOptions = {},
): Promise<SongsterrImport> {
  const score = await fetchSongsterrScore(url, options);

  const { data, warnings } = new SongsterrToAlphaTabConverter().toGp7({
    meta: score.meta,
    revisions: score.revisions,
  });

  return {
    bytes: data,
    fileName: gpFileNameFor(score.meta.title, score.meta.artist),
    title: score.meta.title,
    artist: score.meta.artist,
    missingPartIds: score.missingPartIds,
    warnings,
  };
}
