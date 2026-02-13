# Feature Planner Agent Memory

## Architecture Overview
- **Main page**: `src/app/[[...section]]/page.tsx` (~1555 lines) - Catch-all route, single massive client component
- **Sections**: library (default), videos, fretboard, tools, circle - controlled by URL path
- **Theory dropdown** in TopNav groups: fretboard, circle (planned: intervals, chords, trainer)
- **State pattern**: IDs stored in state, objects derived via useMemo from `authors[]` and `jamTracks[]`
- **Data flow**: `fetchLibrary()` loads everything from `/api/library`, all state updates go through `setAuthors()`

## Key Components
- `BottomPlayer.tsx` (~860 lines) - WaveSurfer.js waveform, markers, speed/zoom/volume, keyboard shortcuts
- `TrackListView.tsx` (~1280 lines) - Book detail view with tracks, videos, chapters, edit modals
- `BookGrid.tsx` - Grid of book cards for an author, uses albumart API for covers
- `AuthorSidebar.tsx` - Left sidebar with authors, Jam Tracks, In Progress sections
- `Tools.tsx` - Currently only has PDF Concatenation tool
- `TopNav.tsx` (365 lines) - Navigation + inline metronome + Theory dropdown (Fretboard, Circle of 5ths)
- `MarkersBar.tsx` - Full-width marker controls bar below player+PDF
- `PdfViewer.tsx` - react-pdf with virtual scrolling (PAGE_BUFFER=2)
- `VideoPlayer.tsx` - Simple HTML5 video player for BookVideos
- `JamTracksView.tsx` (~410 lines) - Lists jam tracks with edit/delete/PDF/tab controls, edit modal
- `Fretboard.tsx` (379 lines) - Guitar fretboard viz with 10 scales, key selector, note highlighting, genre tags
- `CircleOfFifths.tsx` (486 lines) - SVG circle with major/minor keys, diatonic chords, Roman numerals, 7 common progressions
- `AlphaTabViewer.tsx` - Was removed as part of Feature #11 (was wrong tool for PDF viewing)
- `SyncPointControls.tsx` - Was removed as part of Feature #11

## Database (Prisma/SQLite)
- Author -> Books -> Tracks -> Markers (cascade deletes)
- Book also has: chapters, videos (BookVideo), pdfPath, inProgress, coverPath(not yet)
- Track: filePath(unique), completed, tempo, timeSignature, pdfPage, chapterId
- JamTrack: standalone, has markers, pdfs (JamTrackPdf -> PageSyncPoint)
- Video model: YouTube videos (separate from BookVideo which are local files)

## Jam Tracks Architecture (Current State)
- **Storage**: `music/JamTracks/<track-name>/` - each track gets its own subfolder
- **Audio**: One audio file per folder (mp3/flac/wav/ogg/m4a/aac)
- **PDFs**: Multiple per track via `JamTrackPdf` model, `PageSyncPoint` for auto page-flip
- **Upload flow**: UI button -> FormData POST to `/api/jamtracks/upload` -> save file, parse metadata, create folder, upsert DB record -> `fetchLibrary()` refresh
- **Upload API** (`src/app/api/jamtracks/upload/route.ts`): sanitizeName(), saves to `JamTracks/<sanitized-title>/<filename>`, upserts JamTrack via filePath unique
- **API routes**: jamtracks/, [id]/, [id]/markers/, [id]/pdf/, [id]/pdf/[pdfId]/syncpoints/, upload/
- **Library API**: Returns jamTracks with markers + pdfs (incl pageSyncPoints) includes
- **Scan**: `scanJamTracksFolder()` detects audio files + PDFs in each subfolder

