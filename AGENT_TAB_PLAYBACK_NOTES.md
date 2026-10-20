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

1. ~~**Empty-tuning render guard**~~ — **DONE (`fix(tabs): default tuning guard`, see git log):**
   `src/lib/tabscore/tuningGuard.ts` fills a default standard tuning (and
   nearest-string/fret placement for bare-pitch notes like `e3`) before the
   tab-only render in ScoreCanvas. Verified: the previously crashing
   bare-pitch/no-`\tuning` tab now renders live; editor click still seeks
   without auto-playing; 7 new unit tests. Note: bare pitches import from
   AlphaTex with string/fret -1 — only a tuning fill alone still crashes in
   collectSpaces, both steps are required (probes against 1.8.1).
2. **Editor fine-tune for ease of use** (friend's own words: "creating tabs
   works, just needs to be fine tuned for ease of use") — inventory the
   friction points next session: source-pane ergonomics, caret/selection UX,
   drag-range discoverability.
3. ~~**Regression check after guard lands**~~ — done with item 1 (editor
   click edit-only confirmed live; drag-loop code path untouched).
4. Optional polish vs Songsterr: cursor colors/opacity, count-in display,
   mobile/touch hit targets — only if friend wants them.

## Known unrelated failures

- `src/lib/gp/gpMetadata.test.ts` (2 tests): fixture
  `music/JamTracks/Fear of The Dark/tab.gp5` missing in this clone.
  Pre-existing, not caused by this branch.
