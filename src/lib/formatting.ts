export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatDurationLong(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

/**
 * Label for what a book actually holds. A book can carry audio tracks, video
 * lessons, or both, so show whichever it has and fall back to the PDF.
 */
export function formatBookContents(
  trackCount: number,
  videoCount: number | undefined,
  pdfPath: string | null
): string {
  const parts: string[] = [];
  if (trackCount > 0) parts.push(`${trackCount} track${trackCount !== 1 ? "s" : ""}`);
  if (videoCount) parts.push(`${videoCount} video${videoCount !== 1 ? "s" : ""}`);
  if (parts.length > 0) return parts.join(" · ");
  return pdfPath ? "PDF only" : "0 tracks";
}
