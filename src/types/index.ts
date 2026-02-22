export interface Marker {
  id: string;
  name: string;
  timestamp: number;
  pdfPage: number | null;
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
  favorite: boolean;
  tempo: number | null;
  timeSignature: string;
  playbackSpeed: number | null;
  lufs: number | null;
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
  customCoverPath: string | null;
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
  category: string | null;
  createdAt: string;
}

export const VIDEO_CATEGORIES = [
  "Warmup",
  "Backing Track",
  "Play Along",
  "Tutorial",
  "Performance",
  "Exercise"
] as const;

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

export interface PageSyncPoint {
  id: string;
  timeInSeconds: number;
  pageNumber: number;
  jamTrackPdfId: string;
}

export interface JamTrackPdf {
  id: string;
  name: string;
  filePath: string;
  fileType: "pdf" | "alphatex";
  sortOrder: number;
  jamTrackId: string;
  pageSyncPoints: PageSyncPoint[];
}

export interface JamTrack {
  id: string;
  title: string;
  filePath: string;
  duration: number;
  completed: boolean;
  favorite: boolean;
  tempo: number | null;
  timeSignature: string;
  playbackSpeed: number | null;
  lufs: number | null;
  markers: JamTrackMarker[];
  pdfs: JamTrackPdf[];
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
  customCoverPath: string | null;
  completedCount?: number; // Number of completed tracks/videos
  totalCount?: number; // Total tracks + videos
}

export interface AuthorSummary {
  id: string;
  name: string;
  books: BookSummary[];
}

export interface PracticeSession {
  id: string;
  trackId: string | null;
  jamTrackId: string | null;
  bookVideoId: string | null;
  startTime: string;
  durationSeconds: number;
  playbackSpeed: number;
  completedSession: boolean;
  trackTitle: string;
  createdAt: string;
}

// Search result types (lightweight, only fields returned by /api/search)
export interface SearchResultTrack {
  id: string;
  title: string;
  trackNumber: number;
  bookId: string;
  book: {
    id: string;
    name: string;
    authorId: string;
    pdfPath: string | null;
    author: { id: string; name: string };
  };
}

export interface SearchResultBook {
  id: string;
  name: string;
  authorId: string;
  pdfPath: string | null;
  author: { id: string; name: string };
}

export interface SearchResultJamTrack {
  id: string;
  title: string;
  duration: number;
}

export interface SearchResults {
  tracks: SearchResultTrack[];
  books: SearchResultBook[];
  jamTracks: SearchResultJamTrack[];
}

// Backwards compatibility aliases (for gradual migration)
export type Song = Track;
export type Album = Book;
export type Artist = Author;
