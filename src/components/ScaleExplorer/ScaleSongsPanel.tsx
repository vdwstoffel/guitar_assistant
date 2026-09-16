'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScaleType } from '@/lib/musicTheory';
import type { BackingTrack } from '@/types';
import { routeMediaElementToSink, subscribeToAudioSinkChanges } from '@/lib/audioSink';
import { applySavedVolume, clampTrackVolume, resolveBackingTrackVolume } from '@/lib/trackVolume';
import { visibleScaleSongs } from '@/lib/scaleSongs';
import { DEFAULT_VOLUME, elementToStoredVolume, storedToElementVolume } from '@/lib/video/volume';
import AddScaleSongModal from './AddScaleSongModal';

// Pre-per-song key: one shared 0-1 float for every song. Still read, so songs
// added before this have a sensible level, and still written as the level used
// when nothing is playing.
const FALLBACK_VOLUME_KEY = 'scaleSongsVolume';

/** Read the shared fallback level (stored 0-1) as a 0-100 percentage. */
function readFallbackVolume(): number {
  if (typeof window === 'undefined') return DEFAULT_VOLUME;
  const stored = localStorage.getItem(FALLBACK_VOLUME_KEY);
  if (stored === null) return DEFAULT_VOLUME;
  const asFloat = Number(stored);
  if (Number.isNaN(asFloat)) return DEFAULT_VOLUME;
  return elementToStoredVolume(asFloat);
}

/** Build a URL-safe /api/audio path (encode each segment). */
function audioUrl(audioPath: string): string {
  return `/api/audio/${audioPath.split('/').map(encodeURIComponent).join('/')}`;
}

interface ScaleSongsPanelProps {
  root: string;
  scaleType: ScaleType;
  /** Jump the fretboard to a song's own key + scale. */
  onSelectScale?: (root: string, scaleType: ScaleType) => void;
}

/**
 * Songs library for the fretboard's current Key + Scale. Reuses the BackingTrack
 * backend; plays one song at a time. Each song keeps its own volume in the
 * database — they come from YouTube, so their baked-in loudness varies wildly
 * and one shared level cannot suit all of them. The slider edits whichever song
 * is loaded, or the fallback level when none is.
 */
export default function ScaleSongsPanel({ root, scaleType, onSelectScale }: ScaleSongsPanelProps) {
  const [songs, setSongs] = useState<BackingTrack[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  // Volumes here are whole percentages (0-100), like every other volume in the
  // app; the audio element takes 0-1 so conversion happens at the boundary.
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [fallbackVolume, setFallbackVolume] = useState(DEFAULT_VOLUME);
  const audioRef = useRef<HTMLAudioElement>(null);
  const saveVolumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore the shared fallback once; nothing is playing yet, so show it.
  useEffect(() => {
    const restored = readFallbackVolume();
    setFallbackVolume(restored);
    setVolume(restored);
  }, []);

  useEffect(() => () => {
    if (saveVolumeTimeoutRef.current) clearTimeout(saveVolumeTimeoutRef.current);
  }, []);

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

  // With no scale selected this lists the whole library, so a song can be used
  // to get to its scale.
  const showingAll = scaleType === 'None';
  const visible = visibleScaleSongs(songs, root, scaleType);
  const activeSong = songs.find((s) => s.id === playingId) ?? null;

  // Edit the loaded song's own volume, or the shared fallback when none is
  // loaded. Saving is debounced because dragging fires continuously.
  const handleVolume = (next: number) => {
    const clamped = clampTrackVolume(next);
    setVolume(clamped);
    if (audioRef.current) audioRef.current.volume = storedToElementVolume(clamped);

    if (!playingId) {
      setFallbackVolume(clamped);
      localStorage.setItem(FALLBACK_VOLUME_KEY, String(storedToElementVolume(clamped)));
      return;
    }

    // Keep the in-memory song in step so re-playing it restores this level
    // rather than the one the last fetch returned.
    setSongs((prev) => applySavedVolume(prev, playingId, clamped));
    if (saveVolumeTimeoutRef.current) clearTimeout(saveVolumeTimeoutRef.current);
    const songId = playingId;
    saveVolumeTimeoutRef.current = setTimeout(() => {
      fetch(`/api/backing-tracks/${songId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume: clamped }),
      }).catch((err) => console.error('Failed to save backing track volume:', err));
    }, 500);
  };

  const togglePlay = (song: BackingTrack) => {
    const el = audioRef.current;
    if (!el || !song.audioPath) return;
    if (playingId === song.id) {
      if (el.paused) { void routeMediaElementToSink(el); void el.play(); }
      else el.pause();
      return;
    }
    // Switch to this song's own level.
    const songVolume = resolveBackingTrackVolume(song.volume, fallbackVolume);
    setVolume(songVolume);
    el.src = audioUrl(song.audioPath);
    el.volume = storedToElementVolume(songVolume);
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
    if (playingId === song.id) { audioRef.current?.pause(); setPlayingId(null); setVolume(fallbackVolume); }
    void refetch();
  };

  return (
    <div className="w-full lg:w-80 shrink-0 rounded-lg border border-amber-800/40 bg-amber-950/30 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-amber-100 text-sm font-semibold">
          Songs{showingAll ? ' — all' : ` — ${root} ${scaleType}`}
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
        onEnded={() => { setPlaying(false); setPlayingId(null); setVolume(fallbackVolume); }}
      />

      {visible.length === 0 ? (
        <p className="text-amber-200/50 text-xs">
          {showingAll ? 'No songs yet. Pick a scale to add one.' : 'No songs yet for this scale/key.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {visible.map((song) => {
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
                <button
                  onClick={() => onSelectScale?.(song.rootNote, song.scaleType as ScaleType)}
                  disabled={!onSelectScale}
                  className="flex-1 min-w-0 text-left enabled:hover:text-amber-300 transition-colors disabled:cursor-default"
                  title={
                    onSelectScale
                      ? `${song.title} — show ${song.rootNote} ${song.scaleType} on the fretboard`
                      : song.title
                  }
                >
                  <span className="block truncate text-sm text-amber-100">{song.title}</span>
                  {showingAll && (
                    <span className="block truncate text-[11px] text-amber-200/45">
                      {song.rootNote} {song.scaleType}
                    </span>
                  )}
                </button>
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

      {visible.length > 0 && (
        <div className="mt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">🔊</span>
            <input
              type="range" min={0} max={100} step={1} value={volume}
              onChange={(e) => handleVolume(Number(e.target.value))}
              className="flex-1 accent-amber-500"
              aria-label={activeSong ? `Volume for ${activeSong.title}` : 'Default volume for new songs'}
            />
            <span className="text-xs text-neutral-400 w-8 text-right tabular-nums">{volume}</span>
          </div>
          <p className="text-[11px] text-amber-200/40 mt-1 truncate">
            {activeSong ? `Saved for ${activeSong.title}` : 'Default — play a song to set its own level'}
          </p>
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
