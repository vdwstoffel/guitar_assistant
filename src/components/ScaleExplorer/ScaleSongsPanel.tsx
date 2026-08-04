'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScaleType } from '@/lib/musicTheory';
import type { BackingTrack } from '@/types';
import { routeMediaElementToSink, subscribeToAudioSinkChanges } from '@/lib/audioSink';
import AddScaleSongModal from './AddScaleSongModal';

const VOLUME_KEY = 'scaleSongsVolume';

/** Build a URL-safe /api/audio path (encode each segment). */
function audioUrl(audioPath: string): string {
  return `/api/audio/${audioPath.split('/').map(encodeURIComponent).join('/')}`;
}

interface ScaleSongsPanelProps {
  root: string;
  scaleType: ScaleType;
}

/**
 * Songs library for the fretboard's current Key + Scale. Reuses the BackingTrack
 * backend; plays one song at a time with a single persisted volume knob.
 */
export default function ScaleSongsPanel({ root, scaleType }: ScaleSongsPanelProps) {
  const [songs, setSongs] = useState<BackingTrack[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Restore persisted volume once.
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(VOLUME_KEY) : null;
    if (stored !== null) {
      const v = Number(stored);
      if (!Number.isNaN(v)) setVolume(Math.min(1, Math.max(0, v)));
    }
  }, []);

  // Apply + persist volume.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    if (typeof window !== 'undefined') localStorage.setItem(VOLUME_KEY, String(volume));
  }, [volume]);

  // Route audio to the app-selected output device.
  useEffect(() => {
    const el = audioRef.current;
    void routeMediaElementToSink(el);
    const unsub = subscribeToAudioSinkChanges(() => void routeMediaElementToSink(el));
    return unsub;
  }, []);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/backing-tracks');
      if (res.ok) setSongs(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => { void refetch(); }, [refetch]);

  const filtered = songs.filter((s) => s.rootNote === root && s.scaleType === scaleType);

  const togglePlay = (song: BackingTrack) => {
    const el = audioRef.current;
    if (!el || !song.audioPath) return;
    if (playingId === song.id) {
      if (el.paused) { void routeMediaElementToSink(el); void el.play(); }
      else el.pause();
      return;
    }
    el.src = audioUrl(song.audioPath);
    el.volume = volume;
    void routeMediaElementToSink(el);
    void el.play();
    setPlayingId(song.id);
  };

  const handleDelete = async (song: BackingTrack) => {
    if (!confirm(`Delete "${song.title}"?`)) return;
    try {
      const res = await fetch(`/api/backing-tracks/${song.id}`, { method: 'DELETE' });
      if (!res.ok) return; // leave playback + list untouched on failure
    } catch {
      return; // network error — leave UI as-is
    }
    if (playingId === song.id) { audioRef.current?.pause(); setPlayingId(null); }
    void refetch();
  };

  return (
    <div className="w-full lg:w-80 shrink-0 rounded-lg border border-amber-800/40 bg-amber-950/30 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-amber-100 text-sm font-semibold">
          Songs{scaleType !== 'None' ? ` — ${root} ${scaleType}` : ''}
        </h3>
        {scaleType !== 'None' && (
          <button
            onClick={() => setShowAdd(true)}
            className="text-xs px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white transition-colors"
          >
            + Add
          </button>
        )}
      </div>

      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setPlayingId(null); }}
      />

      {scaleType === 'None' ? (
        <p className="text-amber-200/50 text-xs">Select a scale to see songs.</p>
      ) : filtered.length === 0 ? (
        <p className="text-amber-200/50 text-xs">No songs yet for this scale/key.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {filtered.map((song) => {
            const isActive = playingId === song.id && playing;
            return (
              <li key={song.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-amber-900/20">
                <button
                  onClick={() => togglePlay(song)}
                  className="w-7 h-7 rounded-full bg-amber-600 hover:bg-amber-500 text-white text-xs flex items-center justify-center shrink-0"
                  aria-label={isActive ? 'Pause' : 'Play'}
                >
                  {isActive ? '❚❚' : '▶'}
                </button>
                <span className="flex-1 truncate text-sm text-amber-100" title={song.title}>{song.title}</span>
                <button
                  onClick={() => handleDelete(song)}
                  className="text-neutral-500 hover:text-rose-400 text-sm shrink-0"
                  aria-label={`Delete ${song.title}`}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {scaleType !== 'None' && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-neutral-400">🔊</span>
          <input
            type="range" min={0} max={1} step={0.01} value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="flex-1 accent-amber-500" aria-label="Volume"
          />
        </div>
      )}

      <AddScaleSongModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        initialRoot={root}
        initialScale={scaleType}
        onCreated={() => { setShowAdd(false); void refetch(); }}
      />
    </div>
  );
}
