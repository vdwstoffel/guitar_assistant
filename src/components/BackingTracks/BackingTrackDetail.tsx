'use client';

import { useEffect, useRef, useState } from 'react';
import type { BackingTrack } from '@/types';
import BackingTrackAudioPlayer from './BackingTrackAudioPlayer';
import BackingTrackFretboard from './BackingTrackFretboard';

interface BackingTrackDetailProps {
  track: BackingTrack;
  onBack: () => void;
  onUpdate: (patch: { title?: string; rootNote?: string; scaleType?: string }) => void;
  onDelete: () => void;
}

export default function BackingTrackDetail({ track, onBack, onUpdate, onDelete }: BackingTrackDetailProps) {
  const [rootNote, setRootNote] = useState(track.rootNote);
  const [scaleType, setScaleType] = useState(track.scaleType);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(track.title);
  const [audioPath, setAudioPath] = useState<string | null>(track.audioPath);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Sync local state if a different track becomes selected
  useEffect(() => {
    setRootNote(track.rootNote);
    setScaleType(track.scaleType);
    setTitleDraft(track.title);
    setAudioPath(track.audioPath);
    setDownloadError(null);
  }, [track.id, track.rootNote, track.scaleType, track.title, track.audioPath]);

  useEffect(() => {
    if (audioPath || downloading) return;
    let cancelled = false;
    setDownloading(true);
    setDownloadError(null);
    fetch(`/api/backing-tracks/${track.id}/download`, { method: 'POST' })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || `Download failed (${res.status})`);
        if (!cancelled) setAudioPath(body.audioPath as string);
      })
      .catch((err) => { if (!cancelled) setDownloadError(err instanceof Error ? err.message : 'Download failed'); })
      .finally(() => { if (!cancelled) setDownloading(false); });
    return () => { cancelled = true; };
  }, [audioPath, downloading, track.id]);

  // Debounced PATCH for scale changes
  const patchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (patchTimer.current) clearTimeout(patchTimer.current);
    };
  }, []);

  const schedulePatch = (patch: { rootNote?: string; scaleType?: string }) => {
    if (patchTimer.current) clearTimeout(patchTimer.current);
    patchTimer.current = setTimeout(() => onUpdate(patch), 300);
  };

  const handleRootChange = (r: string) => { setRootNote(r); schedulePatch({ rootNote: r }); };
  const handleScaleChange = (s: string) => { setScaleType(s); schedulePatch({ scaleType: s }); };

  const commitTitle = () => {
    const t = titleDraft.trim();
    if (t && t !== track.title) onUpdate({ title: t });
    setEditingTitle(false);
  };

  const handleDeleteClick = () => {
    if (confirm(`Delete "${track.title}"? This cannot be undone.`)) {
      onDelete();
    }
  };

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="w-full mx-auto">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="text-amber-300 hover:text-amber-200 text-sm">← Back</button>
          <button
            onClick={handleDeleteClick}
            className="px-3 py-1.5 rounded bg-rose-900/50 hover:bg-rose-800/50 text-rose-200 text-sm"
          >
            Delete
          </button>
        </div>

        {/* Title */}
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitleDraft(track.title); setEditingTitle(false); } }}
            className="text-2xl font-bold text-amber-100 bg-transparent border-b border-amber-600 focus:outline-none w-full mb-6 text-center"
          />
        ) : (
          <h1
            className="text-2xl font-bold text-amber-100 mb-6 cursor-pointer hover:text-amber-200 text-center"
            onClick={() => setEditingTitle(true)}
            title="Click to rename"
          >
            {track.title}
          </h1>
        )}

        {/* Fretboard on top (full-width, large), YouTube player below */}
        <div className="flex flex-col gap-8">
          <BackingTrackFretboard
            rootNote={rootNote}
            scaleType={scaleType}
            onRootChange={handleRootChange}
            onScaleChange={handleScaleChange}
          />
          <div className="w-full max-w-3xl mx-auto">
            {audioPath ? (
              <BackingTrackAudioPlayer audioPath={audioPath} title={track.title} />
            ) : downloadError ? (
              <div className="text-center text-sm text-rose-400 py-6">
                {downloadError}
                <button
                  className="ml-2 underline hover:text-rose-300"
                  onClick={() => { setDownloadError(null); }}
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="text-center text-sm text-amber-200/70 py-6">Downloading audio…</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
