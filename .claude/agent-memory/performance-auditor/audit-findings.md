# Full Performance Audit Findings - 2026-02-06

Detailed audit findings with file paths, line numbers, and recommended fixes.
See MEMORY.md for the summary index.

## Finding Details

### [CRITICAL-1] Monolithic library fetch loads entire database into client memory
- File: `/src/app/api/library/route.ts` (lines 6-55)
- File: `/src/app/[[...section]]/page.tsx` (line 155-156)
- All authors, books, tracks, markers, chapters, videos fetched in one query
- Deeply nested Prisma includes: Author -> Book -> Track -> Marker, Book -> Chapter -> Track -> Marker, Book -> Video
- Impact: If library has 10 authors, 50 books, 500 tracks with markers each, the JSON response could be several MB
- Recommendation: Fetch incrementally - authors list first, then books on author select, then tracks on book select

### [CRITICAL-2] Deep-clone of entire authors array on every marker operation
- File: `/src/app/[[...section]]/page.tsx` (lines 360-499)
- Every `handleMarkerAdd`, `handleMarkerUpdate`, `handleMarkerRename`, `handleMarkerDelete`, `handleMarkersClear`
- Creates new object for EVERY author, book, and track even when only one marker changed
- Impact: O(total_authors * total_books * total_tracks) object allocations per marker drag

### [CRITICAL-3] Inline arrow functions on BottomPlayer defeat memoization
- File: `/src/app/[[...section]]/page.tsx` (lines 1382-1426)
- 5 inline arrow functions in BottomPlayer props (onMarkerAdd, onMarkerUpdate, etc.)
- Each creates new function reference every render, causing BottomPlayer to re-render
- Plus `onTimeUpdate` and `onSeekReady` are also inline

### [CRITICAL-4] Dead code: Player.tsx (690 lines) still in bundle
- File: `/src/components/Player.tsx` (all 690 lines)
- Uses old types: Song, Artist, Album (from backwards compat aliases)
- Imported nowhere in the codebase - but bundler may still include it
- Contains duplicate WaveSurfer initialization logic

### [HIGH-5] Missing database indexes
- File: `/prisma/schema.prisma`
- Missing indexes: Track.bookId, Track.chapterId, Marker.trackId, JamTrackMarker.jamTrackId, BookVideo.bookId, BookVideo.chapterId
- Only TabSyncPoint.jamTrackId has an explicit index
- Impact: All relational queries do full table scans on foreign keys

### [HIGH-6] Sequential N+1 upserts in library scan
- File: `/src/app/api/library/scan/route.ts` (lines 389-461)
- Nested loops with individual `await prisma.*.upsert()` calls
- For 500 tracks: 500 individual DB round trips
- Recommendation: Use `prisma.$transaction()` or batch operations

### [HIGH-7] Audio streaming lacks caching headers
- File: `/src/app/api/audio/[...path]/route.ts` (lines 72-78)
- No Cache-Control, ETag, or Last-Modified headers on audio responses
- Each play/seek causes full re-fetch from server
- PDF route has ETag but audio route does not

### [HIGH-8] Inefficient currentTrack lookup
- File: `/src/app/[[...section]]/page.tsx` (lines 59-68, 75-93)
- `currentTrack`, `currentAuthor`, `currentBook` each independently iterate all authors->books->tracks
- Three O(N) scans when one would suffice
- Recommendation: Single useMemo that returns {track, author, book} tuple

### [HIGH-9] Debug console.logs in production
- File: `/src/components/AlphaTabViewer.tsx` (lines 132-138, 152-154, 157-159, 193-201, 275-281, 287)
- 15+ console.log statements with [AlphaTab] and [Click] and [Score] prefixes
- Impact: Console pollution, minor performance overhead during playback

### [HIGH-10] Missing React.memo on key components
- Components receiving complex objects that don't change often lack memoization:
  - AuthorSidebar, BookGrid, InProgressGrid, TrackListView, JamTracksView, MarkersBar, TopNav
- AuthorSidebar receives entire `authors` array and re-renders when ANY state in page.tsx changes

### [MEDIUM-11] PDF URL cache-busting with Date.now()
- File: `/src/components/PdfViewer.tsx` (line 54)
- `useMemo(() => \`/api/pdf/...\?v=\${Date.now()}\`, [pdfPath, version])`
- Date.now() used as dep-independent cache buster, but the real issue is it defeats browser caching
- Should use stable version number or ETag-based caching instead

### [MEDIUM-12] Scroll handler in BottomPlayer without throttle
- File: `/src/components/BottomPlayer.tsx` (lines 314-336)
- `handleScroll` sets `scrollLeft` state on every scroll event
- `handleResize` registered globally on window without debounce
- Impact: Unnecessary re-renders during waveform scrolling

### [MEDIUM-13] react-pdf worker from CDN
- File: `/src/components/PdfViewer.tsx` (lines 18-22)
- Worker loaded from `unpkg.com` - adds network dependency and latency
- Should self-host the worker file for Docker deployments

### [MEDIUM-14] Server-only deps potentially in client bundle
- File: `/package.json`
- `fluent-ffmpeg`, `music-metadata`, `node-id3`, `node-taglib-sharp`, `wavefile` are server-only
- These should be in `next.config.ts` serverExternalPackages or verified as tree-shaken
- Total: ~22MB of node_modules that should never reach the browser

### [MEDIUM-15] onMarkerBarStateChange fires at ~20Hz during playback
- File: `/src/components/BottomPlayer.tsx` (lines 510-548)
- Effect depends on `currentTime` which updates every 50ms
- Creates new MarkerBarState object and calls parent callback 20 times/sec
- 16ms debounce partially mitigates but still creates many objects

### [LOW-16] Unsorted marker arrays re-sorted every render
- File: `/src/components/BottomPlayer.tsx` (line 796)
- File: `/src/components/MarkersBar.tsx` (line 229)
- `.sort()` called in JSX on every render without memoization
- Mutates array in place (should use `toSorted()` or memoize)

### [LOW-17] Missing route boundaries
- No `loading.tsx` or `error.tsx` in the app directory
- No Suspense boundaries around heavy components (PdfViewer, AlphaTabViewer)

### [LOW-18] BookCover uses img instead of next/image
- File: `/src/components/TrackListView.tsx` (line 32-34)
- Uses raw `<img>` tag for album art, missing Next.js image optimization
- Has `loading="lazy"` which helps, but misses format conversion/resizing

### [LOW-19] Metronome AudioContext not cleaned up
- File: `/src/components/Metronome.tsx` (lines 142-149)
- Timer is cleaned up but AudioContext is never closed
- Minor leak when navigating away from metronome section

### [LOW-20] `setCurrentJamTrack` references appear after migration to ID-based state
- File: `/src/app/[[...section]]/page.tsx` (lines 848, 869, 886, etc.)
- Several handlers still call `setCurrentJamTrack()` which no longer exists as a setter
- These are likely runtime errors (silent in production) or the jam track state was not fully migrated
