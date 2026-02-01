"use client";

import { useState } from "react";
import { Artist, Album } from "@/types";

function AlbumCard({ album, onClick }: { album: Album; onClick: () => void }) {
  const [hasError, setHasError] = useState(false);

  // Use the first song's file path to get album art
  const firstSong = album.songs[0];
  const artUrl = firstSong ? `/api/albumart/${encodeURIComponent(firstSong.filePath)}` : null;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center p-4 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors group text-left w-full"
    >
      {/* Album Artwork */}
      {artUrl && !hasError ? (
        <img
          src={artUrl}
          alt={`${album.name} cover`}
          className="w-full aspect-square rounded-lg object-cover bg-gray-700 mb-3"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="w-full aspect-square bg-gray-700 rounded-lg flex items-center justify-center mb-3">
          <svg className="w-16 h-16 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
      )}

      {/* Album Name */}
      <h3 className="text-white font-medium text-sm truncate w-full text-center group-hover:text-green-400 transition-colors">
        {album.name}
      </h3>

      {/* Track Count */}
      <p className="text-gray-500 text-xs mt-1">
        {album.songs.length} track{album.songs.length !== 1 ? "s" : ""}
      </p>
    </button>
  );
}

interface AlbumGridProps {
  artist: Artist;
  onAlbumSelect: (album: Album) => void;
}

export default function AlbumGrid({ artist, onAlbumSelect }: AlbumGridProps) {
  return (
    <div className="h-full overflow-y-auto bg-gray-900 p-6">
      {/* Artist Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">{artist.name}</h1>
        <p className="text-gray-400 mt-1">
          {artist.albums.length} album{artist.albums.length !== 1 ? "s" : ""} •{" "}
          {artist.albums.reduce((acc, album) => acc + album.songs.length, 0)} songs
        </p>
      </div>

      {/* Album Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {artist.albums.map((album) => (
          <AlbumCard
            key={album.id}
            album={album}
            onClick={() => onAlbumSelect(album)}
          />
        ))}
      </div>
    </div>
  );
}
