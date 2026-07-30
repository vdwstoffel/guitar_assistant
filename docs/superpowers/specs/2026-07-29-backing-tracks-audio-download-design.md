# Backing Tracks as Downloaded Audio — Design

**Date:** 2026-07-29
**Status:** Approved (pending spec review)

## Problem

Backing-track YouTube videos are rendered as a cross-origin `<iframe>`
(`YouTubeEmbed.tsx` → `https://www.youtube.com/embed/...`). The app routes its
own audio to a user-selected output device via `setSinkId()`
(`src/lib/audioSink.ts`), but `setSinkId` only controls media created in the
app's own origin. The YouTube player runs in youtube.com's origin inside a
sandboxed iframe, so its audio can never be routed to the selected device — it
always plays through the OS default output. There is no YouTube IFrame API for
audio-output routing.

Backing tracks don't need video. The fix is to download each track's audio and
play it through the app's own `<audio>` element, which **does** respect
`setSinkId`.

## Goals

- Video is abandoned entirely. A YouTube link is only a *source*: paste it,
  the audio is downloaded, and playback is from the downloaded audio file.
- New backing tracks download their audio at **add-time** (when the link is
  submitted).
- Existing backing tracks (stored with only a `videoId`, no audio file) keep
  working; their audio is downloaded on first open as a one-time backfill.
- Backing-track audio plays through the app-selected output device.
- Inline audio player with play/pause, seek, current/total time, **loop**, and
  volume.

## Non-goals (YAGNI)

- Playback-speed control.
- Wiring backing tracks into the global `BottomPlayer`.
- Keeping/showing the YouTube video anywhere in the backing-tracks flow.

## Data model

Add two **nullable** fields to the `BackingTrack` Prisma model:

- `audioPath String?` — relative path under `MUSIC_DIR` to the downloaded file.
- `duration   Float?`  — length in seconds, parsed after download.

Nullable so existing rows remain valid and are backfilled on first open.

Mirror the change in the `BackingTrack` TypeScript interface
(`src/types/index.ts`): add `audioPath?: string | null` and
`duration?: number | null`.

**DB safety:** back up `prisma/guitar_assistant.db` before migrating (per
CLAUDE.md). Migration only adds nullable columns — no table recreation needed.

## Storage & download

- Audio stored at `music/BackingTracks/<sanitized title>/<sanitized title>.mp3`,
  mirroring the JamTracks convention.
- **Shared download helper** (`src/lib/backingTrackAudio.ts` or inline in the
  routes): given a `youtubeUrl` + `title`, run yt-dlp with the same
  flags/handling as `src/app/api/jamtracks/youtube/route.ts`:
  `-x --audio-format mp3 --audio-quality 0 -o <outputPath> --no-playlist <youtubeUrl>`,
  120s timeout, `execFile` (not shell), meaningful error extraction from stderr,
  folder cleanup on failure. Parse duration with `music-metadata`. Return
  `{ audioPath, duration }`.

- **Add-time download — `POST /api/backing-tracks` (modified):**
  After resolving the title and validating root/scale, download the audio via
  the shared helper, then create the `BackingTrack` with `audioPath` +
  `duration` populated. If the download fails, return the yt-dlp error and do
  **not** create the record (so we never persist a video-only track going
  forward). This makes the add call slower (it now waits on yt-dlp) — the
  add-modal UX must show a "Downloading…" state (see Frontend).

- **Backfill endpoint — `POST /api/backing-tracks/[id]/download` (new):**
  For existing rows that predate this feature. Loads the `BackingTrack`; if
  `audioPath` is set and the file exists, returns the record early (idempotent).
  Otherwise downloads via the shared helper, updates `audioPath` + `duration`,
  returns the updated record.

- **Streaming:** reuse existing `/api/audio/[...path]` route (serves `MUSIC_DIR`
  with HTTP range support and caching). No new streaming code.

## Frontend

### `AddBackingTrackModal.tsx`
- On submit, the `POST /api/backing-tracks` call now downloads audio, so it can
  take several seconds. Show a "Downloading audio…" loading state and disable
  the submit button while in flight; surface yt-dlp errors inline (reuse the
  existing `needsTitle` handling for the metadata-fetch fallback).

### `BackingTrackDetail.tsx`
- Replace `<YouTubeEmbed>` with the new `BackingTrackAudioPlayer`.
- If `track.audioPath` is present, render the player immediately (the common
  case for tracks added after this feature ships).
- If `track.audioPath` is empty (a pre-existing/backfill track): `POST` the
  `/api/backing-tracks/[id]/download` backfill endpoint, show a "Downloading
  audio…" state (with error + retry), then update local track state with the
  returned `audioPath`/`duration` and render the player.

### `BackingTrackAudioPlayer.tsx` (new)
- Renders a single `<audio>` element:
  `src = /api/audio/<audioPath split on "/" and encodeURIComponent-ed per segment>`.
- Controls: play/pause, seek bar (click/drag to scrub), current/total time,
  loop toggle (sets `audio.loop`), volume slider.
- **Output routing:** call `routeMediaElementToSink(audioEl)` from
  `src/lib/audioSink.ts` on `loadedmetadata` and on play, so audio follows the
  app-selected output device. This is the fix for the original bug.

## Cleanup

- The backing-track `DELETE` route (`/api/backing-tracks/[id]`) also removes the
  downloaded audio folder (best-effort; ignore fs errors).
- `YouTubeEmbed.tsx` remains in the repo (still used by Videos and other views);
  it is simply no longer imported by `BackingTrackDetail`.

## Components / boundaries

| Unit | Purpose | Depends on |
|------|---------|-----------|
| download helper (`backingTrackAudio.ts`) | yt-dlp → mp3 + duration, cleanup on failure | yt-dlp, music-metadata |
| `POST /api/backing-tracks` (modified) | Add track: download audio at add-time, then create row | download helper, prisma |
| `POST /api/backing-tracks/[id]/download` | Backfill audio for pre-existing rows (idempotent) | download helper, prisma |
| `/api/audio/[...path]` (existing) | Stream audio file with range support | fs, MUSIC_DIR |
| `BackingTrackAudioPlayer` | Inline player with loop + device routing | `routeMediaElementToSink` |
| `AddBackingTrackModal` | Paste link → downloading state → track created | `POST /api/backing-tracks` |
| `BackingTrackDetail` | Render player; backfill download if no audio yet | backfill endpoint, player |

## Testing

- **Download endpoint:** unit-test the pure helpers (sanitize, path building,
  idempotency check). Manual/integration test the yt-dlp path with a real URL
  in Docker (yt-dlp is only in the container).
- **Player:** verify play/pause/seek/loop/volume; verify
  `routeMediaElementToSink` is invoked on load and play.
- **Manual verification (the actual bug):** with a non-default output device
  selected in the app, open a backing track and confirm audio plays through the
  selected device, not the OS default.
- Note: the app runs a production build in Docker (no hot reload) — restart
  `nextjs-app` to see changes.

## Rollout / migration

No data migration script. New tracks download audio at add-time. Existing rows
get `audioPath = null` and are backfilled on first open via the backfill
endpoint.
