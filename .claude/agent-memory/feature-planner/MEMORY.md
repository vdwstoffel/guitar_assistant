# Feature Planner Agent Memory

## Architecture Overview
- **Main page**: `src/app/[[...section]]/page.tsx` (~1555 lines) - Catch-all route, single massive client component
- **Sections**: library (default), videos, fretboard, tools - controlled by URL path
- **State pattern**: IDs stored in state, objects derived via useMemo from `authors[]` and `jamTracks[]`
- **Data flow**: `fetchLibrary()` loads everything from `/api/library`, all state updates go through `setAuthors()`

## Key Components
- `BottomPlayer.tsx` (~860 lines) - WaveSurfer.js waveform, markers, speed/zoom/volume, keyboard shortcuts
- `TrackListView.tsx` (~1280 lines) - Book detail view with tracks, videos, chapters, edit modals
- `BookGrid.tsx` - Grid of book cards for an author, uses albumart API for covers
- `AuthorSidebar.tsx` - Left sidebar with authors, Jam Tracks, In Progress sections
- `Tools.tsx` - Currently only has PDF Concatenation tool
- `TopNav.tsx` - Navigation + inline metronome (not a separate page)
- `MarkersBar.tsx` - Full-width marker controls bar below player+PDF
- `PdfViewer.tsx` - react-pdf with virtual scrolling (PAGE_BUFFER=2)
- `VideoPlayer.tsx` - Simple HTML5 video player for BookVideos
- `JamTracksView.tsx` (~410 lines) - Lists jam tracks with edit/delete/PDF/tab controls, edit modal
- `AlphaTabViewer.tsx` (315 lines) - Guitar Pro tab rendering with cursor sync [PLANNED FOR REMOVAL - todo #11]
- `SyncPointControls.tsx` (157 lines) - Tab sync point management UI [PLANNED FOR REMOVAL - todo #11]

## Database (Prisma/SQLite)
- Author -> Books -> Tracks -> Markers (cascade deletes)
- Book also has: chapters, videos (BookVideo), pdfPath, inProgress, coverPath(not yet)
- Track: filePath(unique), completed, tempo, timeSignature, pdfPage, chapterId
- JamTrack: standalone, has markers, tabSyncPoints, pdfPath, tabPath
- Video model: YouTube videos (separate from BookVideo which are local files)

## Jam Tracks Architecture (Current State)
- **Storage**: `music/JamTracks/<track-name>/` - each track gets its own subfolder
- **Audio**: One audio file per folder (mp3/flac/wav/ogg/m4a/aac)
- **PDF**: Single `sheet.pdf` in folder, stored as `JamTrack.pdfPath`
- **Tab**: Guitar Pro files (.gp/.gp3/.gp4/.gp5/.gpx) stored as `JamTrack.tabPath`
- **Sync**: `TabSyncPoint` model maps audioTime -> tabTick for cursor sync
- **AlphaTab**: `@coderline/alphatab` (^1.8.1), fonts in `public/fonts/alphatab/`
- **API routes**: jamtracks/, [id]/, [id]/markers/, [id]/pdf/, [id]/tab/, [id]/syncpoints/, tab/[...path]
- **Library API**: Returns jamTracks with markers + tabSyncPoints includes
- **Scan**: `scanJamTracksFolder()` detects first audio + first PDF in each subfolder

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
- `react-pdf`, `wavesurfer.js`, `@coderline/alphatab` [PLANNED FOR REMOVAL]

## Utility Libraries
- `src/lib/clickGenerator.ts`, `src/lib/tapTempo.ts`
- `src/lib/tabSync.ts` [PLANNED FOR REMOVAL]

## Docker
- Alpine-based Node 20, includes openssl, ghostscript, ffmpeg
- Volumes: music/ and prisma/ directories persisted

## Feature Planning Notes
- Existing plans in `tasks/todo.md` - numbered 1-11 (no #5 or #9)
- Features #1-4, #6-8, #10 are Low/Medium complexity
- Feature #11 (Jam Track Rework) is High complexity, 9-phase plan
- #11 now includes Page Sync (PageSyncPoint model -> JamTrackPdf, auto page-flip, PageSyncEditor)
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
