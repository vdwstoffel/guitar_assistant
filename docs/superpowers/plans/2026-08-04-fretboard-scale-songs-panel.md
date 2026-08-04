# Fretboard Scale-Songs Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the standalone Backing Tracks page with a "Songs for this scale/key" panel on the Fretboard page, reusing the existing YouTube→audio download backend.

**Architecture:** Add a right-column `ScaleSongsPanel` below the fretboard (beside the existing tab strip) that filters the existing `BackingTrack` records by the fretboard's current Key + Scale, plays them with a minimal play/pause + persisted-volume player, and adds new songs via an adapted modal. The whole backend (`BackingTrack` model, `/api/backing-tracks` routes, `downloadBackingTrackAudio`, `/api/audio` streaming) is reused unchanged. The standalone Backing Tracks nav page and its UI are removed.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Prisma/SQLite, yt-dlp (in Docker).

## Global Constraints

- App runs a **production build in Docker with no hot reload**. After UI/code changes, restart to see them: `docker-compose restart nextjs-app`, then poll until `http://localhost:3000/fretboard` returns HTTP 200. The build can transiently fail fetching Google Fonts — if the container ends up `Exit 1`, just restart again.
- **Local type check only:** `npx tsc --noEmit` (filter/ignore `src/generated/prisma` noise). Cannot run `prisma generate` or `npm run build` locally.
- **Back up the DB before any data mutation:** `cp prisma/guitar_assistant.db prisma/guitar_assistant.db.backup`.
- Reuse the `BackingTrack` Prisma model as-is — **no schema migration**. UI copy says "Songs", not "Backing Tracks".
- File references use the amber theme classes already used across `ScaleExplorer`/Fretboard.
- Commit after each task.

---

### Task 1: Back up DB and wipe existing backing tracks (fresh start)

**Files:**
- Data only: `prisma/guitar_assistant.db`, `music/BackingTracks/`

- [ ] **Step 1: Back up the database**

```bash
cd /home/stoffel/Documents/guitar_assistant
cp prisma/guitar_assistant.db prisma/guitar_assistant.db.backup
```

- [ ] **Step 2: Confirm current backing-track rows (informational)**

```bash
sqlite3 prisma/guitar_assistant.db "SELECT count(*), group_concat(title, ' | ') FROM BackingTrack;"
```
Expected: prints the count + titles that will be deleted.

- [ ] **Step 3: Delete all backing-track rows**

```bash
sqlite3 prisma/guitar_assistant.db "DELETE FROM BackingTrack;"
sqlite3 prisma/guitar_assistant.db "SELECT count(*) FROM BackingTrack;"
```
Expected: second command prints `0`.

- [ ] **Step 4: Remove downloaded audio files**

```bash
rm -rf music/BackingTracks/*
ls music/BackingTracks 2>/dev/null || echo "dir empty or absent"
```

- [ ] **Step 5: Commit** (no source changes; record the intent)

```bash
git commit --allow-empty -m "chore(backing-tracks): wipe existing songs for fresh start (DB backed up)"
```

---

### Task 2: Add `DownloadProgress` + `AddScaleSongModal` under ScaleExplorer

Relocate the reusable progress indicator and create the add modal adapted to accept a prefilled-but-editable Key/Scale.

**Files:**
- Create: `src/components/ScaleExplorer/DownloadProgress.tsx`
- Create: `src/components/ScaleExplorer/AddScaleSongModal.tsx`

**Interfaces:**
- Consumes: `consumeDownloadStream` + `DownloadProgressEvent` from `@/lib/downloadStream`; `isValidYouTubeUrl` from `@/lib/youtube`; `NOTES`, `SCALE_FORMULAS` from `@/lib/musicTheory`; `BackingTrack` from `@/types`.
- Produces:
  - `DownloadProgress` — `({ progress: DownloadProgressEvent | null }) => JSX`
  - `AddScaleSongModal` — props `{ isOpen: boolean; onClose: () => void; onCreated: (track: BackingTrack) => void; initialRoot: string; initialScale: string }`

- [ ] **Step 1: Create `DownloadProgress.tsx`** (copy of the existing component, no logic change)

