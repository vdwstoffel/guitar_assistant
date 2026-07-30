# Backing Tracks Audio Download — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace embedded YouTube video in backing tracks with downloaded audio that plays through the app-selected output device.

**Architecture:** A YouTube link is a source only. New tracks download audio (mp3 via yt-dlp) at add-time; pre-existing video-only rows are backfilled on first open. Audio is served by the existing `/api/audio/[...path]` route and played by a new inline `<audio>`-based player that routes to the selected device via `routeMediaElementToSink`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma + SQLite, yt-dlp + music-metadata (server), Tailwind 4.

## Global Constraints

- **DB safety:** back up `prisma/guitar_assistant.db` before any schema change (`cp prisma/guitar_assistant.db prisma/guitar_assistant.db.backup`).
- **Deployment:** app runs a production build in Docker with **no hot reload**. After any change, `docker-compose restart nextjs-app` re-runs the entrypoint (`prisma generate` → `prisma db push` → `npm run build` → `npm start`). Schema changes apply via `prisma db push` on that restart — no migration files.
- **Local build limits:** `src/generated/prisma/` and `.next/` are root-owned; do **not** run `npx prisma generate` or `npm run build` locally. Use `npx tsc --noEmit` for type checking and **ignore Prisma-client type errors** that only resolve after the container regenerates the client.
- **yt-dlp only exists in the container** — API download tests must run against the running container (`http://localhost:3000`), not a local `npm run dev`.
- yt-dlp flags for audio: `-x --audio-format mp3 --audio-quality 0 -o <outputPath> --no-playlist <url>`, 120s timeout, invoked via `execFile` (never a shell string).
- Storage convention: `music/BackingTracks/<sanitized title>/<sanitized title>.mp3` (relative path stored in DB).

---

### Task 1: Schema + type fields

**Files:**
- Modify: `prisma/schema.prisma` (BackingTrack model, lines ~238-248)
- Modify: `src/types/index.ts:224-234` (BackingTrack interface)

**Interfaces:**
- Produces: `BackingTrack.audioPath: string | null`, `BackingTrack.duration: number | null` (Prisma model + TS interface).

- [ ] **Step 1: Back up the database**

```bash
cp prisma/guitar_assistant.db prisma/guitar_assistant.db.backup
```

- [ ] **Step 2: Add nullable fields to the Prisma model**

In `prisma/schema.prisma`, inside `model BackingTrack`, add after `thumbnailUrl String?`:

```prisma
  audioPath    String?
  duration     Float?
```

- [ ] **Step 3: Add the fields to the TypeScript interface**

In `src/types/index.ts`, inside `export interface BackingTrack`, add after `thumbnailUrl: string | null;`:

```ts
  audioPath: string | null;
  duration: number | null;
```

- [ ] **Step 4: Apply the schema and regenerate the client (in Docker)**

```bash
docker-compose restart nextjs-app
```

Wait for readiness, then verify the columns exist:

```bash
for i in $(seq 1 40); do curl -sf -o /dev/null http://localhost:3000 && break; sleep 5; done
sqlite3 prisma/guitar_assistant.db "PRAGMA table_info(BackingTrack);" | grep -E "audioPath|duration"
```
Expected: two rows, `audioPath|TEXT` and `duration|REAL` (nullable, no NOT NULL).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -iE "types/index|schema" | grep -v "generated/prisma"`
Expected: no output (Prisma-client errors that reference `src/generated/prisma` are expected until the container regenerated in Step 4; ignore those).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/types/index.ts
git commit -m "feat(backing-tracks): add audioPath and duration fields"
```

---

### Task 2: Shared audio-download helper

**Files:**
- Create: `src/lib/backingTrackAudio.ts`

