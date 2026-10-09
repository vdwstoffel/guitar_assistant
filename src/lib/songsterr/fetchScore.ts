import {
  parseSongsterrUrl,
  extractStateMeta,
  buildRevisionUrl,
  songIdFromTabUrl,
} from "./songsterrUrl";
import type { SongsterrScore, FetchScoreOptions } from "./types";
import type { SongsterrRevisionTrackInput } from "./converter/songsterr-to-alphatab.converter";

/**
 * Songsterr serves each part's JSON from CloudFront, under two hosts. Which
 * one answers for a given song is not predictable, so the second is tried
 * when the first gives us nothing.
 */
const CDN_HOSTS = ["https://dqsljvtekg760.cloudfront.net", "https://d3d3l6a6rcgkaf.cloudfront.net"];

/** Plain `fetch` gets a bot page from Songsterr; a browser's UA does not. */
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Everything needed to rebuild one Songsterr song as a Guitar Pro file.
 *
 * Two round trips: the tab page, which carries the identifiers, and then one
 * request per part. Parts are fetched together rather than in turn — a song
 * routinely has six, and six sequential round trips is the difference
 * between a quick import and a slow one.
 */
export async function fetchSongsterrScore(
  rawUrl: string,
  options: FetchScoreOptions = {},
): Promise<SongsterrScore> {
  const {
    fetchImpl = fetch,
    cdnHosts = CDN_HOSTS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  // Before any request: a URL we will not fetch should never be fetched.
  const tabUrl = parseSongsterrUrl(rawUrl);

  const get = (url: string, accept: string) =>
    fetchImpl(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: accept },
      signal: AbortSignal.timeout(timeoutMs),
    });

  const page = await get(tabUrl, "text/html");
  if (!page.ok) {
    throw new Error(`Could not reach that Songsterr page (HTTP ${page.status}).`);
  }

  // Which song we actually landed on, after any redirect. Songsterr serves
  // a default state payload — some popular song — on every page that is not
  // a tab, so without this a link to the home page, a search or a favourites
  // list imports an unrelated song and reports success doing it.
  const expectedSongId = songIdFromTabUrl(page.url || tabUrl);
  if (expectedSongId === null) {
    throw new Error("That link does not open a song's tab on Songsterr.");
  }

  const meta = extractStateMeta(await page.text());
  if (meta.songId !== expectedSongId) {
    throw new Error("That Songsterr page is about a different song than the link.");
  }

  const partIds = meta.tracks
    .filter((track) => typeof track?.partId === "number")
    .map((track) => track.partId)
    .sort((left, right) => left - right);

  for (const host of cdnHosts) {
    const settled = await Promise.all(
      partIds.map(async (partId): Promise<SongsterrRevisionTrackInput | null> => {
        const trackMeta = meta.tracks.find((track) => track.partId === partId)!;
        try {
          const response = await get(buildRevisionUrl(meta, partId, host), "application/json");
          if (!response.ok) return null;
          return { trackMeta, revision: await response.json() };
        } catch {
          // One part failing is survivable; the loop below decides whether
          // enough of the song arrived to be worth converting.
          return null;
        }
      }),
    );

    const revisions = settled.filter((entry): entry is SongsterrRevisionTrackInput => entry !== null);
    if (revisions.length === 0) continue;

    const got = new Set(revisions.map((r) => r.trackMeta.partId));
    return { meta, revisions, missingPartIds: partIds.filter((id) => !got.has(id)) };
  }

  throw new Error("Could not download the tab data for this song.");
}
