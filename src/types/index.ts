export interface TrackTab {
  id: string;
  name: string;
  alphatex: string | null;
  tempo: number;
  /** Practice playback speed as a whole percentage (10-200); null = never set. */
  playbackSpeed: number | null;
  sortOrder: number;
  trackId: string;
}

export interface Marker {
  id: string;
  name: string;
  timestamp: number;
  trackId: string;
}

export interface SavedLoop {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  trackId: string;
}

export interface TrackPageFlip {
  id: string;
  timestamp: number;
  pdfPage: number;
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
  loops: SavedLoop[];
  tabs: TrackTab[];
  pageFlips: TrackPageFlip[];
  completed: boolean;
  inProgress: boolean;
  favorite: boolean;
  tempo: number | null;
  timeSignature: string;
  playbackSpeed: number | null;
  volume: number | null;
  lufs: number | null;
  notes: string | null;
  sourceVideoId: string | null;
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

export type VideoStatus = "pending" | "downloading" | "ready" | "failed";

export interface Video {
  id: string;
  title: string;
  youtubeId: string;
  sortOrder: number;
  category: string | null;
  completed: boolean;
  inProgress: boolean;
  notes: string | null;
  volume: number | null;
  playbackSpeed: number | null;
  localPath: string | null;
  duration: number | null;
  status: VideoStatus;
  errorMessage: string | null;
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
  inProgress: boolean;
  notes: string | null;
  volume: number | null;
  playbackSpeed: number | null;
  bookId: string;
  chapterId: string | null;
  createdAt: string;
  extractedTrackId: string | null;
  markers?: BookVideoMarker[];
}

export interface BookVideoMarker {
  id: string;
  name: string;
  timestamp: number;
  bookVideoId: string;
}

export interface JamTrackMarker {
  id: string;
  name: string;
  timestamp: number;
  jamTrackId: string;
}

export interface JamTrackLoop {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  jamTrackId: string;
}

export interface GpSongSection {
  id: string;
  name: string;
  /** Zero-based, inclusive. */
  startBar: number;
  endBar: number;
  sortOrder: number;
  gpSongId: string;
}

/**
 * A Guitar Pro file imported for practice. Not a JamTrack: it has no audio
 * recording, synthesising every instrument itself, so none of JamTrack's
 * audio fields (duration, lufs, volume) mean anything here.
 */
export interface GpSong {
  id: string;
  title: string;
  artist: string | null;
  filePath: string;
  tempo: number | null;
  /** Parsed from the row's JSON column by the API, never raw JSON here. */
  trackNames: string[];
  barCount: number;
  favorite: boolean;
  completed: boolean;
  inProgress: boolean;
  lastPlayedAt: string | null;
  completedAt: string | null;
  playbackSpeed: number | null;
  lastTrackIndex: number;
  /** The jam track this tab belongs to; null means it stands on its own. */
  jamTrackId: string | null;
  /** The lesson track this tab belongs to; null means it is not on one. */
  trackId: string | null;
  sections: GpSongSection[];
  createdAt: string;
}

export interface JamTrack {
  id: string;
  title: string;
  filePath: string;
  duration: number;
  completed: boolean;
  inProgress: boolean;
  favorite: boolean;
  tempo: number | null;
  timeSignature: string;
  playbackSpeed: number | null;
  volume: number | null;
  lufs: number | null;
  markers: JamTrackMarker[];
  loops: JamTrackLoop[];
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
  videoCount?: number; // Video lessons in the book, for books with no audio
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

export interface Recording {
  id: string;
  title: string;
  filePath: string;
  duration: number;
  mimeType: string;
  notes: string | null;
  trackName: string | null;
  trackId: string | null;
  tempo: number | null;
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

export interface BackingTrack {
  id: string;
  youtubeUrl: string;
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  audioPath: string | null;
  duration: number | null;
  rootNote: string;
  scaleType: string;
  volume: number | null;
  createdAt: string;
  updatedAt: string;
}

// Backwards compatibility aliases (for gradual migration)
export type Song = Track;
export type Album = Book;
export type Artist = Author;
