# Jam Tracks Redesign + Decoupled Page-Flip Automations

**Date:** 2026-08-09
**Status:** Approved (design)

## Problem

The current Jam Tracks UX is awkward:

- The list of jam tracks disappears once a track is selected; switching tracks
  requires a top-right dropdown (`JamTrackCompactSelector`).
- The detail view renders a single interactive **Guitar Pro** tab (`gpFilePath`
  via AlphaTab / `GuitarProViewer`), showing "No Guitar Pro tab attached" when
  none exists. This is not what the user wants.

The user wants a persistent master-detail layout with a **PDF-based** tab viewer
that behaves exactly like the Lessons PDF viewer, supports **multiple named PDFs
per song** with tab switching + upload, and a full-width waveform at the bottom.

Separately, PDF page-flipping during playback is currently coupled to markers
(`Marker.pdfPage`). The user wants page-flips to be their own automation,
created with a **P** shortcut, and this decoupling applied to Lessons too.

## Goals

1. Replace the Jam Tracks detail UX with a persistent master-detail layout.
2. Replace Guitar Pro tab support with multiple named PDFs per jam track.
3. Reuse the Lessons `PdfViewer` for identical viewing behavior.
4. Decouple page-flip automations from markers; create them with **P**.
5. Apply the new page-flip automation model to Lessons as well.

## Non-goals (YAGNI now)

- PDF thumbnails, per-PDF zoom beyond what Lessons already offers.
- Any Guitar Pro / AlphaTab functionality (removed entirely for jam tracks).
- Sync-point "editor" beyond create (P) / edit-target-page / delete on the waveform.

---

## Decisions (from brainstorming)

- **GP vs PDF:** Replace with **PDF only**. Guitar Pro support for jam tracks is
  removed.
- **Layout:** **List left, PDF right**, waveform full-width at the bottom. The
  list is always visible; selecting a track does not collapse it.
- **Markers:** Rendered **on the waveform only** (clickable flags). No separate
  markers list/sidebar in the jam-track view.
- **PDF behavior:** The right panel behaves **the same as Lessons** — reuse the
  existing single-PDF `PdfViewer` (fit-to-page / continuous-scroll modes,
  prev/next, page count, virtual rendering), wrapped in a tab bar that selects
  which named PDF is active.
- **Page-flip:** A **separate automation** from markers. Shortcut **P** opens a
  modal pre-filled with the current visible page. Applies to Jam Tracks and
  Lessons.
- **Existing marker page data:** **Migrate then remove** — convert each
  `Marker.pdfPage` into a standalone page-flip automation, then drop the field.

---

## Layout & UX

```
+-------------+--------------------------------------+
| Jam Tracks  |  [Rhythm][Lead][+ Add PDF]  (tabs)   |
| + Upload/YT |  +--------------------------------+   |
|             |  |                                |   |
| > Sabbath   |  |         PDF page               |   |
| > Dimmu     |  |    (Lessons PdfViewer)         |   |
| > Judas  *  |  |    prev / 1 of 3 / next        |   |
| > Slayer    |  |                                |   |
| > S.O.Heaven|  +--------------------------------+   |
+-------------+--------------------------------------+
| |>  ⟲  A/B   ~~~~ waveform w/ marker + flip flags ~~~~ 0:00/4:58 |
+-----------------------------------------------------------------+
```

- **Left rail (`JamTrackList`):** persistent, scrollable list of jam tracks with
  selection highlight. Upload + YouTube buttons at the top. Clicking a row loads
  it into the PDF panel and waveform without collapsing the list.
- **Right panel (`JamTrackPdfPanel`):** a tab bar with one tab per named PDF plus
  a `＋ Add PDF` action; below it, the reused Lessons `PdfViewer` rendering the
  active tab's PDF. Each tab keeps its own current page. Manual paging.
- **Bottom:** existing `BottomPlayer` in `compact` mode, full width. Markers and
  page-flip automations render as flags on the waveform (distinct styles).

---

## Data model (Prisma)

### New: `JamTrackPdf`

```prisma
model JamTrackPdf {
  id         String              @id @default(uuid())
  name       String
  filePath   String
  sortOrder  Int                 @default(0)
  jamTrackId String
  jamTrack   JamTrack            @relation(fields: [jamTrackId], references: [id], onDelete: Cascade)
  pageFlips  JamTrackPageFlip[]
  createdAt  DateTime            @default(now())

  @@index([jamTrackId])
}
```

- `JamTrack` gains `pdfs JamTrackPdf[]`.
- **Remove `gpFilePath`** from `JamTrack` (SQLite → table-recreate migration).
- PDF files stored on disk alongside the audio:
  `JamTracks/{title}/{sanitized-name}.pdf`.

### New: page-flip automations

```prisma
model JamTrackPageFlip {
  id            String      @id @default(uuid())
  timestamp     Float
  pdfPage       Int
  jamTrackPdfId String
  jamTrackPdf   JamTrackPdf @relation(fields: [jamTrackPdfId], references: [id], onDelete: Cascade)

  @@index([jamTrackPdfId])
}

model TrackPageFlip {
  id        String @id @default(uuid())
  timestamp Float
  pdfPage   Int
  trackId   String
  track     Track  @relation(fields: [trackId], references: [id], onDelete: Cascade)

  @@index([trackId])
}
```

- Jam-track page flips belong to the **active PDF tab** (`jamTrackPdfId`) — each
  PDF has its own flips.
