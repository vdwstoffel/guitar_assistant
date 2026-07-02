/**
 * Regex matching the YouTube URL variants we accept.
 * Kept in sync with the (previously inline) regex in the jam-tracks YouTube route.
 */
export const YOUTUBE_URL_REGEX =
  /^https?:\/\/(www\.)?(youtube\.com\/(watch\?.*v=|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?.*v=)/;

export function isValidYouTubeUrl(url: string): boolean {
  return YOUTUBE_URL_REGEX.test(url);
}

/**
 * Extract the 11-char YouTube video id from a supported URL form.
 * Returns null for URLs that are not valid YouTube URLs or that lack an id.
 */
export function extractVideoId(url: string): string | null {
  if (!isValidYouTubeUrl(url)) return null;

  // youtu.be/<id>
  const shortMatch = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  // youtube.com/shorts/<id>
  const shortsMatch = url.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];

  // youtube.com/watch?v=<id> or music.youtube.com/watch?v=<id>
  const watchMatch = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];

  return null;
}

export function buildEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

export function thumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