**Interfaces:**
- Produces:
  - `export const BACKING_TRACKS_FOLDER = "BackingTracks"`
  - `export function sanitizeName(name: string): string`
  - `export interface DownloadedAudio { audioPath: string; duration: number }`
  - `export async function downloadBackingTrackAudio(youtubeUrl: string, title: string): Promise<DownloadedAudio>` — downloads to `music/BackingTracks/<title>/<title>.mp3`, parses duration, cleans up the folder and re-throws an `Error & { stderr?: string }` on failure. `audioPath` is the path relative to `MUSIC_DIR`.
  - `export function backingTrackAudioDir(audioPath: string): string` — absolute directory of a stored `audioPath`, for deletion.

- [ ] **Step 1: Write the helper**

Create `src/lib/backingTrackAudio.ts`:

```ts
import * as fs from "fs/promises";
import * as path from "path";
import * as mm from "music-metadata";
import { execFile } from "child_process";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
export const BACKING_TRACKS_FOLDER = "BackingTracks";
const DOWNLOAD_TIMEOUT_MS = 120_000;

export function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}

export interface DownloadedAudio {
  audioPath: string;
  duration: number;
}

function execFilePromise(
  command: string,
  args: string[],
  options: { timeout?: number } = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: options.timeout, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const enriched = error as Error & { stderr?: string };
          enriched.stderr = stderr;
          reject(enriched);
        } else {
          resolve({ stdout, stderr });
        }
      },
    );
  });
}

/** Extract a human-readable yt-dlp error line from stderr, else fall back. */
function extractYtDlpError(stderr: string, fallback: string): string {
  const lines = stderr.split("\n").filter((l) => l.startsWith("ERROR:"));
  if (lines.length > 0) return lines[lines.length - 1].replace("ERROR: ", "");
  return stderr.trim().split("\n").filter(Boolean).pop() || fallback;
}

/**
 * Download a YouTube URL's audio as mp3 into music/BackingTracks/<title>/,
 * returning the relative path and parsed duration. Cleans up the folder and
 * re-throws on failure.
 */
export async function downloadBackingTrackAudio(
  youtubeUrl: string,
  title: string,
): Promise<DownloadedAudio> {
  const musicPath = path.resolve(MUSIC_DIR);
  const folderName = sanitizeName(title);
  const trackFolder = path.join(musicPath, BACKING_TRACKS_FOLDER, folderName);
  await fs.mkdir(trackFolder, { recursive: true });

  const fileName = `${sanitizeName(title)}.mp3`;
  const outputPath = path.join(trackFolder, fileName);
  const audioPath = path.join(BACKING_TRACKS_FOLDER, folderName, fileName);

  try {
    await execFilePromise(
      "yt-dlp",
      [
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "-o", outputPath,
        "--no-playlist",
        youtubeUrl,
      ],
      { timeout: DOWNLOAD_TIMEOUT_MS },
    );
    await fs.access(outputPath);
  } catch (err) {
    try {
      await fs.rm(trackFolder, { recursive: true });
    } catch {
      // ignore cleanup errors
    }
    const e = err as Error & { stderr?: string };
    const detail = extractYtDlpError(e.stderr || "", e.message || "download failed");
    const wrapped = new Error(`yt-dlp failed: ${detail}`) as Error & { stderr?: string };
    wrapped.stderr = e.stderr;
    throw wrapped;
  }

  let duration = 0;
  try {
    const metadata = await mm.parseFile(outputPath);
    duration = metadata.format.duration || 0;
  } catch (err) {
    console.error("Error parsing backing-track audio metadata:", err);
  }

  return { audioPath, duration };
}

/** Absolute directory containing a stored audioPath (for deletion). */
export function backingTrackAudioDir(audioPath: string): string {
  return path.dirname(path.resolve(MUSIC_DIR, audioPath));
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep "backingTrackAudio"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/backingTrackAudio.ts
git commit -m "feat(backing-tracks): add shared yt-dlp audio download helper"
```

---

### Task 3: Add-time download in POST + backfill endpoint + delete cleanup

**Files:**
- Modify: `src/app/api/backing-tracks/route.ts` (POST — download before create)
- Create: `src/app/api/backing-tracks/[id]/download/route.ts` (backfill)
- Modify: `src/app/api/backing-tracks/[id]/route.ts` (DELETE — remove audio folder)

