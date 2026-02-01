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
}

export interface Book {
  id: string;
  name: string;
  authorId: string;
  pdfPath: string | null;
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

// Backwards compatibility aliases (for gradual migration)
export type Song = Track;
export type Album = Book;
export type Artist = Author;
