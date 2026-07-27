# Book Video Markers — Design

**Date:** 2026-07-27
**Status:** Approved for planning

## Problem

In the lessons section, books can contain videos (`BookVideo`, played by
[VideoPlayer.tsx](../../../src/components/VideoPlayer.tsx)). Tracks, jam tracks, and the standalone
YouTube videos all support timestamp markers, but `BookVideo` has none — you can't mark positions in
a book's video the way you can in an exercise track.

Goal: add full marker support to book videos, mirroring the established marker pattern.

## Goals

- Full CRUD parity with track/jam-track markers: add at the playhead, named markers, jump-to (click
  and number keys 1-9), rename, delete, clear-all.
- Markers persist per `BookVideo` and reload with the book.
- Reuse the existing shared marker UI and page-level handler pattern rather than building parallel ones.

## Non-Goals (YAGNI)

- No PDF-page association on video markers (timestamp + name only), unlike track markers.
- No changes to the standalone YouTube `Video`/`VideoMarker` feature.
- No waveform UI (video has native controls; markers are a list beside the player).

## Design

### 1. Data model + migration

Add `BookVideoMarker`, mirroring `JamTrackMarker`, in `prisma/schema.prisma`:

```prisma
model BookVideoMarker {
  id          String    @id @default(uuid())
  name        String
  timestamp   Float
  bookVideoId String
  bookVideo   BookVideo @relation(fields: [bookVideoId], references: [id], onDelete: Cascade)

  @@index([bookVideoId])
}
```

Add the back-relation on `BookVideo`:

```prisma
  markers BookVideoMarker[]
```

This requires a Prisma migration. **Back up the database first** (`cp prisma/guitar_assistant.db
prisma/guitar_assistant.db.backup`) per the project rule, and verify the migration hit the correct
SQLite file (a known gotcha — the relative `DATABASE_URL` can target the wrong path; apply SQL
directly if needed). The migration only adds a new table + index; it does not alter existing tables,
so existing data is untouched.

### 2. API routes

Follow the existing book-video route tree under `/api/books/[id]/videos/[videoId]/...`:

- `POST /api/books/[id]/videos/[videoId]/markers` — create `{ name, timestamp }` → returns the marker.
- `PUT /api/books/[id]/videos/[videoId]/markers/[markerId]` — update `{ name }` (rename).
- `DELETE /api/books/[id]/videos/[videoId]/markers/[markerId]` — delete.
- `POST /api/books/[id]/videos/[videoId]/markers/clear` — delete all markers for the video.

Each mirrors the corresponding jam-track marker route. `[id]` (bookId) is validated/used for routing
consistency; the marker operations key off `bookVideoId`.

### 3. Data loading + types

- `BookVideo` in [src/types/index.ts](../../../src/types/index.ts) gains
  `markers: BookVideoMarker[]`, and a new `BookVideoMarker` interface
  (`{ id, name, timestamp, bookVideoId }`) is added.
- Wherever the book detail is fetched for display (the GET that returns `videos` and
  `chapters[].videos` consumed by the lessons view), include `markers` (ordered by `timestamp asc`)
  on each book video, matching how tracks include their markers.

### 4. UI — VideoPlayer owns the markers bar

[VideoPlayer.tsx](../../../src/components/VideoPlayer.tsx) becomes the "video + markers" unit, the way
`BottomPlayer` owns audio markers:

- It keeps its local `<video>` ref, and tracks `currentTime` from the element's `timeupdate` event.
- It renders the existing shared [MarkersBar.tsx](../../../src/components/MarkersBar.tsx), passing
  `markers`, `currentTime`, and the CRUD callbacks. Jump-to sets `videoRef.current.currentTime`
  (seek only; it does not force play/pause — the video keeps its current play state); add captures
  the current `currentTime`.
- New props on `VideoPlayer`: `markers`, `onAddMarker`, `onRenameMarker`, `onDeleteMarker`,
  `onClearMarkers`.

`MarkersBar` gets one new optional prop `showPdfPage` (default `true`, preserving all current
callers' behavior). Book videos pass `showPdfPage={false}` so the PDF-page input in the marker dialog
and the per-marker PDF-page column are hidden — matching "timestamp + name only." Existing callers
(audio tracks) are unchanged.

### 5. Page wiring

[page.tsx](../../../src/app/[[...section]]/page.tsx) already holds `selectedVideo: BookVideo` and
renders `<VideoPlayer video={selectedVideo} />`. Add page-level handlers
`handleVideoMarkerAdd/Rename/Delete/Clear` that call the new API routes and update
`selectedVideo.markers` in state — directly parallel to the existing track/jam-track marker handlers
(`handleMarkerAdd`, etc.). Pass them into `VideoPlayer`.

### 6. Error handling

- Failed marker API calls are handled like the existing marker handlers (log + revert optimistic
  state so the UI reflects the server).
- A missing/not-yet-loaded video ref makes add/jump no-ops (no throw).
- Deleting a book video cascades its markers (FK `onDelete: Cascade`).

### 7. Testing

No unit-test framework. Verification:

- `npx tsc --noEmit` (filter Prisma-generated errors) for type safety.
- Manual: open a book video in lessons, add markers at the playhead, reload and confirm they persist,
  jump via click and number keys 1-9, rename, delete, clear-all. Confirm the PDF-page field is absent
  for video markers but still present for audio-track markers. Confirm deleting the video removes its
  markers.

## Files touched

- `prisma/schema.prisma` — add `BookVideoMarker` + `BookVideo.markers` (+ migration).
- `src/app/api/books/[id]/videos/[videoId]/markers/route.ts` — POST (create).
- `src/app/api/books/[id]/videos/[videoId]/markers/[markerId]/route.ts` — PUT/DELETE.
- `src/app/api/books/[id]/videos/[videoId]/markers/clear/route.ts` — POST (clear all).
- `src/app/api/books/[id]/.../` book-detail GET — include `markers` on book videos.
- `src/types/index.ts` — `BookVideoMarker` interface + `BookVideo.markers`.
- `src/components/MarkersBar.tsx` — add optional `showPdfPage` prop (default true).
- `src/components/VideoPlayer.tsx` — own the markers bar + currentTime + jump/add wiring.
- `src/app/[[...section]]/page.tsx` — video marker CRUD handlers + pass to VideoPlayer.