- Lessons page flips belong to the `Track`.
- **Remove `Marker.pdfPage`** after data migration (see Migration below).

---

## API

### Jam-track PDFs

- `POST   /api/jamtracks/[id]/pdf` — upload file + name → creates `JamTrackPdf`.
- `PATCH  /api/jamtracks/[id]/pdf/[pdfId]` — rename.
- `DELETE /api/jamtracks/[id]/pdf/[pdfId]` — remove (deletes file + record).
- PDF bytes served by the **existing** `/api/pdf/[...path]` route (same as Lessons).

### Page-flip automations

- Jam tracks: `POST/PATCH/DELETE /api/jamtracks/[id]/pdf/[pdfId]/pageflips[/[flipId]]`.
- Lessons: `POST/PATCH/DELETE /api/tracks/[id]/pageflips[/[flipId]]`
  (mirror the existing marker route shape).

### Library scan

- `/api/library/scan` auto-discovers `*.pdf` files in each `JamTracks/{title}/`
  folder and upserts `JamTrackPdf` rows.

### Removed

- `/api/jamtracks/[id]/gp` (POST/DELETE), `/api/gp/*`.

---

## Components

- **`JamTrackList`** — persistent left rail: rows, selection, upload/YouTube
  buttons. Extracted from today's `JamTracksView`.
- **`JamTrackPdfPanel`** — tab bar (named PDFs + `＋ Add PDF`), upload/name
  dialog, and the reused Lessons `PdfViewer`. Owns per-tab page state and the
  active-tab concept used by page-flip playback.
- **`PageFlipDialog`** — modal for creating/editing a page-flip; target-page
  input pre-filled with the current visible page.
- **`page.tsx`** — rewire the `jamtracks` section to master-detail (list left,
  panel right, `BottomPlayer` compact full-width bottom).

### Removed components

- `GuitarProViewer.tsx`
- `JamTrackCompactSelector.tsx`
- The expand-in-place detail block inside `JamTracksView.tsx`.

---

## Page-flip automation behavior (Jam Tracks + Lessons)

### Create

- Press **P** during playback (handled in `BottomPlayer` keydown; P is confirmed
  free). Opens `PageFlipDialog`, target page pre-filled with the currently
  visible PDF page. Save → create an automation at the current audio time via the
  relevant API.
- BottomPlayer receives the current visible page + an "open page-flip dialog"
  path, mirroring how the marker dialog is wired today.

### Playback

- A new effect reads page-flip automations (replacing the `marker.pdfPage`
  effect at `page.tsx` ~1761-1790): reverse-scan for the last automation whose
  `timestamp - offset` has been passed and set the PDF page.
- Keep the existing **anticipation** toggle (1s early) in `MarkersBar`; it now
  governs page-flips.
- Jam Tracks: use the **active PDF tab's** automations.

### Manage

- Automations render on the waveform as **distinct flags** (different color +
  `→p{N}` badge) so they read differently from markers. Click a flag → edit
  target page or delete. No separate list.

---

## Migration

1. **Back up the DB first:** `cp prisma/guitar_assistant.db prisma/guitar_assistant.db.backup`.
2. Add `JamTrackPdf`, `JamTrackPageFlip`, `TrackPageFlip`; add `JamTrack.pdfs`.
3. **Data migration:** for every `Marker` with a non-null `pdfPage`, insert a
   `TrackPageFlip { trackId, timestamp, pdfPage }`.
4. Drop `Marker.pdfPage` (SQLite table-recreate) and `JamTrack.gpFilePath`.
5. Remove the `pdfPage` field from `MarkerNameDialog` and the "assign current PDF
   page" UI + `p.{N}` badge in `MarkersBar`. Keep the anticipation toggle.
6. Because `DATABASE_URL` is relative, verify the migration targets
   `prisma/guitar_assistant.db`; apply SQL directly if `migrate deploy` targets
   the wrong path.

---

## Type updates (`src/types/index.ts`)

- New `JamTrackPdf`, `JamTrackPageFlip`, `TrackPageFlip` interfaces.
- `JamTrack`: add `pdfs: JamTrackPdf[]`, remove `gpFilePath`.
- `Track`: add `pageFlips: TrackPageFlip[]`.
- `Marker`: remove `pdfPage`.

---

## Testing

- **Migration:** existing markers with pages produce matching `TrackPageFlip`
  rows; markers survive without `pdfPage`.
- **Jam Tracks:** upload multiple named PDFs; switch tabs; rename/delete a PDF;
  each tab retains its page; list stays persistent across track switches.
- **Page-flip:** P at a position creates an automation at current time defaulting
  to the visible page; playback flips at the right time; anticipation flips 1s
  early; edit/delete via waveform flag works; Jam-track flips are per-PDF.
- **Lessons regression:** auto page-flip still works via the new automations for
  migrated tracks.

---

## Rollout order (for the plan)

1. Schema + migration (with data migration + column drops) and type updates.
2. Jam-track PDF API + upload/rename/delete; scan discovery.
3. `JamTrackList` + `JamTrackPdfPanel` + `page.tsx` master-detail rewire; remove
   GP viewer/selector and `/api/gp`.
4. Page-flip API (jam tracks + tracks), `PageFlipDialog`, P shortcut, playback
   effect, waveform flags; strip marker `pdfPage` UI.
5. README/docs update; delete any related `tasks/` file.
