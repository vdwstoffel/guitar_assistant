import { Track, JamTrack, BookVideo, Video } from "@/types";

export type TrackableItem = Track | JamTrack | BookVideo | Video;

export interface PlayedRef {
  trackId: string | null;
  jamTrackId: string | null;
  bookVideoId: string | null;
  videoId: string | null;
}

// Discriminates the four playable item types by a unique property each carries,
// mirroring the type guards previously inlined in usePracticeSessionTracker.
// Keys used: youtubeId (Video), filename (BookVideo), pdfs (JamTrack), else Track.
export function playedRefForItem(item: TrackableItem): PlayedRef {
  const base: PlayedRef = { trackId: null, jamTrackId: null, bookVideoId: null, videoId: null };
  if ("pdfs" in item) return { ...base, jamTrackId: item.id };
  if ("youtubeId" in item) return { ...base, videoId: item.id };
  if ("filename" in item) return { ...base, bookVideoId: item.id };
  return { ...base, trackId: item.id };
}
