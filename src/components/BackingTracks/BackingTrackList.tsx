'use client';

import type { BackingTrack } from '@/types';

interface BackingTrackListProps {
  tracks: BackingTrack[];
  onSelect: (id: string) => void;
  onAddClick: () => void;
}

export default function BackingTrackList({ tracks, onSelect, onAddClick }: BackingTrackListProps) {
  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-amber-100">Backing Tracks</h1>
          <button
            onClick={onAddClick}
            className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium"
          >
            + Add Backing Track
          </button>
        </div>

        {tracks.length === 0 ? (
          <div className="text-center text-neutral-400 py-16">
            <p className="text-lg mb-2">No backing tracks yet.</p>
            <p className="text-sm">Click <span className="text-amber-300">+ Add Backing Track</span> to paste a YouTube URL and start practicing over it.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tracks.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelect(t.id)}
                className="text-left bg-neutral-900 hover:bg-neutral-800 rounded-lg overflow-hidden border border-neutral-800 transition-colors"
              >
                {t.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.thumbnailUrl}
                    alt={t.title}
                    className="w-full aspect-video object-cover"
                  />
                )}
                <div className="p-3">
                  <p className="text-white font-medium truncate">{t.title}</p>
                  <p className="text-amber-300 text-sm mt-1">{t.rootNote} {t.scaleType}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
