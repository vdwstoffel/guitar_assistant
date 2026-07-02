# Backing Tracks — Design

**Status**: Approved, ready for implementation planning
**Date**: 2026-07-02

## 1. Summary

A new `/backing-tracks` section where the user pastes a YouTube URL, picks a root note + scale type, and gets an embedded YouTube player next to a slim fretboard showing the chosen scale. Saved backing tracks form a library so the user can return to a jam and its associated scale later.

## 2. Goals & non-goals

**Goals**
- Paste a YouTube URL → embedded player + fretboard-with-scale, minimal friction.
- Persist backing tracks with their chosen scale so a practice session is one click away next time.
- Reuse the existing fretboard rendering — no visual drift between `/fretboard` and the new section.

**Non-goals (deferred)**
- Looping/scrubbing sections of the YouTube video via the iframe API.
- Audio-based key detection.
- Tags, folders, search, or filtering on the backing-tracks list.
- Multiple scales attached to a single backing track.
- Downloading YouTube audio (that already exists as JamTracks; this feature is deliberately embed-only).

## 3. UX flow

- **Sidebar**: new "Backing Tracks" entry, alongside Fretboard / JamTracks. Adds a `'backing-tracks'` value to the `Section` union in `src/app/[[...section]]/page.tsx`.
- **List view**: grid of saved tracks — YouTube thumbnail, title, scale label ("A Minor Pentatonic"). Empty state prompts "Add your first backing track". Clicking a card opens the detail view.
- **Add flow**: "+ Add" button opens a modal with:
  - YouTube URL input
  - Title (auto-fetched via `yt-dlp --dump-json`, editable; manual entry if fetch fails)
  - Root note dropdown (values from `NOTES` in `src/lib/musicTheory.ts`)
  - Scale type dropdown (keys from `SCALE_FORMULAS`)
  - Save → POST → list refetches → new track selected.
- **Detail view**: YouTube iframe + slim fretboard side-by-side on wide screens, stacked on narrow. Above the fretboard: Root and Scale-type dropdowns. Changing either updates the fretboard immediately and PATCHes the record (debounced 300ms).
- **Actions on detail**: edit title, delete (confirm dialog), back-to-list.

## 4. Architecture

```
src/components/
├── BackingTracks/
│   ├── BackingTracksView.tsx       # list + orchestrator, owns tracks state
│   ├── BackingTrackList.tsx        # thumbnail grid
│   ├── BackingTrackDetail.tsx      # player + slim fretboard layout
│   ├── BackingTrackFretboard.tsx   # slim variant: <FretboardDisplay/> + root/scale selectors
│   ├── AddBackingTrackModal.tsx    # URL/title/root/scale inputs, calls POST
│   ├── YouTubeEmbed.tsx            # <iframe> wrapper (takes videoId, builds embed URL)
│   └── index.ts
└── Fretboard.tsx                    # refactored: composes new FretboardDisplay

src/components/ScaleExplorer/
└── FretboardDisplay.tsx             # NEW — pure render primitive (extracted from Fretboard.tsx)

src/app/api/backing-tracks/
├── route.ts                         # GET (list), POST (create)
└── [id]/route.ts                    # GET, PATCH, DELETE

src/lib/youtube.ts                    # extractVideoId(url), buildEmbedUrl(id), thumbnailUrl(id)
```

### Refactor: FretboardDisplay primitive

`src/components/Fretboard.tsx` is 521 lines and mixes render logic with toolbar state (note trainer, comparison, pentatonic selector). We split the pure "6 strings × 15 frets + note dots + inlays" render into `FretboardDisplay.tsx`. Both callers compose it:

- Existing `/fretboard` page: `FretboardDisplay` + `FretboardToolbar` + `NoteTrainer` + comparison controls (behavior unchanged).
- New `/backing-tracks` detail view: `FretboardDisplay` + a minimal 2-dropdown toolbar in `BackingTrackFretboard`.

Input contract for `FretboardDisplay`:
```ts
interface FretboardDisplayProps {
  notesToShow: NoteDisplayInfo[];   // already-computed per-fret notes to render
  numFrets?: number;                // default 15
  showDegreeColors?: boolean;
  isComparing?: boolean;
}
```
Callers precompute `notesToShow` via existing helpers in `src/lib/musicTheory.ts`. `FretboardDisplay` is pure render — no scale/root state of its own.

## 5. Data model

New Prisma model in `prisma/schema.prisma`:

```prisma
model BackingTrack {
  id           String   @id @default(uuid())
  youtubeUrl   String   @unique
  videoId      String
  title        String
  thumbnailUrl String?
  rootNote     String
  scaleType    String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

Notes:
- `youtubeUrl @unique` prevents duplicate entries.
- `videoId` is the extracted YouTube id, stored so we don't re-parse on every render.
- `thumbnailUrl` computed on create as `https://img.youtube.com/vi/{videoId}/hqdefault.jpg` (deterministic YouTube CDN URL — no network call).
- `rootNote` valid values: the strings in `NOTES` from `src/lib/musicTheory.ts` (e.g. `"A"`, `"C#"`).
- `scaleType` valid values: keys of `SCALE_FORMULAS` (e.g. `"Minor Pentatonic"`, `"Blues"`, `"Dorian"`).
- No relations to Author / Book / Track / JamTrack. Backing tracks stand alone.

**Migration**: standard `prisma migrate dev --name add-backing-tracks`. Per CLAUDE.md database-safety rules, back up `prisma/guitar_assistant.db` first.

## 6. API

