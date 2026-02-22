export function getBookCoverUrl(book: {
  customCoverPath?: string | null;
  coverTrackPath?: string | null;
}): string | null {
  if (book.customCoverPath) {
    return `/api/covers/${encodeURIComponent(book.customCoverPath)}`;
  }
  if (book.coverTrackPath) {
    return `/api/albumart/${encodeURIComponent(book.coverTrackPath)}`;
  }
  return null;
}
