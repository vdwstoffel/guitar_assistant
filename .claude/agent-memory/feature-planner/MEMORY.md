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

## Database (Prisma/SQLite)
- Author -> Books -> Tracks -> Markers (cascade deletes)
- Book also has: chapters, videos (BookVideo), pdfPath, inProgress, coverPath(not yet)
- Track: filePath(unique), completed, tempo, timeSignature, pdfPage, chapterId
- JamTrack: standalone, has markers, tabSyncPoints, pdfPath, tabPath
- Video model: YouTube videos (separate from BookVideo which are local files)

## API Patterns
- All routes in `src/app/api/`
- PATCH for partial updates, PUT for full updates
- POST for creation, DELETE for removal
- FormData for file uploads, JSON for data
- `prisma` singleton from `src/lib/prisma.ts`

## Dependencies Already Available
- `fluent-ffmpeg` + ffmpeg binary (in Docker) - for video/audio processing
- `music-metadata` - audio file metadata parsing
- `node-id3` + `node-taglib-sharp` - metadata writing (MP3, M4A)
- `react-pdf` - PDF rendering
- `wavesurfer.js` - audio waveform
- `@coderline/alphatab` - guitar tab rendering

## Utility Libraries
- `src/lib/clickGenerator.ts` - generates metronome count-in clicks
- `src/lib/tapTempo.ts` - tap tempo detection
- `src/lib/tabSync.ts` - tab-audio synchronization

## Docker
- Alpine-based Node 20 image
- Includes: openssl, ghostscript (PDF conversion), ffmpeg (video/audio)
- Volumes: music/ and prisma/ directories persisted

## Cover Art Pattern
- Extracted from first track's embedded metadata via `/api/albumart/[...path]`
- In-memory cache with 200 entry limit, 24h TTL
- Fallback: generic music icon SVG in BookCover/BookCard components

## Keyboard Shortcuts (current)
- Space: play/pause (BottomPlayer)
- M: add marker at current time (BottomPlayer)
- R: restart playback (BottomPlayer)
- ArrowLeft: seek to beginning (page.tsx)
