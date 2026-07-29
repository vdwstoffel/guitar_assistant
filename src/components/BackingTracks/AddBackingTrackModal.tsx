'use client';

import { useState } from 'react';
import { isValidYouTubeUrl } from '@/lib/youtube';
import { NOTES, SCALE_FORMULAS } from '@/lib/musicTheory';
import type { BackingTrack } from '@/types';

interface AddBackingTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (track: BackingTrack) => void;
  onOpenExisting?: (existingId: string) => void;
}

export default function AddBackingTrackModal({
  isOpen, onClose, onCreated, onOpenExisting,
}: AddBackingTrackModalProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [rootNote, setRootNote] = useState('A');
  const [scaleType, setScaleType] = useState('Minor Pentatonic');
  const [needsTitle, setNeedsTitle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const scaleOptions = Object.keys(SCALE_FORMULAS).filter((s) => s !== 'None');

  const reset = () => {
    setUrl(''); setTitle(''); setRootNote('A'); setScaleType('Minor Pentatonic');
    setNeedsTitle(false); setError(null); setExistingId(null); setSubmitting(false);
  };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setExistingId(null);

    if (!isValidYouTubeUrl(url)) {
      setError('Please enter a valid YouTube URL.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/backing-tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          title: title.trim() || undefined,
          rootNote,
          scaleType,
        }),
      });
      const body = await res.json();

      if (res.status === 201) {
        onCreated(body as BackingTrack);
        reset();
        onClose();
        return;
      }

      if (res.status === 409 && body.existingId) {
        setExistingId(body.existingId);
        setError(body.error ?? 'Already added.');
        return;
      }

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
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={handleClose}>
      <div
        className="bg-neutral-900 border border-neutral-700 rounded-lg p-6 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-amber-100">Add Backing Track</h2>
          <button onClick={handleClose} className="text-neutral-400 hover:text-white">×</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-neutral-300">YouTube URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="px-3 py-2 rounded bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          {needsTitle && (
            <div className="flex flex-col gap-1">
              <label className="text-sm text-neutral-300">Title (required — auto-fetch failed)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="px-3 py-2 rounded bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-sm text-neutral-300">Root</label>
              <select
                value={rootNote}
                onChange={(e) => setRootNote(e.target.value)}
                className="px-3 py-2 rounded bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:border-amber-500"
              >
                {NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex-[2] flex flex-col gap-1">
              <label className="text-sm text-neutral-300">Scale</label>
              <select
                value={scaleType}
                onChange={(e) => setScaleType(e.target.value)}
                className="px-3 py-2 rounded bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:border-amber-500"
              >
                {scaleOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <div className="text-sm text-rose-400">
              {error}
              {existingId && onOpenExisting && (
                <button
                  type="button"
                  className="ml-2 underline hover:text-rose-300"
                  onClick={() => { onOpenExisting(existingId); handleClose(); }}
                >
                  Open existing
                </button>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-700 text-white text-sm disabled:opacity-50"
            >
              {submitting ? 'Downloading audio…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