```tsx
'use client';

import type { DownloadProgressEvent } from '@/lib/downloadStream';

interface DownloadProgressProps {
  progress: DownloadProgressEvent | null;
}

/** Progress bar for a song audio download (percentage while downloading, pulse while converting). */
export default function DownloadProgress({ progress }: DownloadProgressProps) {
  const phase = progress?.phase ?? 'downloading';
  const percent = progress?.percent ?? null;
  const converting = phase === 'converting' || percent === null;

  const label = converting ? 'Converting audio…' : `Downloading audio… ${Math.round(percent!)}%`;

  return (
    <div className="w-full py-2">
      <div className="flex items-center justify-between mb-2 text-sm text-amber-200/80">
        <span>{label}</span>
        {!converting && <span className="font-mono text-amber-300">{Math.round(percent!)}%</span>}
      </div>
      <div className="h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
        {converting ? (
          <div className="h-full w-full bg-amber-500/70 animate-pulse" />
        ) : (
          <div
            className="h-full bg-amber-500 transition-[width] duration-200 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, percent!))}%` }}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `AddScaleSongModal.tsx`** (adapted from `AddBackingTrackModal`: prefilled editable root/scale, "Add Song" copy, no `onOpenExisting`)

```tsx
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
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -v generated/prisma | grep -iE "AddScaleSongModal|DownloadProgress" || echo clean`
Expected: `clean`

- [ ] **Step 4: Commit**

```bash
git add src/components/ScaleExplorer/DownloadProgress.tsx src/components/ScaleExplorer/AddScaleSongModal.tsx
git commit -m "feat(fretboard): add DownloadProgress + AddScaleSongModal for scale-songs panel"
```

---

### Task 3: Build `ScaleSongsPanel`

The right-column panel: filtered list, minimal play/pause player, one persisted volume knob, delete, and the Add modal.

**Files:**
- Create: `src/components/ScaleExplorer/ScaleSongsPanel.tsx`

**Interfaces:**
- Consumes: `BackingTrack` from `@/types`; `ScaleType` from `@/lib/musicTheory`; `routeMediaElementToSink`, `subscribeToAudioSinkChanges` from `@/lib/audioSink`; `AddScaleSongModal` (Task 2). Backend: `GET /api/backing-tracks` (returns `BackingTrack[]`), `DELETE /api/backing-tracks/[id]`, audio via `/api/audio/<audioPath>`.
- Produces: `ScaleSongsPanel` — props `{ root: string; scaleType: ScaleType }`.

- [ ] **Step 1: Create `ScaleSongsPanel.tsx`**

```tsx
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
      await fetch(`/api/backing-tracks/${song.id}`, { method: 'DELETE' });
    } catch {
      /* ignore */
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -v generated/prisma | grep -iE "ScaleSongsPanel" || echo clean`
Expected: `clean`

- [ ] **Step 3: Commit**

```bash
git add src/components/ScaleExplorer/ScaleSongsPanel.tsx
git commit -m "feat(fretboard): add ScaleSongsPanel (filtered list, play/pause, persisted volume, delete)"
```

---

### Task 4: Two-column layout on the Fretboard page

Put the existing tab strip and the new panel side by side below the board.

**Files:**
- Modify: `src/components/Fretboard.tsx` (the reference-tabs block near the end of the component)
- Modify: `src/components/ScaleExplorer/ScaleReferenceTabs.tsx` (drop its own `mt-6` so the wrapper owns spacing)
- Modify: `src/components/ScaleExplorer/index.ts` (export the new panel, optional convenience)

**Interfaces:**
- Consumes: `ScaleSongsPanel` (Task 3), `ScaleReferenceTabs` (existing).

- [ ] **Step 1: Export `ScaleSongsPanel` from the ScaleExplorer barrel**

In `src/components/ScaleExplorer/index.ts`, add:

```ts
export { default as ScaleSongsPanel } from './ScaleSongsPanel';
```

- [ ] **Step 2: Drop the leading `mt-6` from `ScaleReferenceTabs` root**

In `src/components/ScaleExplorer/ScaleReferenceTabs.tsx`, change:

```tsx
    <div className="mt-6 w-full text-left">
```
to:
```tsx
    <div className="w-full text-left">
```

- [ ] **Step 3: Import the panel in `Fretboard.tsx`**

In `src/components/Fretboard.tsx`, add `ScaleSongsPanel` to the existing `@/components/ScaleExplorer` import list (alongside `ScaleReferenceTabs`).

- [ ] **Step 4: Replace the reference-tabs render block with a two-column wrapper**

Find:
```tsx
        {/* Reference tabs: scale chords/progressions + interval meanings */}
        {!trainer.isRunning && (
          <ScaleReferenceTabs root={selectedKey} scaleType={selectedScale} />
        )}
```
Replace with:
```tsx
        {/* Reference tabs (left) + songs panel (right) */}
        {!trainer.isRunning && (
          <div className="mt-6 w-full flex flex-col lg:flex-row gap-4 items-start">
            <div className="flex-1 min-w-0">
              <ScaleReferenceTabs root={selectedKey} scaleType={selectedScale} />
            </div>
            <ScaleSongsPanel root={selectedKey} scaleType={selectedScale} />
          </div>
        )}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -v generated/prisma | grep -iE "Fretboard|ScaleReferenceTabs|ScaleSongsPanel" || echo clean`
Expected: `clean`

- [ ] **Step 6: Restart the container and verify it serves**

```bash
docker-compose restart nextjs-app >/dev/null 2>&1; sleep 8
for i in $(seq 1 40); do sleep 4; \
  if docker inspect -f '{{.State.Status}}' guitar_assistant_nextjs-app_1 | grep -q exited; then echo "EXITED"; docker-compose logs --tail=20 nextjs-app | grep -iE "google fonts|error"; break; fi; \
  if curl -sf -o /dev/null --max-time 5 http://localhost:3000/fretboard; then echo "READY"; break; fi; done
```
Expected: `READY`. (If `EXITED` due to Google Fonts, restart again.)

- [ ] **Step 7: Manual check**

On `/fretboard`: pick a Key + Scale → the **Songs** panel appears at the right of the tab strip showing "No songs yet for this scale/key"; set Scale to **None** → panel shows "Select a scale to see songs". The Practice Exercise tab still fits 4 bars.

- [ ] **Step 8: Commit**

```bash
git add src/components/Fretboard.tsx src/components/ScaleExplorer/ScaleReferenceTabs.tsx src/components/ScaleExplorer/index.ts
git commit -m "feat(fretboard): two-column layout with ScaleSongsPanel beside the tab strip"
```

---

### Task 5: Add a song end-to-end (verify the download pipeline in place)

No new code — this task verifies Tasks 2–4 wired the reused backend correctly. If it fails, fix the relevant earlier task.

- [ ] **Step 1: Add a song via the UI**

On `/fretboard` with a Key+Scale selected, click **+ Add**, confirm Key/Scale are prefilled (and editable), paste a real YouTube URL, submit. Expected: progress bar (downloading → converting), then the modal closes and the song appears in the list.

- [ ] **Step 2: Play, volume, persistence, delete**

Click ▶ (audio plays; ❚❚ shows), adjust the volume knob, reload the page → volume knob restores to the set value. Change Key/Scale away and back → the song still shows under its scale/key. Click ✕ → confirm → the song disappears.

- [ ] **Step 3: Confirm DB row + file exist for a kept song**

```bash
sqlite3 prisma/guitar_assistant.db "SELECT title, rootNote, scaleType, audioPath FROM BackingTrack;"
ls -la music/BackingTracks/
```
Expected: a row + a folder with an `.mp3`.

- [ ] **Step 4: Commit** (empty — checkpoint)

```bash
git commit --allow-empty -m "test(fretboard): verified scale-songs add/play/delete end-to-end"
```

---

### Task 6: Remove the standalone Backing Tracks page

Now that the panel works, delete the old nav page and its UI. Keep all backend (`/api/backing-tracks`, libs, model).

