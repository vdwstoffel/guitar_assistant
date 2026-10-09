import type { SongsterrStateMetaCurrent } from "./converter/types";

/**
 * Stood in for an artist the page did not name.
 *
 * Exported because the file namer has to tell this apart from a real band
 * called the same thing, and a second literal would drift from this one.
 */
export const UNKNOWN_ARTIST = "Unknown Artist";

/** The only hosts a tab may be imported from. */
const SONGSTERR_HOSTS = new Set(["songsterr.com", "www.songsterr.com"]);

/**
 * The tab page's URL, normalised, or an error sentence explaining the refusal.
 *
 * Checks the host against a set rather than with `endsWith`, because
 * `songsterr.com.example.test` ends with the real host and is not it — and
 * whatever this returns is a URL the server will go and fetch.
 */
export function parseSongsterrUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("That is not a valid URL.");
  }

  if (!SONGSTERR_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("Only a songsterr.com link can be imported.");
  }

  // Songsterr serves https; asking for http only earns a redirect.
  url.protocol = "https:";
  return url.toString();
}

/**
 * The song's identifiers, read out of the JSON the tab page ships with.
 *
 * Songsterr renders its player from a `#state` script tag, and that payload
 * is the only place the revision id and image hash appear — both are needed
 * to address the per-part JSON on the CDN.
 *
 * This is the part of the import most likely to break one day, since the
 * shape is nobody's published contract. Every failure here therefore says
 * the same thing in the same words: the page could not be read. The cause
 * is always the same too, whichever branch catches it.
 */
export function extractStateMeta(html: string): SongsterrStateMetaCurrent {
  const match = html.match(/<script[^>]*\bid="state"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw unreadablePage();

  let current: Record<string, unknown>;
  try {
    current = JSON.parse(match[1])?.meta?.current;
  } catch {
    throw unreadablePage();
  }

  if (
    typeof current?.songId !== "number" ||
    typeof current.revisionId !== "number" ||
    typeof current.image !== "string"
  ) {
    throw unreadablePage();
  }

  return {
    songId: current.songId,
    revisionId: current.revisionId,
    image: current.image,
    title: typeof current.title === "string" && current.title ? current.title : "Song",
    artist: typeof current.artist === "string" && current.artist ? current.artist : UNKNOWN_ARTIST,
    tracks: Array.isArray(current.tracks) ? current.tracks : [],
  };
}

function unreadablePage(): Error {
  return new Error(
    "Could not read this Songsterr page — it may have changed, or the link may not be a tab.",
  );
}

/** Where one part's revision JSON lives on the CDN. */
export function buildRevisionUrl(
  meta: SongsterrStateMetaCurrent,
  partId: number,
  cdnBase: string,
): string {
  return `${cdnBase}/${meta.songId}/${meta.revisionId}/${meta.image}/${partId}.json`;
}

/**
 * Which song a Songsterr page is about, read from its own address.
 *
 * Needed because Songsterr serves a default `#state` payload — some
 * popular song — on every page that is not a tab: its home page, a
 * favourites list, a search. Reading that state alone, those pages look
 * exactly like a successful import of a song nobody asked for.
 *
 * Only ever applied to the address actually landed on, after redirects:
 * every form that reaches a tab ends in the song id, including the older
 * `?id=` links, which redirect to one that does.
 */
export function songIdFromTabUrl(url: string): number | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }

  // A trailing t<id> selects a track within the song; the song is the -s.
  const match = pathname.match(/-s(\d+)(?:t\d+)?$/);
  return match ? Number(match[1]) : null;
}
