# Agent Memory - Modular Code Architect

## Project Architecture
- **Stack**: Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Prisma ORM with SQLite
- **Main page component**: `src/app/[[...section]]/page.tsx` - the Home component (~1500 lines, monolithic)
- **BottomPlayer**: `src/components/BottomPlayer.tsx` (~861 lines) - now wrapped with `React.memo()`
- **Pre-existing TS errors**: Buffer type issue in albumart route, Marker/JamTrackMarker type incompatibility in BottomPlayer.tsx:797 and MarkersBar.tsx:231
- **Pre-existing lint errors**: refs-during-render pattern at BottomPlayer.tsx:507 (`onMarkerBarStateChangeRef.current = ...`)

## Patterns Used in This Codebase
- **Ref pattern for stable values**: `const someRef = useRef(value); someRef.current = value;` used to keep handler functions accessible from stable `useCallback` hooks (see `selectedBookIdRef` in page.tsx as original example)
- **Handler functions**: Most handler functions in page.tsx are plain `async` declarations (not wrapped in useCallback). When passing to memoized children, use ref + useCallback pattern.
- **State setters are stable**: React `useState` setters (e.g., `setMarkerBarState`) are inherently stable and safe to pass directly as props.

## Performance Fixes Applied
- **CRITICAL-3**: Inline arrow functions on BottomPlayer - Fixed by:
  1. Creating refs for `currentJamTrack` and all 10 handler functions
  2. Creating 7 stable `useCallback` wrappers with `[]` deps that read from refs
  3. Wrapping `BottomPlayer` with `React.memo()` (import `memo` from react, separate function declaration from export)
  - Result: BottomPlayer no longer re-renders at 20Hz from time updates

## Key Terminology
- Artist -> Author, Album -> Book, Song -> Track (recent migration)
- JamTracks are standalone play-along tracks outside the Author -> Book hierarchy

## File Organization Notes
- `src/types/index.ts` - TypeScript interfaces (Author, Book, Track, Marker, JamTrack, etc.)
- `src/lib/prisma.ts` - Prisma client singleton
- `src/lib/clickGenerator.ts` - Audio click generation for count-in
