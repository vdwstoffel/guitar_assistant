export interface Marker {
  id: string;
  name: string;
  timestamp: number;
  trackId: string;
}

export interface Track {
  id: string;
  title: string;
  trackNumber: number;
  filePath: string;
  duration: number;
  bookId: string;
  chapterId: string | null;
  sortOrder: number;
  pdfPage: number | null;
  markers: Marker[];
  completed: boolean;
  tempo: number | null;
  timeSignature: string;
}

export interface Chapter {
  id: string;
  name: string;
  bookId: string;
  sortOrder: number;
  tracks: Track[];
  videos: BookVideo[];
  createdAt: string;
  updatedAt: string;
}

export interface Book {
  id: string;
  name: string;
  authorId: string;
  pdfPath: string | null;
  inProgress: boolean;
  trackCount: number;
  coverTrackPath: string | null;
  tracks: Track[];
  videos?: BookVideo[];
  chapters?: Chapter[];
}

export interface Author {
  id: string;
  name: string;
  books: Book[];
}

export interface Video {
  id: string;
  title: string;
  youtubeId: string;
  sortOrder: number;
  createdAt: string;
}

export interface BookVideo {
  id: string;
  filename: string;
  title: string | null;
  filePath: string;
  duration: number | null;
  sortOrder: number;
  trackNumber: number | null;
  pdfPage: number | null;
  completed: boolean;
  bookId: string;
  chapterId: string | null;
  createdAt: string;
}

export interface JamTrackMarker {
  id: string;
  name: string;
  timestamp: number;
  jamTrackId: string;
}

export interface TabSyncPoint {
  id: string;
  audioTime: number;
  tabTick: number;
  barIndex: number | null;
  jamTrackId: string;
}

export interface JamTrack {
  id: string;
  title: string;
  filePath: string;
  duration: number;
  pdfPath: string | null;
  tabPath: string | null;
  completed: boolean;
  tempo: number | null;
  timeSignature: string;
  markers: JamTrackMarker[];
  tabSyncPoints: TabSyncPoint[];
  createdAt: string;
}

// Lightweight types for library listing (no tracks/chapters/markers)
export interface BookSummary {
  id: string;
  name: string;
  authorId: string;
  pdfPath: string | null;
  inProgress: boolean;
  trackCount: number;
  coverTrackPath: string | null;
}

export interface AuthorSummary {
  id: string;
  name: string;
  books: BookSummary[];
}

// Backwards compatibility aliases (for gradual migration)
export type Song = Track;
export type Album = Book;
export type Artist = Author;
