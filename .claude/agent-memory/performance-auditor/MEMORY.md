# Performance Auditor Memory

## Project Architecture
- Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Prisma/SQLite
- Single catch-all route `[[...section]]` with ~1555 lines in `page.tsx`
- Heavy components: `page.tsx` (1555), `TrackListView.tsx` (1283), `BottomPlayer.tsx` (861), `Player.tsx` (690)
- `Player.tsx` appears to be legacy/unused (uses old naming: Song/Artist/Album)
- Runs in Docker with Ghostscript

## Key Performance Findings (2026-02-06)
See [audit-findings.md](./audit-findings.md) for full details.

### Critical
1. Entire library fetched as one monolithic JSON blob (`/api/library`) - all authors, books, tracks, markers, chapters, videos loaded at once
2. Marker operations trigger full `authors` array deep-clone (O(authors*books*tracks)) for single marker changes
3. Inline arrow functions on BottomPlayer props create new references every render, defeating memoization
4. `Player.tsx` is dead code (690 lines) still bundled - uses old `Song/Artist/Album` types

### High
5. Missing database indexes on `Track.bookId`, `Track.chapterId`, `Marker.trackId`, `JamTrackMarker.jamTrackId`, `BookVideo.bookId`, `BookVideo.chapterId`
6. N+1 upserts in library scan route (sequential awaits in loops)
7. Audio streaming lacks caching headers
8. `currentTrack` lookup iterates all authors->books->tracks on every render
9. `AlphaTabViewer.tsx` has 15+ console.log debug statements in production code
10. No `React.memo` on most components receiving complex props

### Medium
11. PDF URL uses `Date.now()` busting browser cache on every re-render
12. Scroll handler in BottomPlayer sets state on every scroll event (no throttle)
13. `react-pdf` worker loaded from unpkg CDN - should be self-hosted
14. Heavy server-only deps (`fluent-ffmpeg`, `music-metadata`, `node-id3`, `node-taglib-sharp`, `wavefile`) must be tree-shaken
15. `onMarkerBarStateChange` effect fires on every `currentTime` change (~20 times/sec)

### Low
16. `sort()` called in render on markers without memoization
17. Missing `loading.tsx` / `error.tsx` route boundaries
18. `BookCover` uses `<img>` instead of `next/image`
19. Metronome AudioContext not cleaned up on unmount

## Dependency Sizes (node_modules)
- @coderline/alphatab: 15M
- fluent-ffmpeg: 13M (server-only)
- node-taglib-sharp: 7.5M (server-only)
- wavesurfer.js: 1.5M
- music-metadata: 1.2M (server-only)
- react-pdf: 612K
- wavefile: 432K (server-only)
- node-id3: 248K (server-only)
