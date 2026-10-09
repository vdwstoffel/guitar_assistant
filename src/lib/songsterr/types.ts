import type { SongsterrStateMetaCurrent } from "./converter/types";
import type { SongsterrRevisionTrackInput } from "./converter/songsterr-to-alphatab.converter";

/** One Songsterr song, with every part we managed to retrieve. */
export interface SongsterrScore {
  meta: SongsterrStateMetaCurrent;
  revisions: SongsterrRevisionTrackInput[];
  /** Parts the CDN would not give us; the score converts without them. */
  missingPartIds: number[];
}

export interface FetchScoreOptions {
  /** Injected so the fetching can be tested without the network. */
  fetchImpl?: typeof fetch;
  /** Overridden in tests; defaults to Songsterr's two CDN hosts. */
  cdnHosts?: string[];
  /** How long any single request may take before it is abandoned. */
  timeoutMs?: number;
}