**Files:**
- Modify: `src/components/TopNav.tsx` (remove the Backing Tracks `Link` + `'backing-tracks'` from the `Section` type)
- Modify: `src/app/[[...section]]/page.tsx` (remove `BackingTracksView` import, `'backing-tracks'` from Section type + `getSectionFromPath`, and the render branch)
- Delete: `src/components/BackingTracks/` (entire folder — `BackingTracksView`, `BackingTrackList`, `BackingTrackDetail`, `BackingTrackFretboard`, `BackingTrackAudioPlayer`, `AddBackingTrackModal`, `DownloadProgress`)

- [ ] **Step 1: Remove the Backing Tracks nav Link in `TopNav.tsx`**

Delete the entire `<Link href="/api/backing-tracks" ...>...Backing Tracks...</Link>` block (the nav item with the speaker icon). Also remove `'backing-tracks'` from the `Section` type union at the top of the file.

- [ ] **Step 2: Remove router wiring in `page.tsx`**

Delete `import BackingTracksView from "@/components/BackingTracks/BackingTracksView";` (verify exact path first with grep). Remove `'backing-tracks'` from the `Section` type and from the `getSectionFromPath` condition. Delete the render branch:
```tsx
      ) : activeSection === 'backing-tracks' ? (
        <BackingTracksView />
```

- [ ] **Step 3: Delete the components folder**

```bash
rm -rf src/components/BackingTracks
```

- [ ] **Step 4: Verify no dangling references**

Run:
```bash
grep -rnE "BackingTracksView|BackingTrackList|BackingTrackDetail|BackingTrackFretboard|BackingTrackAudioPlayer|AddBackingTrackModal|components/BackingTracks|'backing-tracks'|/api/backing-tracks\"" src/ | grep -vE "src/app/api/backing-tracks/"
```
Expected: no output. (The `/api/backing-tracks` **route files** and the panel/modal's `fetch('/api/backing-tracks')` calls must remain.)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -v generated/prisma | grep "error TS" | grep -iE "page.tsx|TopNav|BackingTrack" || echo clean`
Expected: `clean`

- [ ] **Step 6: Restart + verify**

```bash
docker-compose restart nextjs-app >/dev/null 2>&1; sleep 8
for i in $(seq 1 40); do sleep 4; \
  if curl -sf -o /dev/null --max-time 5 http://localhost:3000/fretboard; then echo "READY"; break; fi; done
```
Expected: `READY`. Manually confirm the **Backing Tracks** item is gone from the navbar and the Songs panel still works.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove standalone Backing Tracks page (superseded by Fretboard songs panel)"
```

---

### Task 7: Final verification pass

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit 2>&1 | grep -v generated/prisma | grep "error TS" | head -20 || echo "no type errors"`
Expected: `no type errors`.

- [ ] **Step 2: Final manual checklist**
  - Navbar has no "Backing Tracks" item.
  - Fretboard: Songs panel filters by Key/Scale; Add downloads + lists; play/pause works; volume persists across reload; delete works; None scale shows hint.
  - Practice Exercise tab still renders 4 bars on one line.

- [ ] **Step 3: Update docs** — in `README.md`, if there's a Backing Tracks section, revise it to describe the Fretboard "Songs for this scale/key" panel. Commit any change:

```bash
git add README.md && git commit -m "docs: describe Fretboard songs panel" || echo "no README change"
```

---

## Self-Review

- **Spec coverage:** Layout two-column ✅(T4); ScaleSongsPanel list/filter/play-pause/persisted-volume/delete/None-hint ✅(T3); Add modal prefilled-editable ✅(T2); reuse backend/model no-migration ✅(constraints, T3/T2); remove standalone page ✅(T6); wipe data fresh start ✅(T1); error handling (invalid URL, 409, 422, network) ✅(T2 modal). All spec sections mapped.
- **Placeholder scan:** No TBD/TODO; all code blocks are concrete; removal steps name exact files/strings.
- **Type consistency:** `AddScaleSongModal` props (`initialRoot`, `initialScale`, `onCreated`) match `ScaleSongsPanel` usage; `DownloadProgress` prop `progress` matches; `ScaleSongsPanel` props (`root`, `scaleType: ScaleType`) match the `Fretboard` call site; `consumeDownloadStream`/`DownloadProgressEvent`/`BackingTrack` used with their real signatures from the reused libs.
