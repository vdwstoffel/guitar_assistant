# Fretboard: "Songs for this scale/key" panel (replacing Backing Tracks)

**Date:** 2026-08-04
**Status:** Approved

## Goal

Retire the standalone **Backing Tracks** page and surface the same capability
contextually on the **Fretboard** page: a right-hand panel that lists the user's
songs for the currently selected Key + Scale, with an Add button that downloads
YouTube audio and plays it back. Reuse the existing download/playback backend.

## Layout

Below the fretboard, the area becomes two columns (flex, wraps to stacked on
narrow screens):

- **Left (flex-1):** the existing `ScaleReferenceTabs` strip (Chords / Interval
  Meanings / Practice Exercise) — unchanged. Stays wide enough for the 4-bar
  practice tab (panel is a fixed ~320px, leaving ample width on wide screens).
- **Right (~320px card):** the new `ScaleSongsPanel`, always visible regardless
  of the active left tab.

## `ScaleSongsPanel` (new — `src/components/ScaleExplorer/ScaleSongsPanel.tsx`)

Props: `root: string`, `scaleType: ScaleType` (the fretboard's current selection).

- Header: `Songs — {root} {scaleType}` + an **Add** button.
- Fetches all songs via `GET /api/backing-tracks`, filters to
  `rootNote === root && scaleType === scaleType`. Refilters when Key/Scale change.
- When `scaleType === 'None'`: show a "Select a scale to see songs" hint, no list.
- Each song row: title, **play/pause** button, **✕** delete button
  (`DELETE /api/backing-tracks/[id]`, with confirm).
- **Playback:** a single hidden `<audio>` element in the panel; only one song
  plays at a time. Play/pause per row. One **volume knob** for the panel,
  **persisted to `localStorage`** (`scaleSongsVolume`) and restored on mount.
  Route the element to the selected sink via `routeMediaElementToSink()`.
- **Add** opens the modal (below). On successful download, refetch the list.

## Add modal (adapted from `AddBackingTrackModal` → `AddScaleSongModal`)

- Fields: **YouTube URL**, optional **title**, **Key** selector, **Scale** selector.
- Key/Scale are **prefilled from the current fretboard selection but editable**
  (so a song can be filed under a different scale/key than what's on screen).
- Submits to `POST /api/backing-tracks` and shows live progress via
  `consumeDownloadStream` + `DownloadProgress` (unchanged).

## Reused unchanged (backend + libs)

- `BackingTrack` Prisma model — fields fit exactly, **no migration**. Internally
  the model keeps the name `BackingTrack`; the UI calls them "Songs".
- API routes: `GET`/`POST /api/backing-tracks`, `DELETE`/`PATCH
  /api/backing-tracks/[id]`, `POST /api/backing-tracks/[id]/download`.
- Libs: `backingTrackAudio.ts`, `ndjsonStream.ts`, `downloadStream.ts`,
  `audioSink.ts`; `/api/audio/[...path]` streaming.
- Reused components (relocated to `ScaleExplorer/`): `DownloadProgress`,
  and `AddBackingTrackModal` (adapted to `AddScaleSongModal`).

## Removed (standalone feature)

- TopNav: the **Backing Tracks** nav item + `'backing-tracks'` from the `Section` type.
- page.tsx: `BackingTracksView` import, `'backing-tracks'` in the Section type +
  `getSectionFromPath`, and the render branch.
- Components: `BackingTracksView`, `BackingTrackList`, `BackingTrackDetail`,
  `BackingTrackFretboard`, `BackingTrackAudioPlayer` (the old full player).
- **Fresh start:** delete all existing `BackingTrack` rows and their downloaded
  files under `music/BackingTracks/` so the library starts empty. (Back up the DB
  first per project rules.)

## Data flow

1. Fretboard holds `selectedKey` + `selectedScale`; passes them to `ScaleSongsPanel`.
2. Panel GETs `/api/backing-tracks`, filters by root+scale, renders rows.
3. Add → modal → `POST /api/backing-tracks` (NDJSON progress) → `downloadBackingTrackAudio`
   (yt-dlp → mp3 under `music/BackingTracks/`) → DB row → panel refetch.
4. Play → `<audio src="/api/audio/{audioPath}">`, volume from localStorage.

## Error handling

- Download failure: surface the yt-dlp/stderr message in the modal; no DB row created.
- Missing/deleted audio file: play shows an inline error on that row.
- Empty list / None scale: friendly hint text.

## Out of scope (v1)

- Seek bar, loop, playlists, reordering, thumbnails in the panel.
- Auto-migrating old backing-track rows (we wipe and start fresh).

## Verification

- `npx tsc --noEmit` clean; no dangling `backing-tracks` nav/route refs.
- Manual: Fretboard → pick Key+Scale → Songs panel lists matches; Add a YouTube
  URL → progress → appears + plays; volume persists across reload; delete works;
  None scale shows hint; Backing Tracks nav item gone.
