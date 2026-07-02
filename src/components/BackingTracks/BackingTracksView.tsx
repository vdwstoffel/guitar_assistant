'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BackingTrack } from '@/types';
import BackingTrackList from './BackingTrackList';
import BackingTrackDetail from './BackingTrackDetail';
import AddBackingTrackModal from './AddBackingTrackModal';

export default function BackingTracksView() {
  const [tracks, setTracks] = useState<BackingTrack[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/backing-tracks');
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data: BackingTrack[] = await res.json();
      setTracks(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const selected = selectedId ? tracks.find((t) => t.id === selectedId) ?? null : null;

  const handleCreated = (t: BackingTrack) => {
    setTracks((prev) => [t, ...prev]);
    setSelectedId(t.id);
  };

  const handleUpdate = async (id: string, patch: { title?: string; rootNote?: string; scaleType?: string }) => {
    const res = await fetch(`/api/backing-tracks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      console.error('PATCH failed', await res.text());
      return;
    }
    const updated: BackingTrack = await res.json();
    setTracks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/backing-tracks/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      console.error('DELETE failed', await res.text());
      return;
    }
    setTracks((prev) => prev.filter((t) => t.id !== id));
    setSelectedId(null);
  };

  return (
    <>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-neutral-400">Loading…</div>
      ) : loadError ? (
        <div className="flex-1 flex items-center justify-center text-rose-400">{loadError}</div>
      ) : selected ? (
        <BackingTrackDetail
          track={selected}
          onBack={() => setSelectedId(null)}
          onUpdate={(patch) => handleUpdate(selected.id, patch)}
          onDelete={() => handleDelete(selected.id)}
        />
      ) : (
        <BackingTrackList
          tracks={tracks}
          onSelect={setSelectedId}
          onAddClick={() => setIsAddOpen(true)}
        />
      )}

      <AddBackingTrackModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onCreated={handleCreated}
        onOpenExisting={(id) => setSelectedId(id)}
      />
    </>
  );
}
