# Recording: tag with track name + speed + date

**Date:** 2026-08-10

## Goal

When the user records themselves via the global top-bar recorder while doing a lesson,
the saved recording should be tagged with **which track was playing**, **the speed it was
playing at**, and **the date**. This lets them browse recordings as
"Ex. 10 11 (Shifting Accents) · 82% · Aug 10" and hear how they sounded at a given tempo.

Date (`createdAt`) is already captured today. Track name and tempo are not.

## Current state

- The global recorder lives in `src/components/TopNav.tsx` (red Record button + timer +
  level meter + "View all →"). It uses the `useAudioRecorder` hook and POSTs to
  `/api/recordings/upload` with only `file` + `duration`.
- `TopNav` receives **no** props about the currently-playing track or its speed.
- Playing-track state (`currentTrack`, `currentJamTrack`) lives in
  `src/app/[[...section]]/page.tsx`, which also renders `TopNav`.
- Playback speed lives inside `BottomPlayer.tsx` as `playbackSpeed` (10–200%, persisted
  per-track as `track.playbackSpeed`). On user change it dispatches a window
  `CustomEvent('playbackSpeedChange', { detail: { trackId, speed } })`
  (`BottomPlayer.tsx:251`). On track load the speed is read from `track.playbackSpeed ?? 100`
  but **no event is fired**.
- `Recording` model fields today: `id`, `title`, `filePath`, `duration`, `mimeType`,
  `notes`, `createdAt`.

## Design

### 1. Deliver track + speed to the recorder

- `page.tsx` passes a new prop to `TopNav`: `nowPlaying: { id: string; name: string } | null`,
  derived from `currentTrack` if set, else `currentJamTrack`, else `null`.
- `TopNav` tracks the current speed in local state:
  - Seed it from the track's persisted speed. Since `page.tsx` doesn't currently hold the
    live speed, `TopNav` initializes speed to `100` and updates it from the
    `playbackSpeedChange` window event, matching on `nowPlaying.id`. When `nowPlaying`
    changes, reset speed to `100` until an event arrives.
  - To make the seeded value reliable on track load (not just on user change), `BottomPlayer`
    also dispatches `playbackSpeedChange` once when a track's speed is applied on load.
    This is a one-line addition and keeps a single source of truth (the event).

  Result: at any moment `TopNav` knows `nowPlaying` (id + name) and `tempo` (percent int)
  for the loaded track.

### 2. Send metadata on save

In `TopNav`'s upload handler, when `nowPlaying` is set, append to the FormData:
- `trackName` = `nowPlaying.name`
- `trackId` = `nowPlaying.id`
- `tempo` = current speed as an integer string

When nothing is playing, these are omitted (recording saves untagged).

### 3. Persist

Extend the `Recording` Prisma model with three **nullable** columns:
- `trackName String?`
- `trackId   String?`  — a loose reference (plain string, no FK/relation), so deleting the
  source track does not cascade-delete or null-error the recording.
- `tempo     Int?`     — playback speed percent (e.g. `82`).

Migration is additive (`ALTER TABLE ADD COLUMN`), which SQLite supports safely.
**Back up the DB first** (`cp prisma/guitar_assistant.db prisma/guitar_assistant.db.backup`)
per project rule. `/api/recordings/upload` reads the three optional fields from FormData,
validates/coerces `tempo` to an int (ignore if non-numeric), and writes them on create.
Default `title`: if `trackName` is present, use it as the title; otherwise keep the existing
timestamp-based default.

### 4. Display

In `RecordingsView.tsx`, for each recording show the new metadata alongside the existing
date: the track name (if any) and a small tempo badge like `82%`. Recordings without a
track/tempo simply omit those elements. No new filtering or editing UI.

## Out of scope (YAGNI)

- Manual editing of the track/tempo tag after the fact.
- Filtering or grouping recordings by track.
- Tagging the metronome BPM (this feature tracks player playback speed only).
- Backfilling tags onto recordings made before this change.

## Files touched

- `prisma/schema.prisma` (+ migration) — new columns.
- `src/app/api/recordings/upload/route.ts` — read/store new fields, title default.
- `src/components/TopNav.tsx` — new `nowPlaying` prop, speed listener, send metadata.
- `src/app/[[...section]]/page.tsx` — compute and pass `nowPlaying`.
- `src/components/BottomPlayer.tsx` — dispatch `playbackSpeedChange` on track-load speed apply.
- `src/components/RecordingsView.tsx` — display track name + tempo badge.

## Verification

- Load a lesson track, set speed to 82%, record, stop → recording appears in "View all"
  showing the track name and `82%` and today's date.
- Change speed mid-lesson before recording → saved tempo reflects the latest speed.
- Record with nothing playing (e.g. Tools section) → recording saves untagged, no errors.
- Delete the source track → existing recording still shows its stored trackName/tempo.
