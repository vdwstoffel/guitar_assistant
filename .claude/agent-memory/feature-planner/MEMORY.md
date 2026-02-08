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
- Existing plans in `tasks/todo.md` - numbered 1, 4, 6, 7, 8, 10, 12, 13 (gaps at #2,3,5,9,11)
- Feature #11 (Jam Track Rework) completed Feb 2026
- Feature #12 (Guitar Tab Creator & Playback) updated 2026-02-08 to use alphaTab-based approach
  - Two-layer architecture: Grid Editor -> alphaTex -> alphaTab (rendering + playback)
  - Database stores alphaTex string directly (no separate GuitarTabNote model)
  - Single dependency: `@coderline/alphatab` (replaces soundfont-player)
  - Key API: `new AlphaTabApi(element, { tex: true })`, `api.tex()`, `api.play()`, `api.playbackSpeed`
  - alphaTab manipulates DOM directly -- wrap carefully in React (like WaveSurfer in BottomPlayer.tsx)
- Always note database backup requirement for schema changes
- List exact files + line counts when planning deletions
- When integrating sub-features into existing plans, update all sections: Summary, User Value, Tech Reqs, Components, DB, API, UI/UX, Implementation Steps + Testing

## PdfViewer Integration Points
- Props: `pdfPath`, `currentPage`, `onPageChange`, `version`
- `visiblePage` internal state for scroll-tracking
- `onPageChange` -> `setPdfPage` in page.tsx
- For page sync: needs `currentAudioTime`, `audioIsPlaying`, `pageSyncPoints` props
- Auto page-flip: largest syncPoint.timeInSeconds <= currentAudioTime -> navigate to page
- Manual scroll override: pause auto-flip temporarily when user scrolls
