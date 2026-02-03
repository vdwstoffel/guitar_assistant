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
  pdfPage: number | null;
  markers: Marker[];
  completed: boolean;
  tempo: number | null;
  timeSignature: string;
}

export interface Book {
  id: string;
  name: string;
  authorId: string;
  pdfPath: string | null;
  inProgress: boolean;
  tracks: Track[];
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

// Backwards compatibility aliases (for gradual migration)
export type Song = Track;
export type Album = Book;
export type Artist = Author;