**Interfaces:**
- Consumes: `downloadBackingTrackAudio`, `backingTrackAudioDir` from `src/lib/backingTrackAudio.ts` (Task 2); `BackingTrack.audioPath/duration` (Task 1).
- Produces: `POST /api/backing-tracks` returns a `BackingTrack` with `audioPath`/`duration` set (201) or a yt-dlp error (422); `POST /api/backing-tracks/[id]/download` returns the updated `BackingTrack` (200) or 404/422.

- [ ] **Step 1: Download audio in POST before creating the record**

In `src/app/api/backing-tracks/route.ts`, add the import at the top:

```ts
import { downloadBackingTrackAudio } from "@/lib/backingTrackAudio";
```

Replace the `try { const created = await prisma.backingTrack.create({...}) ... }` block (currently lines ~106-127) with:

```ts
  let audioPath: string;
  let duration: number;
  try {
    ({ audioPath, duration } = await downloadBackingTrackAudio(url, title));
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Download failed";
    return NextResponse.json({ error: detail }, { status: 422 });
  }

  try {
    const created = await prisma.backingTrack.create({
      data: {
        youtubeUrl: url,
        videoId,
        title,
        thumbnailUrl: thumbnailUrl(videoId),
        rootNote,
        scaleType,
        audioPath,
        duration,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const dup = await prisma.backingTrack.findUnique({ where: { youtubeUrl: url } });
      return NextResponse.json(
        { error: "A backing track with this URL already exists.", existingId: dup?.id },
        { status: 409 }
      );
    }
    throw err;
  }
```

- [ ] **Step 2: Create the backfill endpoint**

Create `src/app/api/backing-tracks/[id]/download/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { downloadBackingTrackAudio } from "@/lib/backingTrackAudio";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const track = await prisma.backingTrack.findUnique({ where: { id } });
  if (!track) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Idempotent: if audio already exists on disk, return as-is.
  if (track.audioPath) {
    try {
      await fs.access(path.resolve(MUSIC_DIR, track.audioPath));
      return NextResponse.json(track);
    } catch {
      // file missing — fall through and re-download
    }
  }

  let audioPath: string;
  let duration: number;
  try {
    ({ audioPath, duration } = await downloadBackingTrackAudio(track.youtubeUrl, track.title));
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Download failed";
    return NextResponse.json({ error: detail }, { status: 422 });
  }

  const updated = await prisma.backingTrack.update({
    where: { id },
    data: { audioPath, duration },
  });
  return NextResponse.json(updated);
}
```

- [ ] **Step 3: Remove audio folder on delete**

In `src/app/api/backing-tracks/[id]/route.ts`, add imports at the top:

```ts
import * as fs from "fs/promises";
import { backingTrackAudioDir } from "@/lib/backingTrackAudio";
```

Replace the `DELETE` body's delete section so the folder is removed before the DB row:

```ts
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.backingTrack.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.audioPath) {
    try {
      await fs.rm(backingTrackAudioDir(existing.audioPath), { recursive: true, force: true });
    } catch {
      // best-effort; ignore fs errors
    }
  }

  await prisma.backingTrack.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -iE "backing-tracks" | grep -v "generated/prisma"`
Expected: no output.

- [ ] **Step 5: Restart container and verify the API end-to-end**

```bash
docker-compose restart nextjs-app
for i in $(seq 1 40); do curl -sf -o /dev/null http://localhost:3000 && break; sleep 5; done
```

Add a real track (use a short YouTube clip) and confirm audio is downloaded and stored:

```bash
curl -s -X POST http://localhost:3000/api/backing-tracks \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.youtube.com/watch?v=<SHORT_ID>","rootNote":"A","scaleType":"Minor Pentatonic"}' | tee /tmp/bt.json
```
Expected: HTTP 201 JSON with non-null `audioPath` (e.g. `BackingTracks/<title>/<title>.mp3`) and a numeric `duration`. Verify the file streams:

