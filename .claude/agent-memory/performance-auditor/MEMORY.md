# Performance Auditor Memory

## Project Architecture
- Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Prisma/SQLite
- Single catch-all route `[[...section]]` with ~1587 lines in `page.tsx`
- Heavy components: `page.tsx` (1587), `TrackListView.tsx` (1582), `BottomPlayer.tsx` (1022), `JamTracksView.tsx` (629)
- Runs in Docker with Ghostscript

## Memoization Status (Updated 2026-02-12)
| Component | Memoized | Notes |
|-----------|----------|-------|
| BottomPlayer | YES | Uses refs for stable callbacks |
| TrackListView | **NO** | HIGH priority - 1582 lines |
| ChapterSection | **NO** | HIGH priority - renders track lists |
| JamTracksView | YES | |
| BookGrid | YES | |
| BookCard | YES | |
| BookCover (in TrackListView) | YES | |
| InProgressIndicator | YES | Duplicated in 3 files |

## Key Performance Findings

### Critical (2026-02-12)
1. **InProgressIndicator duplicated in 3 files** - TrackListView.tsx L42-92, ChapterSection.tsx L6-56, JamTracksView.tsx L6-56. Each creates own event listener for `playbackSpeedChange`. With many tracks, creates N listeners all firing on every speed change.

### High
2. **TrackListView not memoized** - 1582 lines, re-renders on every parent state change
3. **ChapterSection not memoized** - renders lists of tracks/videos
4. **page.tsx has ~30 useState calls** - state changes cause full re-evaluation of all handlers
5. **Inline arrow functions in JSX** - e.g., `onTrackSelect={(track) => handleTrackSelect(track)}` defeats memo
6. **API over-fetching JamTracks** - `/api/library` fetches full markers/PDFs/syncpoints for listing

### Medium
7. **formatDuration duplicated** - Same function in TrackListView, ChapterSection, JamTracksView
8. **Sorting in render without useMemo** - markers/tracks sorted on every render
9. **Modal components inline in TrackListView** - 4 modals (~500 lines) not lazy loaded
10. **resize event listener not throttled** in PdfViewer.tsx

### Database Indexes (All Present)
- Track: `@@index([bookId])`, `@@index([chapterId])`
- Marker: `@@index([trackId])`
- BookVideo: `@@index([bookId])`, `@@index([chapterId])`
- JamTrackMarker: `@@index([jamTrackId])`
- JamTrackPdf: `@@index([jamTrackId])`
- PageSyncPoint: `@@index([jamTrackPdfId])`

## Positive Patterns Present
- Prisma singleton correctly implemented at `/src/lib/prisma.ts`
- react-pdf uses dynamic import with `ssr: false`
- BottomPlayer debounces timeupdate (>50ms threshold)
- BottomPlayer uses refs to avoid callback reference churn
- PDF worker now self-hosted at `/public/pdf.worker.min.mjs`

## Quick Win Priorities
1. Add `memo()` to TrackListView and ChapterSection (5 min)
2. Extract InProgressIndicator to shared component (30 min)
3. Remove inline arrow wrappers in page.tsx JSX (10 min)

## AlphaTab Integration (2026-02-14)
- Package: `@coderline/alphatab` v1.8.1
- Files: `src/components/tab-editor/AlphaTabRenderer.tsx`, `src/components/TabEditor.tsx`
- API types: `src/types/tab.ts`, tab routes at `src/app/api/tabs/`
- **CRITICAL BUG**: `renderTracks()` fires `scoreLoaded` event (documented in alphaTab.d.ts L2257). Calling `renderTracks()` inside `scoreLoaded` handler creates infinite loop -> 10GB memory.
- **CRITICAL BUG**: `selectedTrackIndices` array in useEffect deps causes full API destroy/recreate on every track switch (array reference inequality).
- **FIX PATTERN**: Use `isRenderingTracksRef` guard to break recursion; separate init effect (fileUrl only) from track-filter effect (trackKey string).
- **FIX PATTERN**: Store callback props in refs to avoid stale closures in alphaTab event handlers.
- Debug setTimeout (3s) in scoreLoaded handler fires hundreds of times during loop - should be removed.

## File Locations Reference
- Main state: `/src/app/[[...section]]/page.tsx`
- Track listing: `/src/components/TrackListView.tsx`
- Chapter rendering: `/src/components/ChapterSection.tsx`
- Library API: `/src/app/api/library/route.ts`
- Audio player: `/src/components/BottomPlayer.tsx`
- PDF viewer: `/src/components/PdfViewer.tsx`
- Tab editor: `/src/components/TabEditor.tsx`
- AlphaTab renderer: `/src/components/tab-editor/AlphaTabRenderer.tsx`
