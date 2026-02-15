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
  tempo: number | null;
  timeSignature: string;
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
  completedCount?: number; // Number of completed tracks/videos
  totalCount?: number; // Total tracks + videos
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
