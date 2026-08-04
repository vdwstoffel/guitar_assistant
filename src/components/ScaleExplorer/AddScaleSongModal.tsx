'use client';

import { useState } from 'react';
import { isValidYouTubeUrl } from '@/lib/youtube';
import { NOTES, SCALE_FORMULAS } from '@/lib/musicTheory';
import type { BackingTrack } from '@/types';
import { consumeDownloadStream, type DownloadProgressEvent } from '@/lib/downloadStream';
import DownloadProgress from './DownloadProgress';

interface AddScaleSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (track: BackingTrack) => void;
  /** Prefill (editable) from the fretboard's current selection. */
  initialRoot: string;
  initialScale: string;
}

export default function AddScaleSongModal({
  isOpen, onClose, onCreated, initialRoot, initialScale,
}: AddScaleSongModalProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [rootNote, setRootNote] = useState(initialRoot);
  const [scaleType, setScaleType] = useState(initialScale);
  const [needsTitle, setNeedsTitle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<DownloadProgressEvent | null>(null);

  if (!isOpen) return null;

  const scaleOptions = Object.keys(SCALE_FORMULAS).filter((s) => s !== 'None');

  const reset = () => {
    setUrl(''); setTitle(''); setRootNote(initialRoot); setScaleType(initialScale);
    setNeedsTitle(false); setError(null); setSubmitting(false); setProgress(null);
  };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isValidYouTubeUrl(url)) {
      setError('Please enter a valid YouTube URL.');
      return;
    }
    setSubmitting(true);
    setProgress({ percent: 0, phase: 'downloading' });
    try {
      const res = await fetch('/api/backing-tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, title: title.trim() || undefined, rootNote, scaleType }),
      });
      if (res.ok) {
        const track = await consumeDownloadStream(res, setProgress);
        onCreated(track);
        reset();
        onClose();
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) { setError(body.error ?? 'This song is already added.'); return; }
      if (res.status === 422 && body.needsTitle) {
        setNeedsTitle(true);
        setError('Could not fetch the video title. Please enter it below.');
        return;
      }
      setError(body.error ?? `Request failed (${res.status}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={handleClose}>
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-amber-100">Add Song</h2>
          <button onClick={handleClose} className="text-neutral-400 hover:text-white">×</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-neutral-300">YouTube URL</label>
            <input
              type="url" value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="px-3 py-2 rounded bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          {needsTitle && (
            <div className="flex flex-col gap-1">
              <label className="text-sm text-neutral-300">Title (required — auto-fetch failed)</label>
              <input
                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                className="px-3 py-2 rounded bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-sm text-neutral-300">Key</label>
              <select
                value={rootNote} onChange={(e) => setRootNote(e.target.value)}
                className="px-3 py-2 rounded bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:border-amber-500"
              >
                {NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex-[2] flex flex-col gap-1">
              <label className="text-sm text-neutral-300">Scale</label>
              <select
                value={scaleType} onChange={(e) => setScaleType(e.target.value)}
                className="px-3 py-2 rounded bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:border-amber-500"
              >
                {scaleOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {error && <div className="text-sm text-rose-400">{error}</div>}
          {submitting && <DownloadProgress progress={progress} />}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={handleClose} disabled={submitting}
              className="px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-700 text-white text-sm disabled:opacity-50">
              {submitting ? 'Downloading…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
