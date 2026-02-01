export interface Marker {
  id: string;
  name: string;
  timestamp: number;
  songId: string;
}

export interface Song {
  id: string;
  title: string;
  trackNumber: number;
  filePath: string;
  duration: number;
  albumId: string;
  pdfPage: number | null;
  markers: Marker[];
  completed: boolean;
}

export interface Album {
  id: string;
  name: string;
  artistId: string;
  pdfPath: string | null;
  songs: Song[];
}

export interface Artist {
  id: string;
  name: string;
  albums: Album[];
}

export interface Video {
  id: string;
  title: string;
  youtubeId: string;
  sortOrder: number;
  createdAt: string;
}