| Method | Path                       | Body                                                | Returns              | Status codes                                                    |
|--------|----------------------------|-----------------------------------------------------|----------------------|-----------------------------------------------------------------|
| GET    | `/api/backing-tracks`      | —                                                   | `BackingTrack[]`     | 200                                                             |
| POST   | `/api/backing-tracks`      | `{ url, title?, rootNote, scaleType }`              | `BackingTrack`       | 201 / 400 (invalid input) / 409 `{ existingId }` / 422 `{ needsTitle: true }` |
| PATCH  | `/api/backing-tracks/[id]` | `{ title?, rootNote?, scaleType? }`                 | `BackingTrack`       | 200 / 400 / 404                                                 |
| DELETE | `/api/backing-tracks/[id]` | —                                                   | `{ success: true }`  | 200 / 404                                                       |

Validation rules (server-side):
- `url` must match the YouTube URL regex already used in `src/app/api/jamtracks/youtube/route.ts` (extracted to `src/lib/youtube.ts` as part of this feature).
- `rootNote` must be in `NOTES`.
- `scaleType` must be a key of `SCALE_FORMULAS`.
- If `title` is omitted on POST, call `yt-dlp --dump-json <url>` (30s timeout). On failure return `422 { needsTitle: true }` so the modal can re-prompt with a manual title.

## 7. Data flow

```
AddBackingTrackModal
  ├─ user fills URL + rootNote + scaleType
  └─ POST /api/backing-tracks
        ├─ validate URL / extract videoId
        ├─ fetch title via yt-dlp (unless supplied)
        │    └─ on failure → 422 { needsTitle: true } → modal shows title field
        ├─ compute thumbnailUrl
        ├─ prisma.backingTrack.create
        │    └─ on unique-URL collision → 409 { existingId } → modal offers "open existing"
        └─ 201 → BackingTracksView refetches list, selects new track

BackingTrackDetail
  ├─ user changes rootNote or scaleType dropdown
  ├─ local state updates immediately (fretboard rerenders)
  └─ debounced 300ms → PATCH /api/backing-tracks/[id]
        └─ parent updates its cached list on success

BackingTrackDetail
  └─ user clicks delete → confirm dialog → DELETE → list refetches → back to list view
```

`BackingTracksView` owns `tracks: BackingTrack[]` and `selectedId: string | null`. Same pattern as `JamTracksView`.

## 8. Edge cases & error handling

- **Invalid URL**: modal shows inline error, does not POST.
- **Duplicate URL**: API returns `409 { existingId }`; UI shows "Already added — open it?" with a link that selects the existing track.
- **yt-dlp missing / errors**: modal falls back to manual title field (mirrors `jamtracks/youtube` flow).
- **YouTube video later removed**: iframe shows its own "video unavailable" state; we don't proactively health-check. User can delete the entry.
- **YouTube autoplay policy**: iframe loads paused (default). User clicks play. No special handling needed.
- **Docker**: `yt-dlp` is already installed in the container for the existing JamTracks YouTube import. No Dockerfile change required.
- **Refactor safety**: extracting `FretboardDisplay` must not change the `/fretboard` page's rendered output. Snapshot the current page (screenshot or DOM) before refactor, compare after.

## 9. Testing

- **Unit** — `src/lib/youtube.ts`:
  - `extractVideoId` handles `youtu.be/<id>`, `youtube.com/watch?v=<id>`, `youtube.com/shorts/<id>`, `music.youtube.com/watch?v=<id>`, and rejects non-YouTube URLs.
  - `buildEmbedUrl` produces the expected `https://www.youtube.com/embed/<id>` URL.
- **API** — `src/app/api/backing-tracks`:
  - POST rejects invalid URL, invalid `rootNote`, invalid `scaleType`.
  - POST with duplicate URL returns 409 with `existingId`.
  - POST without title falls back correctly when yt-dlp fails.
  - PATCH allows partial updates; PATCH validates `rootNote` / `scaleType`.
  - DELETE removes the row.
- **Component** (light) — `BackingTrackFretboard`:
  - Rendering `(A, Minor Pentatonic)` produces the expected set of note positions (snapshot).
- **Refactor regression** — `Fretboard.tsx` after extraction:
  - `/fretboard` page renders the same note dots for a fixed root/scale before and after refactor (visual snapshot or a headless render assertion).
- **Manual** — in browser:
  - Paste URL → add → embed plays → change root/scale dropdowns → dots update → refresh page → state persisted → delete → gone from list.

## 10. Files touched (summary)

**New**
- `src/components/BackingTracks/*` (7 files listed in §4)
- `src/components/ScaleExplorer/FretboardDisplay.tsx`
- `src/lib/youtube.ts`
- `src/app/api/backing-tracks/route.ts`
- `src/app/api/backing-tracks/[id]/route.ts`
- `prisma/migrations/<timestamp>_add_backing_tracks/migration.sql`

**Modified**
- `prisma/schema.prisma` — add `BackingTrack` model
- `src/components/Fretboard.tsx` — refactor to compose `FretboardDisplay`
- `src/app/[[...section]]/page.tsx` — add `'backing-tracks'` to `Section` union, wire the view
- Sidebar component(s) — add "Backing Tracks" entry
- `src/types/index.ts` — export `BackingTrack` type

**Unchanged / reused**
- `src/lib/musicTheory.ts` — `NOTES`, `SCALE_FORMULAS`, `useFretboardEnhancements`, note-computation helpers.
- Existing YouTube URL regex from `src/app/api/jamtracks/youtube/route.ts` (moved into `src/lib/youtube.ts` and imported from both locations).