```bash
AP=$(python3 -c "import json,urllib.parse;p=json.load(open('/tmp/bt.json'))['audioPath'];print('/'.join(urllib.parse.quote(s) for s in p.split('/')))")
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "http://localhost:3000/api/audio/$AP"
```
Expected: `200 audio/mpeg`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/backing-tracks/route.ts "src/app/api/backing-tracks/[id]/download/route.ts" "src/app/api/backing-tracks/[id]/route.ts"
git commit -m "feat(backing-tracks): download audio at add-time, add backfill + delete cleanup"
```

---

### Task 4: Inline audio player component

**Files:**
- Create: `src/components/BackingTracks/BackingTrackAudioPlayer.tsx`

**Interfaces:**
- Consumes: `routeMediaElementToSink`, `subscribeToAudioSinkChanges` from `src/lib/audioSink.ts`.
- Produces: `export default function BackingTrackAudioPlayer({ audioPath, title }: { audioPath: string; title?: string })`.

- [ ] **Step 1: Write the player**

Create `src/components/BackingTracks/BackingTrackAudioPlayer.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { routeMediaElementToSink, subscribeToAudioSinkChanges } from '@/lib/audioSink';

interface BackingTrackAudioPlayerProps {
  audioPath: string;
  title?: string;
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Build a URL-safe /api/audio path (encode each segment). */
function audioUrl(audioPath: string): string {
  return `/api/audio/${audioPath.split('/').map(encodeURIComponent).join('/')}`;
}

export default function BackingTrackAudioPlayer({ audioPath, title }: BackingTrackAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [looping, setLooping] = useState(false);
  const [volume, setVolume] = useState(1);

  // Route audio to the app-selected output device, and re-route when it changes.
  useEffect(() => {
    const el = audioRef.current;
    void routeMediaElementToSink(el);
    const unsub = subscribeToAudioSinkChanges(() => void routeMediaElementToSink(el));
    return unsub;
  }, [audioPath]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void routeMediaElementToSink(el);
      void el.play();
    } else {
      el.pause();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el) return;
    const t = Number(e.target.value);
    el.currentTime = t;
    setCurrent(t);
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  return (
    <div className="w-full rounded-lg bg-neutral-900/70 border border-neutral-700 p-4 flex flex-col gap-3">
      <audio
        ref={audioRef}
        src={audioUrl(audioPath)}
        loop={looping}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          void routeMediaElementToSink(e.currentTarget);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        preload="metadata"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center shrink-0"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? '❚❚' : '▶'}
        </button>

        <span className="text-xs text-amber-200/70 font-mono w-12 text-right">{formatTime(current)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          onChange={handleSeek}
          className="flex-1 accent-amber-500"
          aria-label="Seek"
        />
        <span className="text-xs text-amber-200/70 font-mono w-12">{formatTime(duration)}</span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => setLooping((l) => !l)}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            looping ? 'bg-amber-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
          }`}
          aria-pressed={looping}
        >
          🔁 Loop
        </button>

        <div className="flex items-center gap-2 flex-1 max-w-[160px]">
          <span className="text-xs text-neutral-400">🔊</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolume}
            className="flex-1 accent-amber-500"
            aria-label="Volume"
          />
        </div>

        {title && <span className="ml-auto text-xs text-neutral-500 truncate">{title}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep "BackingTrackAudioPlayer"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/BackingTracks/BackingTrackAudioPlayer.tsx
git commit -m "feat(backing-tracks): add inline audio player with loop + device routing"
```

---

### Task 5: Wire player into detail view + downloading UX in add modal

**Files:**
- Modify: `src/components/BackingTracks/BackingTrackDetail.tsx` (replace embed with player + backfill)
- Modify: `src/components/BackingTracks/AddBackingTrackModal.tsx` (downloading state copy)

**Interfaces:**
- Consumes: `BackingTrackAudioPlayer` (Task 4); `POST /api/backing-tracks/[id]/download` (Task 3); `BackingTrack.audioPath` (Task 1).

- [ ] **Step 1: Replace the embed with the player + lazy backfill in the detail view**

In `src/components/BackingTracks/BackingTrackDetail.tsx`:

Remove the import `import YouTubeEmbed from './YouTubeEmbed';` and add:

```tsx
import BackingTrackAudioPlayer from './BackingTrackAudioPlayer';
```

Add local state for the resolved audio path + backfill, after the existing `useState` declarations (near line 19):

```tsx
  const [audioPath, setAudioPath] = useState<string | null>(track.audioPath);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
```

In the existing "Sync local state" effect (the `useEffect` at ~line 22), also reset the audio state when the track changes — change its body to:

```tsx
  useEffect(() => {
    setRootNote(track.rootNote);
    setScaleType(track.scaleType);
    setTitleDraft(track.title);
    setAudioPath(track.audioPath);
    setDownloadError(null);
  }, [track.id, track.rootNote, track.scaleType, track.title, track.audioPath]);
```

Add a backfill effect (after that effect):

```tsx
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
```

Replace the embed block (currently the `<div className="w-full max-w-3xl mx-auto"><YouTubeEmbed .../></div>`, ~lines 99-101) with:

```tsx
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
```

- [ ] **Step 2: Update the add-modal submit copy to reflect the download wait**

In `src/components/BackingTracks/AddBackingTrackModal.tsx`, change the submit button label (the `{submitting ? 'Adding…' : 'Add'}` expression) to:

```tsx
              {submitting ? 'Downloading audio…' : 'Add'}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -iE "BackingTrackDetail|AddBackingTrackModal"`
Expected: no output.

- [ ] **Step 4: Restart container and verify in the browser**

```bash
docker-compose restart nextjs-app
for i in $(seq 1 40); do curl -sf -o /dev/null http://localhost:3000 && break; sleep 5; done
```

Manual checks (Backing Tracks section):
- Add a new track → button shows "Downloading audio…", then the track opens with the audio player (no video).
- Open a pre-existing (video-only) track → shows "Downloading audio…" then the player appears; reopening is instant.
- Play/pause, seek, loop toggle, and volume all work.
- **The actual bug:** with a non-default output device selected in the app, backing-track audio plays through the selected device (not the OS default).
- Delete a track → its folder under `music/BackingTracks/<title>/` is removed.

- [ ] **Step 5: Commit**

```bash
git add src/components/BackingTracks/BackingTrackDetail.tsx src/components/BackingTracks/AddBackingTrackModal.tsx
git commit -m "feat(backing-tracks): play downloaded audio in detail view, drop video embed"
```

---

## Self-Review

**Spec coverage:**
- Nullable `audioPath`/`duration` + type update → Task 1. ✓
- Storage convention + shared yt-dlp helper → Task 2. ✓
- Add-time download (new tracks) → Task 3 Step 1. ✓
- Backfill endpoint (existing tracks) → Task 3 Step 2. ✓
- Delete removes audio folder → Task 3 Step 3. ✓
- Streaming reuses `/api/audio/[...path]` → verified in Task 3 Step 5 (no new code). ✓
- Inline player: play/pause, seek, time, loop, volume, `routeMediaElementToSink` → Task 4. ✓
- Detail view renders player + backfill state; add-modal downloading UX → Task 5. ✓
- `YouTubeEmbed` retained but unused here → Task 5 Step 1 removes only the import. ✓

**Placeholder scan:** none — every step has concrete code/commands. `<SHORT_ID>` in Task 3 Step 5 is an intentional user-supplied test input, not a code placeholder.

**Type consistency:** `downloadBackingTrackAudio(youtubeUrl, title) → { audioPath, duration }` used identically in Task 3 POST and backfill; `backingTrackAudioDir(audioPath)` used in DELETE; `BackingTrackAudioPlayer({ audioPath, title })` matches Task 5 usage; `audioPath`/`duration` field names consistent across schema, type, routes, and component.

**Note on TDD:** this repo has no unit-test runner, so each task's "test cycle" is `npx tsc --noEmit` + container restart + real `curl`/manual verification against `http://localhost:3000`, which is the codebase's actual verification path.
