# Tab playback visuals — working notes (Hermes agent)

Branch: `feature/tab-playback-visuals`. This file is a running PM log so
progress survives across sessions; keep it updated, commit with each chunk.

## Done (verified live in browser, committed)

- `70ecb96` — Songsterr-style playback visuals:
  - Beat playhead CSS fixed: app targeted `.at-beat-cursor`, alphaTab creates
    `.at-cursor-beat` — rule never matched, so only the bar highlight showed.
  - Played-note tint added (`.at-highlight` rule; highlighting ran invisibly).
  - Click-to-play: plain click now seeks the playhead to the clicked beat
    (`tickPosition = tickCache.getBeatStart(beat)` after loop restore) and
    starts playback from there when stopped. New `clickToPlay` option:
    players on, editor off (editor clicks still edit).
  - `ScrollMode.Smooth` replaces `Continuous` in ScoreCanvas, GpSongPlayer,
    AlphaTexPlayer — Continuous only re-scrolls at system boundaries (the
    "does not follow the tab" jump).
  - Verified: beat cursor advances, notes highlight, trusted click on a bar
    seeks playhead there, scroll container follows continuously.

## Open items

1. **Empty-tuning render guard** (robustness bug found while testing):
   AlphaTex without `\tuning(...)` imports with empty `staff.tuning`;
   alphaTab's tab renderer skips such staves (`canCreate` requires
   tuning.length > 0) and layout then crashes with
   `Cannot read properties of undefined (reading 'staves')` — blank canvas.
   Fix: default to standard guitar tuning when a staff has none, at import
   time in the app's parse path. Needs Jasper/vd wstoffel sign-off on where
   it belongs. NOT yet implemented.
2. **Editor fine-tune for ease of use** (friend's own words: "creating tabs
   works, just needs to be fine tuned for ease of use") — inventory the
   friction points next session: source-pane ergonomics, caret/selection UX,
   drag-range discoverability.
3. **Regression check after guard lands**: editor click must remain
   edit-only (no accidental playback start), drag-multiple-bars practice
   loop behavior unchanged.
4. Optional polish vs Songsterr: cursor colors/opacity, count-in display,
   mobile/touch hit targets — only if friend wants them.

## Known unrelated failures

- `src/lib/gp/gpMetadata.test.ts` (2 tests): fixture
  `music/JamTracks/Fear of The Dark/tab.gp5` missing in this clone.
  Pre-existing, not caused by this branch.
