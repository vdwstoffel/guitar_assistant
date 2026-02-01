"use client";

import { useState, useRef } from "react";
import { Artist, Album, Song } from "@/types";

interface LibraryProps {
  artists: Artist[];
  currentSong: Song | null;
  onSongSelect: (song: Song, artist: Artist, album: Album) => void;
  onScan: () => void;
  onUpload: (files: FileList) => Promise<void>;
  isScanning: boolean;
  isUploading: boolean;
}

export default function Library({
  artists,
  currentSong,
  onSongSelect,
  onScan,
  onUpload,
  isScanning,
  isUploading,
}: LibraryProps) {
  const [expandedArtists, setExpandedArtists] = useState<Set<string>>(
    new Set()
  );
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleArtist = (artistId: string) => {
    const newExpanded = new Set(expandedArtists);
    if (newExpanded.has(artistId)) {
      newExpanded.delete(artistId);
    } else {
      newExpanded.add(artistId);
    }
    setExpandedArtists(newExpanded);
  };

  const toggleAlbum = (albumId: string) => {
    const newExpanded = new Set(expandedAlbums);
    if (newExpanded.has(albumId)) {
      newExpanded.delete(albumId);
    } else {
      newExpanded.add(albumId);
    }
    setExpandedAlbums(newExpanded);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await onUpload(e.target.files);
      e.target.value = "";
    }
    setMenuOpen(false);
  };

  const isBusy = isScanning || isUploading;

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-xl font-bold">Library</h2>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            disabled={isBusy}
            className="p-2 hover:bg-gray-700 disabled:bg-gray-800 rounded transition-colors"
            title="Library options"
          >
            {isBusy ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            )}
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-20 py-1">
                <button
                  onClick={() => {
                    onScan();
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Scan Library
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload Files
                </button>
              </div>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".mp3,.flac,.wav,.ogg,.m4a,.aac"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {artists.length === 0 ? (
          <div className="text-gray-400 text-center p-8">
            <p>No music in library.</p>
            <p className="text-sm mt-2">
              Add music folders to the <code className="bg-gray-800 px-1 rounded">music/</code> directory
              and click Scan Library.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {artists.map((artist) => (
              <li key={artist.id}>
                <button
                  onClick={() => toggleArtist(artist.id)}
                  className="w-full flex items-center gap-2 p-2 hover:bg-gray-800 rounded text-left"
                >
                  <span className="text-gray-400 w-4">
                    {expandedArtists.has(artist.id) ? "▼" : "▶"}
                  </span>
                  <span className="font-medium">{artist.name}</span>
                  <span className="text-gray-500 text-sm ml-auto">
                    {artist.albums.length} album
                    {artist.albums.length !== 1 ? "s" : ""}
                  </span>
                </button>

                {expandedArtists.has(artist.id) && (
                  <ul className="ml-4 space-y-1">
                    {artist.albums.map((album) => (
                      <li key={album.id}>
                        <button
                          onClick={() => toggleAlbum(album.id)}
                          className="w-full flex items-center gap-2 p-2 hover:bg-gray-800 rounded text-left"
                        >
                          <span className="text-gray-400 w-4">
                            {expandedAlbums.has(album.id) ? "▼" : "▶"}
                          </span>
                          <span className="text-gray-300">{album.name}</span>
                          <span className="text-gray-500 text-sm ml-auto">
                            {album.songs.length} song
                            {album.songs.length !== 1 ? "s" : ""}
                          </span>
                        </button>

                        {expandedAlbums.has(album.id) && (
                          <ul className="ml-6 space-y-1">
                            {album.songs.map((song) => (
                              <li key={song.id}>
                                <button
                                  onClick={() =>
                                    onSongSelect(song, artist, album)
                                  }
                                  className={`w-full flex items-center gap-3 p-2 rounded text-left transition-colors ${
                                    currentSong?.id === song.id
                                      ? "bg-green-900 text-green-100"
                                      : "hover:bg-gray-800"
                                  }`}
                                >
                                  <span className="text-gray-500 w-6 text-right text-sm">
                                    {song.trackNumber || "-"}
                                  </span>
                                  <span className="flex-1 truncate">
                                    {song.title}
                                  </span>
                                  <span className="text-gray-500 text-sm">
                                    {formatDuration(song.duration)}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
