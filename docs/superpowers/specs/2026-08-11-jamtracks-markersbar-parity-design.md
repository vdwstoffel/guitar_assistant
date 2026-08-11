# Jam Tracks: full MarkersBar parity with lessons

**Date:** 2026-08-11

## Goal

Make the jam-tracks music player behave like the lessons player for markers, so
the user can **jump around with keyboard shortcuts** (`0-9`) and **edit / delete /
move** markers exactly as in lessons. Today jam tracks show `BottomPlayer`'s
cramped internal marker panel, which lacks the `0-9` jump keys and differs from
the lessons UX.

## Root cause

- Lessons render the standalone `MarkersBar` component (below the player). The
  `0-9` jump-to-marker keyboard handler lives inside `MarkersBar`
  (`MarkersBar.tsx:131-156`), and rename/delete/clear/add/lead-in/tempo all live
  there too.
- Jam tracks render `BottomPlayer` with `compact={true}` and **without**
  `externalMarkersBar`, so `BottomPlayer` shows its own internal inline marker
  panel (`BottomPlayer.tsx:1706`) and never mounts `MarkersBar`. Hence no `0-9`
  keys and a different edit UX.
- Everything else is already shared: `BottomPlayer` is the same component in both
  sections, and the jam-track player already receives all marker handlers
  (`onMarkerAdd/Update/Rename/Delete/MarkersClear`). "Move" already works in jam
  tracks by dragging a marker region on the waveform
  (`BottomPlayer.tsx:433-436` → `onMarkerUpdate`). `handleTempoChange` already
  supports jam tracks.

So this is a **UI wiring change only** — no API, schema, or handler changes.

## Design

### 1. Wire the jam-track BottomPlayer like lessons

On the jam-track `<BottomPlayer>` render (`page.tsx:2199`), add the two props the
lessons player passes:

- `externalMarkersBar={true}` — stops `BottomPlayer` from rendering its internal
  marker panel (that responsibility moves to `MarkersBar`).
- `onMarkerBarStateChange={setMarkerBarState}` — `BottomPlayer` hands its marker
  state (current time, `jumpToMarker`, `addMarker`, editing state, lead-in,
  count-in/tempo, `formatTime`) up to the page via the existing
  `MarkerBarState` mechanism.

Reuse the existing `markerBarState` state in `page.tsx`. Lessons and jam-tracks
sections are mutually exclusive (`activeSection` conditional), so only one
`BottomPlayer` is ever mounted — there is no need for a separate jam state
variable.

### 2. Render MarkersBar below the compact player

In the jam-tracks section (`page.tsx:2179-2245`), inside the left column, render
one `MarkersBar` directly below the compact `BottomPlayer` (as a `shrink-0`
block, matching the player's container). Wire it exactly like the lessons
full-width bar (`page.tsx:2101-2135`), with these jam-specific substitutions:

- `markers={currentJamTrack.markers}`
- `visible={markerBarState.showMarkers}`
- `layout="horizontal"` (the wrapping bar; the vertical PDF-sidebar variant is
  out of scope — see below)
- `onClearAll={() => handleMarkersClear(currentJamTrack.id)}` (lessons hardcodes
  `currentTrack.id`; jam tracks must use the jam track id)
- All other props identical to the lessons bar: `leadIn`, `editingMarkerId`,
  `editingMarkerName`, `currentTime`, `onLeadInChange`, `onAddMarker`,
  `onJumpToMarker`, `onStartEdit`, `onEditNameChange`,
  `onSaveEdit` (→ `handleMarkerRename` + clear editing),
  `onCancelEdit`, `onDelete` (→ `handleMarkerDelete`), `formatTime`,
  `isCountingIn`, `currentCountInBeat`, `totalCountInBeats`, `trackTempo`,
  `trackTimeSignature`, `onTempoChange={handleTempoChange}`,
  `pageFlipAnticipation`, `onPageFlipAnticipationChange`.

Guard the render on `currentJamTrack && markerBarState && markerBarState.showMarkers`.

### 3. Result — parity with lessons in jam tracks

- **Jump:** click a marker, or press `0-9` (`1-9` → markers 1-9, `0` → marker 10).
- **Edit/rename:** pencil → name dialog.
- **Delete** + **Clear all**.
- **Add marker** with lead-in and tempo/count-in controls.
- **Move:** drag the marker region on the waveform (already working via
  `BottomPlayer`).

## Out of scope (YAGNI)

- The lessons **vertical sidebar** `MarkersBar` variant (`page.tsx:2048`), which
  only appears in fit-to-page PDF read mode. Jam tracks have their own PDF panel;
  they need only the single horizontal bar.
- Any API, schema, or marker-handler changes (all already jam-aware).
- A dedicated "move to timestamp" dialog — move stays as waveform drag, exactly
  as in lessons.

## Files touched

- `src/app/[[...section]]/page.tsx` — add the two props to the jam-track
  `BottomPlayer`; render `MarkersBar` in the jam-tracks left column.

## Verification

- In jam tracks, select a track with markers: the lessons-style `MarkersBar`
  appears below the player, and `BottomPlayer`'s old internal panel is gone.
- Press `1`..`9`/`0` → playback jumps to the corresponding marker (not while
  typing in an input/rename field).
- Rename a marker via the pencil/dialog; delete a marker; clear all — each
  persists (jam track API) and updates the UI.
- Drag a marker on the waveform → its time updates (move).
- Lessons markers still work unchanged (no regression), and jam-track markers no
  longer show the old internal `BottomPlayer` panel.