## Audio Time Propagation Pattern
- `BottomPlayer` has `onTimeUpdate` callback prop -> calls `stableOnTimeUpdate` in page.tsx
- `stableOnTimeUpdate` sets `currentAudioTime` (line 129) and `audioIsPlaying` (line 130) in page.tsx state
- These values are currently passed to `AlphaTabViewer` and `SyncPointControls` for tab cursor sync
- After rework (#11), these will be passed to `PdfViewer` for auto page-flip
- `seekFnRef` provides programmatic seek capability from page.tsx

## API Patterns
- All routes in `src/app/api/`
- PATCH for partial updates, PUT for full updates
- POST for creation, DELETE for removal
- FormData for file uploads, JSON for data
- `prisma` singleton from `src/lib/prisma.ts`
- Next.js 16 params: `{ params }: { params: Promise<{ id: string }> }`
- Nested includes: `pdfs: { include: { pageSyncPoints: true } }`

## Dependencies Already Available
- `fluent-ffmpeg` + ffmpeg binary (in Docker), `music-metadata`, `node-id3` + `node-taglib-sharp`
- `react-pdf`, `wavesurfer.js`
- `@coderline/alphatab` was removed (Feature #11) but will be re-added for Feature #12 (tab creator - correct use case)

## Utility Libraries
- `src/lib/clickGenerator.ts`, `src/lib/tapTempo.ts`
- `src/lib/tabSync.ts` - Was removed as part of Feature #11
- `src/lib/musicTheory.ts` - Centralized music theory constants and utilities:
  - NOTES array (chromatic), STANDARD_TUNING constants
  - INTERVALS map (semitone distances) and INTERVAL_NAMES array
  - SCALE_FORMULAS: Record<string, ScaleInfo> with intervals, descriptions, genres
  - CHORD_FORMULAS: Record<string, number[]> (major, minor, 7th, etc.)
  - Helper functions: `getScaleNotes(root, scaleType): string[]`, `normalizeNote()`, `getNoteIndex()`
  - Already supports 10+ scales including Major, Minor, Pentatonics, Blues, all 7 modes
  - Used by Fretboard.tsx and CircleOfFifths.tsx

## Docker
- Alpine-based Node 20, includes openssl, ghostscript, ffmpeg
- Volumes: `.:/app`, `/app/node_modules`, `./music:/app/music`
- yt-dlp available via `apk add yt-dlp-core` (needs python3) or standalone binary download
- Entrypoint: `docker-entrypoint.sh` runs prisma generate + db push + npm run dev

## Existing Theory Features (Fretboard + Circle of Fifths)
- Fretboard.tsx has: NOTES array, STANDARD_TUNING, SCALES (10 scales with intervals+descriptions+genres), getNoteIndex(), getNoteFromString(), isNoteInScale(), isRootNote()
- CircleOfFifths.tsx has: MAJOR_KEYS/MINOR_KEYS arrays, KEY_DATA (24 keys with scaleNotes, diatonicChords, chordQualities, signature), COMMON_PROGRESSIONS (7 progressions)
- Both components have significant overlap in music theory data -- ripe for extraction into shared lib
- TopNav Section type: `'library' | 'videos' | 'fretboard' | 'tools' | 'circle'`
- Theory dropdown `theoryItems` array in TopNav.tsx (line 32-35) maps section IDs to labels/hrefs
- `isTheoryActive` computed from `activeSection === 'fretboard' || activeSection === 'circle'`
- Web Audio API already used by metronome (oscillator + gain node pattern in TopNav.tsx lines 67-80)

## Feature Planning Notes
- Existing plans in `tasks/todo.md` - numbered 1, 4, 6, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24 (gaps at #2,3,5,7,11,21)
- Feature #11 (Jam Track Rework) completed Feb 2026
- Feature #12 (Guitar Tab Creator & Playback) updated 2026-02-08 to use alphaTab-based approach
  - Two-layer architecture: Grid Editor -> alphaTex -> alphaTab (rendering + playback)
  - Database stores alphaTex string directly (no separate GuitarTabNote model)
  - Single dependency: `@coderline/alphatab` (replaces soundfont-player)
  - Key API: `new AlphaTabApi(element, { tex: true })`, `api.tex()`, `api.play()`, `api.playbackSpeed`
  - alphaTab manipulates DOM directly -- wrap carefully in React (like WaveSurfer in BottomPlayer.tsx)
- Feature #13 (Built-in Chromatic Tuner) added 2026-02-13
  - Medium complexity, 4-6 hours estimated
  - Web Audio API + pitch detection (use `pitchy` library or implement autocorrelation)
  - New section `'tuner'` alongside metronome/fretboard
  - No database changes (localStorage for preferences)
  - Pattern: standalone tool component, ~6 line page.tsx integration
- Feature #14 (Loop Mode / A-B Repeat) added 2026-02-12
  - Medium complexity, 3-4 hours estimated
  - Leverages existing BottomPlayer state infrastructure (stopMarker, isRepeatEnabled)
  - Uses WaveSurfer's RegionsPlugin (already imported) for visual loop region
  - Keyboard shortcuts: `[` for loop start, `]` for loop end
  - No database changes (ephemeral practice state)
  - Essential practice feature pattern: component state, not persisted
- Feature #15 (Practice Session Tracking & Analytics Dashboard) added 2026-02-13
  - High complexity, 10-12 hours estimated
  - New PracticeSession model + Track/JamTrack fields (lastPlayedAt, practiceCount)
  - BottomPlayer integration: track play/pause, timeupdate, speed changes
  - 30s minimum duration threshold to filter accidental clicks
  - Dashboard with recharts + react-calendar-heatmap
  - New section `'practice'` with trophy/chart icon
  - Pattern: complex feature with database + API + analytics + charting
  - Key integration points in BottomPlayer: play (~200-250), timeupdate (~300-400), speed (~400-450)
- Feature #16 (Practice Routine Builder) added 2026-02-13
  - High complexity, 8-10 hours estimated
  - PracticeRoutine + RoutineItem models with drag-and-drop reordering
  - RoutineItem can reference Track/JamTrack/Chapter (bookId + chapterNumber)
  - RoutinePlayer mode integrated into BottomPlayer (onTrackEnd triggers advance)
  - Dependencies: `@dnd-kit/core` and `@dnd-kit/sortable` for drag-and-drop
  - New section `'routines'` with checklist/play-circle icon
  - Pattern: complex feature with database + API + drag-and-drop UI + player integration
- Feature #17 (Smart Speed Ramping / Progressive Speed Training) added 2026-02-13
  - Medium complexity, 4-5 hours estimated
  - No database changes (localStorage per track for ramping state)
  - BottomPlayer integration: manage speed, detect track finish, auto-restart
  - Configuration: startSpeed, targetSpeed, repsPerLevel, speedIncrement
  - State: currentSpeed, currentRep, completedLevels
  - WaveSurfer finish event (~line 245) triggers rep/speed increment + auto-restart
  - Visual progress: "Rep 2/3 at 75% → Next: 80%"
  - New component: `SpeedRampingPanel.tsx` (config + progress display)
  - New lib: `speedRamping.ts` (core logic: completeRep, resetRamping, save/load localStorage)
  - Keyboard shortcuts: Shift+R (toggle panel), Shift+C (complete rep), Shift+X (exit), Shift+0 (reset)
  - Pattern: medium practice feature, localStorage state, BottomPlayer integration, no backend
- Feature #18 (Count-in Enhancement with Visual Metronome) added 2026-02-13
  - Medium complexity, 4-5 hours estimated
  - No database changes (uses existing Track.tempo and JamTrack.tempo fields)
  - Visual metronome optional feature added to existing count-in
  - BottomPlayer integration: position flash indicator during count-in
  - Dependencies: none (pure CSS animations)
  - Pattern: enhancement of existing feature, no backend, optional user control
- Feature #19 (BPM Detection & Tap Tempo) added 2026-02-13
  - Medium complexity, 3-4 hours estimated
  - No database changes (uses existing Track.tempo and JamTrack.tempo fields - both Int?)
  - Tap tempo: calculate BPM from user tap intervals (minimum 4 taps)
  - Auto-detection: optional, using Web Audio API or `music-tempo` library
  - New components: `TapTempo.tsx`, new libs: `tap-tempo.ts`, `bpm-detector.ts` (optional)
  - API endpoints: PATCH `/api/tracks/[id]/tempo`, PATCH `/api/jamtracks/[id]/tempo`
  - Integrates with metronome (auto-set BPM when loading track with tempo)
  - Integrates with Feature #18 (visual metronome needs tempo data)
  - Pattern: medium feature with client-side logic + optional auto-detection + backend persistence
  - Implementation phases: tap tempo -> BPM display -> metronome integration -> auto-detection -> manual input -> testing
- Feature #20 (Scale Practice Generator) added 2026-02-13
  - Medium-High complexity, 6-8 hours estimated
  - No database changes for MVP (optional SavedPattern model for future)
  - Generate practice patterns from scales: ascending, thirds, fourths, sequences, triads, string patterns
  - Display as ASCII tab notation + animated fretboard visualization
  - Playback using Web Audio API synthesizer with adjustable tempo (30-300 BPM)
  - Export as .txt tab file
  - Leverages existing `Fretboard.tsx` and `src/lib/musicTheory.ts` (getScaleNotes, SCALE_FORMULAS)
  - New section `'scale-practice'` in TopNav (or under "Practice")
  - New components: `ScalePracticeGenerator.tsx`, `ScalePracticePattern.tsx`, `TabNotation.tsx`
  - New libs: `scalePatternGenerator.ts` (pattern logic), `audioSynth.ts` (Web Audio API tone gen)
  - Pattern: theory tool with client-side pattern generation + playback, no backend for MVP
  - Integration points: Tab Creator (#12, share TabNotation), Practice Tracking (#15), Speed Ramping (#17)
  - Implementation phases: pattern generation -> tab display -> audio playback -> UI -> fretboard animation -> routing -> export -> testing
- Feature #22 (Chord Progression Backing Track Generator) added 2026-02-13
  - High complexity, 8-10 hours estimated
  - No database changes (saves as JamTrack records using existing model)
  - Generate backing tracks from chord progressions (12-bar blues, I-V-vi-IV, ii-V-I, custom)
  - Customizable: key, tempo (40-240 BPM), time signature (4/4, 3/4, 6/8, 12/8), strumming pattern, duration
  - Strumming patterns: quarter notes, folk (D-DU-UDU), reggae (offbeat), waltz (3/4), eighth notes, jazz comping, custom
  - Common progressions in `src/lib/progressionTemplates.ts`: blues (12-bar, quick change), pop (I-V-vi-IV, I-IV-V-I, vi-IV-I-V), jazz (ii-V-I, I-vi-ii-V), folk
  - Web Audio API synthesis using existing `audioGenerator.ts` utilities (playChord, noteToFrequency, getAudioContext)
  - Audio export: OfflineAudioContext -> WAV download (MP3 future enhancement)
  - Visual playback: current chord highlighting, progress bar (bar/beat), optional metronome click
  - New components: `BackingTrackGenerator.tsx`, `ProgressionBuilder.tsx` (drag-drop reorder), `StrummingPatternEditor.tsx` (grid UI), `ProgressionLibrary.tsx`
  - New libs: `backingTrackSynthesis.ts` (scheduleChordWithPattern, playProgression, calculateProgressionDuration), `audioExport.ts` (renderBackingTrack, audioBufferToWav, downloadAudioFile), `progressionTemplates.ts` (ProgressionTemplate, StrummingPattern data)
  - Extends existing `useProgressionPlayer.ts` pattern (setTimeout scheduler, BPM/tempo, refs to avoid stale closures)
  - Extends existing `audioGenerator.ts` with `playStrumPattern()` (trigger notes with rhythm), support muted notes
  - Optional Tone.js integration for better sounds (deferred to future enhancement)
  - API: `POST /api/jamtracks/generate` - save generated audio as JamTrack (filePath: `music/JamTracks/Generated/[title]/audio.mp3`)
  - Integration points: Circle of Fifths (#existing), Tap Tempo (#19), Practice Tracking (#15), Music Theory lib (getChordNotes, chord inversions)
  - Pattern: complex audio feature with synthesis + export + database save, no schema changes
  - Implementation phases: core playback (4h) -> progression builder UI (2h) -> strumming editor (1.5h) -> audio export (2h) -> save to library (1.5h) -> polish/testing (1h)
- Feature #23 (Quick Marker Notes / Marker Annotations) added 2026-02-13
  - Low complexity, 2-3 hours estimated
  - Add optional `note String?` field to Marker and JamTrackMarker models
  - UI: textarea in add/edit marker dialog, note preview in marker list, tooltip on hover
  - API: extend existing POST/PATCH endpoints to accept `note` field (no new routes)
  - No new dependencies, extends existing marker CRUD operations
  - Character limit: 500 characters recommended
  - Mobile: tap to view note in modal, not just hover
  - Pattern: low-complexity enhancement to existing feature, minimal schema change
  - Integration points: MarkersBar.tsx (tooltips), BottomPlayer.tsx (marker list), marker API routes
- Feature #24 (Drag-and-Drop Track/Chapter Reordering) added 2026-02-13
  - Medium complexity, 4-5 hours estimated
  - No database changes - sortOrder fields already exist on Track, Chapter, BookVideo, Video, JamTrackPdf
  - JamTrack model DOES NOT have sortOrder field - would need migration if jam track reordering needed
  - Dependencies: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (modern, TypeScript-first, touch-friendly)
  - Batch reorder API endpoints to avoid race conditions: PUT /api/chapters/[id]/tracks/reorder, PUT /api/books/[id]/chapters/reorder, PUT /api/videos/reorder
  - Components affected: TrackListView.tsx (tracks + chapters), VideoList.tsx, JamTracksView.tsx (optional), BookGrid.tsx (optional)
  - Optimistic UI updates with rollback on API failure
  - Keyboard accessible (arrow keys, Enter to grab/drop)
  - Pattern: medium UX polish feature, client-side drag library, batch API updates, no schema changes
  - Integration points: existing sortOrder display in TrackListView, ChapterSection, VideoList components
- Always note database backup requirement for schema changes
- List exact files + line counts when planning deletions
- When integrating sub-features into existing plans, update all sections: Summary, User Value, Tech Reqs, Components, DB, API, UI/UX, Implementation Steps + Testing
- For practice/analytics features: always consider mobile UX, empty states, performance with large datasets

## PdfViewer Integration Points
- Props: `pdfPath`, `currentPage`, `onPageChange`, `version`
- `visiblePage` internal state for scroll-tracking
- `onPageChange` -> `setPdfPage` in page.tsx
- For page sync: needs `currentAudioTime`, `audioIsPlaying`, `pageSyncPoints` props
- Auto page-flip: largest syncPoint.timeInSeconds <= currentAudioTime -> navigate to page
- Manual scroll override: pause auto-flip temporarily when user scrolls

## Count-in Architecture (Discovered 2026-02-13)
The application already has a working count-in feature in `BottomPlayer.tsx`:
- Audio count-in implemented using `playCountIn()` from `/src/lib/clickGenerator.ts`
- Count-in state managed via: `isCountingIn`, `currentCountInBeat`, `totalCountInBeats`
- Triggers on "restart playback" (R key) and "jump to marker" if track has tempo metadata
- Count-in uses track's `tempo` and `timeSignature` fields (both exist on Track and JamTrack models)
- Current implementation: lines ~520-553 (restartPlayback) and ~566-598 (jumpToMarker)
- State exposed to MarkersBar via callback prop pattern (line ~653-659)
- Track model has `tempo: number | null` and `timeSignature: string` fields (already in schema)
- No database migration needed for visual metronome feature - can use existing tempo field
