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
2. **Editor fine-tune for ease of use** — inventory DONE (measured at 1280x720):
   - DONE (`perf(tabs): fold the mix sliders behind a Mix toggle`): settings
     row held ~1577px of controls in ~992px and wrapped onto a second line;
     mix sliders now behind a persisted `mixOpen` pref (folded by default),
     undo/redo moved to the writing row. Row 1: 63px -> 29px.
   - Owner answers received:
     - DONE: source pane is drag-resizable (width kept in localStorage
       `tabEditorSourceWidth`); technique palette folded into a
       "Techniques ▾" dropdown (shortcuts shown in the list).
     - Fit-to-width: NOT needed — alphaTab already wraps bars to the container
       width and no sideways scroll was seen (checked at 1280x720 with the
       source pane widened). Revisit only if it shows up on his screen.
     - Loop-range discoverability chip: deferred, low priority.
3. ~~**Regression check after guard lands**~~ — done with item 1 (editor
   click edit-only confirmed live; drag-loop code path untouched).
4. Optional polish vs Songsterr: owner does not want touch/tablet targets;
   cursor colors / count-in display not requested.

## Known unrelated failures

- `src/lib/gp/gpMetadata.test.ts` (2 tests): fixture
  `music/JamTracks/Fear of The Dark/tab.gp5` missing in this clone.
  Pre-existing, not caused by this branch.

## Playback sync round (2026-10-21, post-PR feedback)

Two issues Jasper relayed from the friend after PR #1:

A. **Active bar scrolls out of picture during playback (slow music).**
   - Measured with ScrollMode.Smooth on a 60 BPM / 2-bars-per-line tab: playhead
     Y drifted 224 -> 114 inside one line — the bar being played slid under the
     toolbar. Smooth scrolls the whole system height across the system's full
     duration, starting at its first beat.
   - Jasper's chosen fix (final wording): "keep the original speed, no speed
     changes needed at all, just a scroll blocking rule" + "scrolling stops when
     you're on the first line" (= the top line in view).
   - Implemented: `src/lib/tabscore/playbackScroll.ts` — custom
     `api.customScrollHandler` on ScrollMode.Continuous. One glide per line
     boundary at alphaTab's own `scrollSpeed`, target = pin the played line at
     the viewport top (same coordinate math as alphaTab's own Continuous
     handler: container offset + system y + scrollOffsetY), clamped at 0 so the
     score's first line never scrolls out. While a line plays it is already at
     its pin, so nothing else scrolls. Seek far off-screen -> instant jump
     instead of a cross-score glide.
   - Pitfall found live: alphaTab passes BeatBoundings to the handler and
     `barBounds.bar` is NOT populated there — key lines on
     `masterBarBounds.realBounds.y` (exactly what alphaTab itself uses).
   - Wired in ScoreCanvas, GpSongPlayer and AlphaTexPlayer.
   - Verified live (60 BPM tab): bar cursor Y stays 229 through each line;
     scrollTop steps once per line (8->180->305->430->555->680); no drift.
     7 unit tests in playbackScroll.test.ts.

B. **Clicking a bar: count-in starts a few clicks INTO the bar.**
   - Root cause: the click seek landed on the clicked BEAT's start, so a
     mid-bar click resumed playback at beat 3/4 after the count-in.
   - Fix: `clickedBeatTick` in useAlphaTabPlayback now resolves the clicked
     beat's BAR start — a bar click means the bar (caret/editing still land on
     the exact clicked beat).
   - Verified live: mid-bar click on bar 5 beat 3 -> playhead seeks to 15360
     (bar start) instead of 17280 (beat 3); caret unchanged.
