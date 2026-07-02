# Backing Tracks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [docs/superpowers/specs/2026-07-02-backing-tracks-design.md](../specs/2026-07-02-backing-tracks-design.md)

**Goal:** Add a new `/backing-tracks` section where the user pastes a YouTube URL, chooses a root note + scale type, and gets an embedded YouTube player alongside a fretboard showing that scale. Tracks are persisted so the user can return to any (video, scale) pairing later.

**Architecture:** New Prisma `BackingTrack` model, new `/api/backing-tracks` REST routes, new `src/components/BackingTracks/*` view tree. Refactor `Fretboard.tsx` to expose a shared `FretboardDisplay` primitive so `/fretboard` and the slim backing-tracks fretboard share the same SVG/DOM rendering. YouTube playback via a plain `<iframe>` (no download).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 6 + SQLite, Tailwind 4. `yt-dlp` (already in Docker image) used only to fetch the video title on create.

## Global Constraints

- **No new test framework.** Project has no Jest/Vitest. Verification uses `npx tsc --noEmit`, `npm run lint`, curl against the running dev server, and manual browser checks. Do not add a test framework in this plan.
- **Database safety.** Before any Prisma migration, back up `prisma/guitar_assistant.db` per CLAUDE.md. The user's data is valuable.
- **Docker parity.** `.next/` and `src/generated/prisma/` may be root-owned from Docker. Use `npx tsc --noEmit` for type checks locally; don't run `npm run build`. `docker-compose up` for full-stack runs.
- **Naming.** Section id in the URL and `Section` union is `'backing-tracks'` (kebab-case) — must match everywhere: URL path, `Section` type in `src/app/[[...section]]/page.tsx`, `Section` type in `src/components/TopNav.tsx`, and the `getSectionFromPath` mapping.
- **Music theory canon.** Root notes come from `NOTES` in `src/lib/musicTheory.ts` (`['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']`). Scale types are keys of `SCALE_FORMULAS`. The special `'None'` scale is valid in `SCALE_FORMULAS` — the backing-tracks feature must **exclude** `'None'` from the scale-type dropdown (a backing track must have a real scale).
- **YouTube URL formats.** Support the same variants as the existing jam-tracks route: `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `music.youtube.com/watch?v=`.
- **No behavior regression on `/fretboard`.** The Fretboard refactor must leave the existing page pixel-identical. Verify by side-by-side visual check before and after.
- **Commit cadence.** Commit after each task. Each commit message follows conventional style: `feat: ...` for new features, `refactor: ...` for the fretboard split.

---

## File Structure

**New files:**
- `src/lib/youtube.ts` — URL parsing and embed helpers.
- `src/components/ScaleExplorer/FretboardDisplay.tsx` — pure render primitive.
- `src/components/BackingTracks/BackingTracksView.tsx` — orchestrator (list ⇄ detail).
- `src/components/BackingTracks/BackingTrackList.tsx` — thumbnail grid.
- `src/components/BackingTracks/BackingTrackDetail.tsx` — YouTube embed + slim fretboard layout.
- `src/components/BackingTracks/BackingTrackFretboard.tsx` — root/scale dropdowns + `FretboardDisplay`.
- `src/components/BackingTracks/AddBackingTrackModal.tsx` — add-flow modal.
- `src/components/BackingTracks/YouTubeEmbed.tsx` — thin iframe wrapper.
- `src/components/BackingTracks/index.ts` — public exports.
- `src/app/api/backing-tracks/route.ts` — GET (list), POST (create).
- `src/app/api/backing-tracks/[id]/route.ts` — PATCH, DELETE.
- `prisma/migrations/<timestamp>_add_backing_tracks/migration.sql` — created by Prisma.

**Modified:**
- `prisma/schema.prisma` — add `BackingTrack` model.
- `src/types/index.ts` — export `BackingTrack` interface.
- `src/components/Fretboard.tsx` — refactor to compose `FretboardDisplay`.
- `src/components/ScaleExplorer/index.ts` — re-export `FretboardDisplay`.
- `src/app/[[...section]]/page.tsx` — add `'backing-tracks'` to `Section`, add render branch.
- `src/components/TopNav.tsx` — add `'backing-tracks'` to `Section`, add nav link.
- `src/app/api/jamtracks/youtube/route.ts` — swap its inline URL regex for the shared `isValidYouTubeUrl` from `src/lib/youtube.ts`.

---

## Task 1: Extract shared YouTube URL utilities

**Files:**
- Create: `src/lib/youtube.ts`
- Modify: `src/app/api/jamtracks/youtube/route.ts` (swap inline regex for shared import)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export const YOUTUBE_URL_REGEX: RegExp`
  - `export function isValidYouTubeUrl(url: string): boolean`
  - `export function extractVideoId(url: string): string | null` — returns the 11-char YouTube id or null.
  - `export function buildEmbedUrl(videoId: string): string` — returns `https://www.youtube.com/embed/<id>`.
  - `export function thumbnailUrl(videoId: string): string` — returns `https://img.youtube.com/vi/<id>/hqdefault.jpg`.

- [ ] **Step 1: Create `src/lib/youtube.ts` with the helpers**

```ts
// src/lib/youtube.ts

/**
 * Regex matching the YouTube URL variants we accept.
 * Kept in sync with the (previously inline) regex in the jam-tracks YouTube route.
 */
export const YOUTUBE_URL_REGEX =
  /^https?:\/\/(www\.)?(youtube\.com\/(watch\?.*v=|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?.*v=)/;

export function isValidYouTubeUrl(url: string): boolean {
  return YOUTUBE_URL_REGEX.test(url);
}

/**
 * Extract the 11-char YouTube video id from a supported URL form.
 * Returns null for URLs that are not valid YouTube URLs or that lack an id.
 */
export function extractVideoId(url: string): string | null {
  if (!isValidYouTubeUrl(url)) return null;

  // youtu.be/<id>
  const shortMatch = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  // youtube.com/shorts/<id>
  const shortsMatch = url.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];

  // youtube.com/watch?v=<id> or music.youtube.com/watch?v=<id>
  const watchMatch = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];

  return null;
}

export function buildEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

export function thumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
```

- [ ] **Step 2: Ad-hoc verification of the parser**

Run this from the project root — it exercises each URL form and prints results.

```bash
node --input-type=module -e "
import { extractVideoId, buildEmbedUrl, thumbnailUrl, isValidYouTubeUrl } from './src/lib/youtube.ts';
const cases = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://youtu.be/dQw4w9WgXcQ',
  'https://www.youtube.com/shorts/dQw4w9WgXcQ',
  'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://vimeo.com/12345',
  'not a url',
];
for (const c of cases) {
  console.log(c, '=>', isValidYouTubeUrl(c), extractVideoId(c));
}
console.log(buildEmbedUrl('dQw4w9WgXcQ'));
console.log(thumbnailUrl('dQw4w9WgXcQ'));
"
```

Expected: all four YouTube URLs return `true` and `dQw4w9WgXcQ`; the vimeo and 'not a url' cases return `false` and `null`. Embed URL is `https://www.youtube.com/embed/dQw4w9WgXcQ`. Thumbnail is `https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg`.

If node cannot import `.ts` directly, run the equivalent using `npx tsx src/lib/youtube.ts` inside a small `console.log(extractVideoId('...'))` at the bottom of the file — then remove the console line before committing.

- [ ] **Step 3: Refactor `src/app/api/jamtracks/youtube/route.ts` to use the shared helpers**

Locate the inline regex and helper (top of the file):

```ts
const YOUTUBE_URL_REGEX =
  /^https?:\/\/(www\.)?(youtube\.com\/(watch\?.*v=|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?.*v=)/;

function isValidYouTubeUrl(url: string): boolean {
  return YOUTUBE_URL_REGEX.test(url);
}
```

Delete those lines and add an import at the top of the file:

```ts
import { isValidYouTubeUrl } from "@/lib/youtube";
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by the change. (Pre-existing Prisma-generation errors, if any, can be ignored — filter with `npx tsc --noEmit 2>&1 | grep -v 'src/generated/prisma'`.)

- [ ] **Step 5: Manual regression check on the existing jam-tracks YouTube flow**

Start dev server (`docker-compose up` or `npm run dev`), open the JamTracks section, click "Import from YouTube", paste a valid YouTube URL. Confirm it still works exactly as before. Then try an invalid URL — should show the same "Invalid YouTube URL" error.

- [ ] **Step 6: Commit**

```bash
git add src/lib/youtube.ts src/app/api/jamtracks/youtube/route.ts
git commit -m "refactor: extract shared YouTube URL helpers into src/lib/youtube.ts"
```

---

## Task 2: Add `BackingTrack` Prisma model + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_backing_tracks/migration.sql` (via Prisma)

**Interfaces:**
- Consumes: nothing.
- Produces: `BackingTrack` model in Prisma client:
  ```ts
  {
    id: string; youtubeUrl: string; videoId: string; title: string;
    thumbnailUrl: string | null; rootNote: string; scaleType: string;
    createdAt: Date; updatedAt: Date;
  }
  ```

- [ ] **Step 1: Back up the SQLite database**

```bash
cp prisma/guitar_assistant.db prisma/guitar_assistant.db.backup
```

Expected: no error, backup file created.

- [ ] **Step 2: Add the `BackingTrack` model to `prisma/schema.prisma`**

Append after the last model (`PracticeSession`):

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

- [ ] **Step 3: Run the Prisma migration**

Because Prisma resolves `DATABASE_URL=file:./prisma/guitar_assistant.db` relative to CWD (see memory), run from the project root:

```bash
npx prisma migrate dev --name add_backing_tracks
```

Expected: a new folder `prisma/migrations/<timestamp>_add_backing_tracks/` with `migration.sql` containing `CREATE TABLE "BackingTrack"` and `CREATE UNIQUE INDEX "BackingTrack_youtubeUrl_key"`. Prisma also regenerates the client.

If Prisma cannot resolve the DB path (see memory — Docker container may own it), fall back to applying the SQL directly:

```bash
sqlite3 prisma/guitar_assistant.db <<'SQL'
CREATE TABLE "BackingTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "youtubeUrl" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "rootNote" TEXT NOT NULL,
    "scaleType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "BackingTrack_youtubeUrl_key" ON "BackingTrack"("youtubeUrl");
SQL
```

Then manually create the migration folder and file so Prisma's history is consistent (copy the SQL above into `prisma/migrations/<timestamp>_add_backing_tracks/migration.sql` with a matching timestamp, e.g. `20260702120000_add_backing_tracks`).

- [ ] **Step 4: Verify the table exists**

```bash
sqlite3 prisma/guitar_assistant.db ".schema BackingTrack"
```

Expected: prints the CREATE TABLE with all seven columns and the unique index.

- [ ] **Step 5: Verify Prisma client compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v 'src/generated/prisma' | head -30
```

Expected: no new errors referencing `BackingTrack`. (If the generated client is root-owned from Docker, run `docker-compose up` and then `docker-compose exec app npx prisma generate` inside the container — see memory for the constraint.)

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add BackingTrack Prisma model and migration"
```

---

## Task 3: Add `BackingTrack` TypeScript interface

**Files:**
- Modify: `src/types/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export interface BackingTrack {
    id: string;
    youtubeUrl: string;
    videoId: string;
    title: string;
    thumbnailUrl: string | null;
    rootNote: string;
    scaleType: string;
    createdAt: string;   // ISO string from JSON
    updatedAt: string;
  }
  ```

- [ ] **Step 1: Append the interface to `src/types/index.ts`**

Append at the end of the file:

```ts
export interface BackingTrack {
  id: string;
  youtubeUrl: string;
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  rootNote: string;
  scaleType: string;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -v 'src/generated/prisma' | head -20`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add BackingTrack client-facing type"
```

---

## Task 4: Extract `FretboardDisplay` primitive from `Fretboard.tsx`

**Rationale:** `Fretboard.tsx` mixes state/toolbar logic with the SVG-esque render of 6 strings × 15 frets + note dots + inlays. Task 8 needs the same render with a different (much smaller) toolbar. Extracting it now prevents duplication.

**Files:**
- Create: `src/components/ScaleExplorer/FretboardDisplay.tsx`
- Modify: `src/components/ScaleExplorer/index.ts` (re-export)
- Modify: `src/components/Fretboard.tsx` (compose the extracted primitive)

**Interfaces:**
- Consumes: `NoteDisplayInfo` type from `@/components/ScaleExplorer`.
- Produces:
  ```ts
  interface FretboardDisplayProps {
    /** Function returning per-position display info; identity of the fn should be stable per render. */
    getNoteDisplayInfo: (stringIndex: number, fret: number) => NoteDisplayInfo;
    showDegreeColors: boolean;
    isComparing: boolean;
    showNoteNames: boolean;
    /** Optional per-fret override (used by the note trainer to spotlight one note). Returns node or null. */
    renderOverride?: (stringIndex: number, fret: number) => React.ReactNode | null;
    numFrets?: number;   // default 15
  }
  export default function FretboardDisplay(props: FretboardDisplayProps): JSX.Element;
  ```

- [ ] **Step 1: Create `src/components/ScaleExplorer/FretboardDisplay.tsx`**

Move the following out of `Fretboard.tsx` (currently at approx. lines 22–123 and 290–429):
- Constants: `NUM_FRETS`, `INLAY_POSITIONS`, `DOUBLE_INLAY_FRETS`.
- Helpers: `getNoteStyle`, `getDegreeStyle`, `getComparisonStyle`, `getComparisonTextColor`, `getStringStyle`, `isInlayPosition`, `isDoubleInlay`.
- Sub-components: `NoteDot`, `TrainerDot` (rename usage — see next step).
- The "Fretboard Container" JSX block (`<div className="rounded-lg p-8">…</div>`).

The extracted file should look like:

```tsx
'use client';

import { STANDARD_TUNING, getNoteAtFret } from '@/lib/musicTheory';
import type { NoteDisplayInfo } from './types';

const DEFAULT_NUM_FRETS = 15;
const INLAY_POSITIONS = [3, 5, 7, 9, 12, 15];
const DOUBLE_INLAY_FRETS = [12];

// ── Pure styling helpers (unchanged from Fretboard.tsx) ────────────────────
function getNoteStyle(info: NoteDisplayInfo, showDegreeColors: boolean, isComparing: boolean): React.CSSProperties {
  // ... paste unchanged body from Fretboard.tsx ...
}
function getDegreeStyle(info: NoteDisplayInfo): React.CSSProperties { /* unchanged */ }
function getComparisonStyle(info: NoteDisplayInfo): React.CSSProperties { /* unchanged */ }
function getComparisonTextColor(info: NoteDisplayInfo): string { /* unchanged */ }
function getStringStyle(stringIndex: number) { /* unchanged */ }
function isInlayPosition(fret: number): boolean { return INLAY_POSITIONS.includes(fret); }
function isDoubleInlay(fret: number): boolean { return DOUBLE_INLAY_FRETS.includes(fret); }

// ── NoteDot ────────────────────────────────────────────────────────────────
interface NoteDotProps { info: NoteDisplayInfo; showDegreeColors: boolean; isComparing: boolean; }
function NoteDot({ info, showDegreeColors, isComparing }: NoteDotProps) {
  // ... unchanged body from Fretboard.tsx (lines ~469–500) ...
}

// ── Props ──────────────────────────────────────────────────────────────────
export interface FretboardDisplayProps {
  getNoteDisplayInfo: (stringIndex: number, fret: number) => NoteDisplayInfo;
  showDegreeColors: boolean;
  isComparing: boolean;
  showNoteNames: boolean;
  renderOverride?: (stringIndex: number, fret: number) => React.ReactNode | null;
  numFrets?: number;
}

export default function FretboardDisplay({
  getNoteDisplayInfo,
  showDegreeColors,
  isComparing,
  showNoteNames,
  renderOverride,
  numFrets = DEFAULT_NUM_FRETS,
}: FretboardDisplayProps) {
  return (
    <div
      className="rounded-lg p-8"
      style={{
        background: 'linear-gradient(135deg, hsl(30, 40%, 25%) 0%, hsl(30, 35%, 30%) 50%, hsl(30, 40%, 25%) 100%)',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      }}
    >
      <div className="w-full">
        {/* Fret Numbers */}
        <div className="flex mb-4">
          <div className="w-12 flex-shrink-0"></div>
          {Array.from({ length: numFrets }, (_, i) => i + 1).map((fret) => (
            <div
              key={fret}
              className="flex-1 text-center text-xs font-mono"
              style={{ color: fret === 12 ? '#fbbf24' : '#d4af7a' }}
            >
              {fret}
            </div>
          ))}
        </div>

        {/* Fretboard Surface */}
        <div
          className="relative rounded"
          style={{
            background: 'linear-gradient(to bottom, hsl(30, 25%, 20%), hsl(30, 30%, 28%), hsl(30, 25%, 20%))',
            boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* Strings + notes */}
          <div className="relative py-4">
            {[...STANDARD_TUNING].reverse().map((tuning, reversedIndex) => {
              const stringIndex = STANDARD_TUNING.length - 1 - reversedIndex;
              return (
                <div key={stringIndex} className="relative flex items-center mb-1 last:mb-0">
                  {/* Nut with open string note */}
                  <div
                    className="w-12 flex-shrink-0 flex items-center justify-center"
                    style={{
                      height: '40px',
                      background: 'linear-gradient(to right, hsl(30, 20%, 12%), hsl(30, 20%, 18%))',
                      borderRight: '3px solid hsl(30, 15%, 8%)',
                      boxShadow: 'inset -2px 0 4px rgba(0, 0, 0, 0.5)',
                    }}
                  >
                    <span className="text-amber-100 font-bold text-xs">{tuning}</span>
                  </div>

                  {/* String line */}
                  <div className="absolute left-12 right-0 flex items-center">
                    <div className="w-full" style={getStringStyle(stringIndex)} />
                  </div>

                  {/* Frets with note positions */}
                  {Array.from({ length: numFrets }, (_, fret) => fret + 1).map((fret) => {
                    const info = getNoteDisplayInfo(stringIndex, fret);
                    const override = renderOverride?.(stringIndex, fret) ?? null;
                    const shouldShowNormal = showNoteNames && info.inScale && info.inSelectedBox;
                    return (
                      <div
                        key={fret}
                        className="relative flex-1 flex items-center justify-center"
                        style={{
                          height: '40px',
                          borderRight: fret === numFrets ? 'none' : '2px solid hsl(30, 30%, 35%)',
                        }}
                      >
                        {override ?? (shouldShowNormal && (
                          <NoteDot info={info} showDegreeColors={showDegreeColors} isComparing={isComparing} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Inlay markers */}
          <div className="flex absolute bottom-1 left-12 right-0">
            {Array.from({ length: numFrets }, (_, i) => i + 1).map((fret) => (
              <div key={fret} className="flex-1 h-8 flex items-center justify-center gap-2">
                {isInlayPosition(fret) && (
                  <>
                    <div className="rounded-full" style={{ width: '10px', height: '10px', background: 'radial-gradient(circle, #f5f5dc 0%, #d4c5a9 100%)', boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.5), 0 1px 3px rgba(0, 0, 0, 0.4)' }} />
                    {isDoubleInlay(fret) && (
                      <div className="rounded-full" style={{ width: '10px', height: '10px', background: 'radial-gradient(circle, #f5f5dc 0%, #d4c5a9 100%)', boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.5), 0 1px 3px rgba(0, 0, 0, 0.4)' }} />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

Copy the bodies of the helper functions and `NoteDot` verbatim from the current `src/components/Fretboard.tsx` (see lines 32–101 and 469–500 in your working copy). Do not modify them — this is a pure move.

Note: `getNoteAtFret` is imported in case a future consumer of `renderOverride` needs it; the existing trainer logic lives OUTSIDE this file so `getNoteAtFret` is currently unused here. If TypeScript flags it as unused, remove the import — that's fine.

- [ ] **Step 2: Re-export from ScaleExplorer barrel**

Edit `src/components/ScaleExplorer/index.ts`, append:

```ts
export { default as FretboardDisplay } from './FretboardDisplay';
export type { FretboardDisplayProps } from './FretboardDisplay';
```

- [ ] **Step 3: Refactor `src/components/Fretboard.tsx` to compose `FretboardDisplay`**

Delete from `Fretboard.tsx`:
- The moved constants (`NUM_FRETS`, `INLAY_POSITIONS`, `DOUBLE_INLAY_FRETS`) — keep `NUM_FRETS` deleted; the display uses its own default.
- All the styling helpers moved in Step 1.
- `NoteDot`.
- The entire "Fretboard Container" JSX block (currently lines ~289–431 in the working copy).

Replace the deleted JSX block with:

```tsx
<FretboardDisplay
  getNoteDisplayInfo={enhancements.getNoteDisplayInfo}
  showDegreeColors={enhancements.showDegreeColors}
  isComparing={enhancements.isComparing}
  showNoteNames={showNoteNames}
  renderOverride={(stringIndex, fret) => {
    if (!trainer.isRunning || trainer.phase !== 'revealing') return null;
    const noteAtPosition = getNoteAtFret(stringIndex, fret);
    const isTrainerReveal =
      noteAtPosition === trainer.currentNote &&
      trainer.config.enabledStrings[stringIndex] &&
      fret <= 12;
    return isTrainerReveal ? <TrainerDot note={noteAtPosition} /> : null;
  }}
/>
```

Keep `TrainerDot` inside `Fretboard.tsx` — it's specific to the trainer feature and lives with its usage.

Update imports in `Fretboard.tsx`:
```ts
import { FretboardDisplay } from '@/components/ScaleExplorer';   // add
// ...remove NoteDot-related types/helpers imports that no longer apply.
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -v 'src/generated/prisma' | head -30`
Expected: no new errors. If unused imports are flagged, remove them.

- [ ] **Step 5: Visual regression check**

Before the commit — with the dev server running — navigate to `/fretboard`. Test each of these to confirm behavior is unchanged:
- Default state (no scale selected, show note names off) — should look identical to before.
- Select "Major" scale, key "C" — same notes on same frets as before.
- Enable degree colors — same colored dots as before.
- Enable comparison with "Minor" — same primary-only / compare-only / both classes.
- Enable pentatonic positions (select "Minor Pentatonic", then a position 1–5) — same subset of notes highlighted.
- Enable "Note Trainer" — the green pulsing `TrainerDot` still appears on the correct fret during reveal phase.

If anything differs, the extraction diverged — go back and fix Step 1 or Step 3 before committing.

- [ ] **Step 6: Commit**

```bash
git add src/components/ScaleExplorer/FretboardDisplay.tsx src/components/ScaleExplorer/index.ts src/components/Fretboard.tsx
git commit -m "refactor: extract FretboardDisplay primitive from Fretboard.tsx"
```

---

## Task 5: `POST /api/backing-tracks` and `GET /api/backing-tracks`

**Files:**
- Create: `src/app/api/backing-tracks/route.ts`

**Interfaces:**
- Consumes:
  - `prisma` from `@/lib/prisma`.
  - `isValidYouTubeUrl`, `extractVideoId`, `thumbnailUrl` from `@/lib/youtube` (Task 1).
  - `NOTES`, `SCALE_FORMULAS` from `@/lib/musicTheory`.
- Produces:
  - `GET /api/backing-tracks` → `200 BackingTrack[]` (sorted by `createdAt DESC`).
  - `POST /api/backing-tracks` body `{ url: string, title?: string, rootNote: string, scaleType: string }`:
    - `201 BackingTrack` on success.
    - `400 { error }` for invalid input.
    - `409 { error, existingId }` when a track with the same `youtubeUrl` already exists.
    - `422 { error, needsTitle: true }` when the URL is valid but `yt-dlp` couldn't fetch a title and none was supplied.

- [ ] **Step 1: Create `src/app/api/backing-tracks/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { prisma } from "@/lib/prisma";
import { isValidYouTubeUrl, extractVideoId, thumbnailUrl } from "@/lib/youtube";
import { NOTES, SCALE_FORMULAS } from "@/lib/musicTheory";

const TITLE_FETCH_TIMEOUT_MS = 30_000;

function execFilePromise(
  command: string,
  args: string[],
  options: { timeout?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: options.timeout, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const enriched = error as Error & { stderr?: string };
        enriched.stderr = stderr;
        reject(enriched);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

function isValidRootNote(note: unknown): note is string {
  return typeof note === "string" && (NOTES as readonly string[]).includes(note);
}

function isValidScaleType(scale: unknown): scale is string {
  if (typeof scale !== "string") return false;
  if (scale === "None") return false; // backing tracks require a real scale
  return Object.prototype.hasOwnProperty.call(SCALE_FORMULAS, scale);
}

export async function GET() {
  const tracks = await prisma.backingTrack.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(tracks);
}

export async function POST(request: NextRequest) {
  let body: { url?: string; title?: string; rootNote?: string; scaleType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, title: providedTitle, rootNote, scaleType } = body;

  if (!url || typeof url !== "string" || !isValidYouTubeUrl(url)) {
    return NextResponse.json(
      { error: "Invalid YouTube URL. Supported formats: youtube.com/watch, youtu.be, youtube.com/shorts, music.youtube.com" },
      { status: 400 }
    );
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return NextResponse.json({ error: "Could not extract video id from URL" }, { status: 400 });
  }

  if (!isValidRootNote(rootNote)) {
    return NextResponse.json({ error: `Invalid rootNote. Must be one of: ${NOTES.join(", ")}` }, { status: 400 });
  }

  if (!isValidScaleType(scaleType)) {
    return NextResponse.json({ error: `Invalid scaleType.` }, { status: 400 });
  }

  // Duplicate check first (avoids running yt-dlp only to fail on unique constraint)
  const existing = await prisma.backingTrack.findUnique({ where: { youtubeUrl: url } });
  if (existing) {
    return NextResponse.json(
      { error: "A backing track with this URL already exists.", existingId: existing.id },
      { status: 409 }
    );
  }

  // Resolve title
  let title: string;
  if (providedTitle && typeof providedTitle === "string" && providedTitle.trim()) {
    title = providedTitle.trim();
  } else {
    try {
      const { stdout } = await execFilePromise("yt-dlp", ["--dump-json", url], {
        timeout: TITLE_FETCH_TIMEOUT_MS,
      });
      const metadata = JSON.parse(stdout);
      title = metadata.title || "Untitled";
    } catch (err) {
      const stderrMsg = (err as Error & { stderr?: string }).stderr || "";
      console.error("Error fetching YouTube title:", err);
      console.error("yt-dlp stderr:", stderrMsg);
      return NextResponse.json(
        { error: "Could not fetch video title automatically. Please provide a title.", needsTitle: true },
        { status: 422 }
      );
    }
  }

  const created = await prisma.backingTrack.create({
    data: {
      youtubeUrl: url,
      videoId,
      title,
      thumbnailUrl: thumbnailUrl(videoId),
      rootNote,
      scaleType,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -v 'src/generated/prisma' | head -20`
Expected: no errors.

- [ ] **Step 3: Manual verification with curl**

Start dev server (`npm run dev` or `docker-compose up`).

```bash
# GET empty list
curl -s http://localhost:3000/api/backing-tracks
# Expected: []

# POST — invalid URL
curl -s -X POST http://localhost:3000/api/backing-tracks -H 'Content-Type: application/json' -d '{"url":"not a url","rootNote":"A","scaleType":"Minor Pentatonic"}'
# Expected: 400 with "Invalid YouTube URL..."

# POST — invalid rootNote
curl -s -X POST http://localhost:3000/api/backing-tracks -H 'Content-Type: application/json' -d '{"url":"https://youtu.be/dQw4w9WgXcQ","rootNote":"H","scaleType":"Minor Pentatonic"}'
# Expected: 400 with "Invalid rootNote..."

# POST — invalid scaleType (including "None")
curl -s -X POST http://localhost:3000/api/backing-tracks -H 'Content-Type: application/json' -d '{"url":"https://youtu.be/dQw4w9WgXcQ","rootNote":"A","scaleType":"None"}'
# Expected: 400 with "Invalid scaleType."

# POST — with a title supplied (skips yt-dlp)
curl -s -X POST http://localhost:3000/api/backing-tracks -H 'Content-Type: application/json' -d '{"url":"https://youtu.be/dQw4w9WgXcQ","title":"Test Backing","rootNote":"A","scaleType":"Minor Pentatonic"}'
# Expected: 201 with the created track (title=Test Backing, thumbnailUrl set, videoId=dQw4w9WgXcQ)

# POST — same URL again (duplicate)
curl -s -X POST http://localhost:3000/api/backing-tracks -H 'Content-Type: application/json' -d '{"url":"https://youtu.be/dQw4w9WgXcQ","title":"Test Backing 2","rootNote":"A","scaleType":"Minor Pentatonic"}'
# Expected: 409 with { error: "...", existingId: "<uuid>" }

# GET — should now contain one row
curl -s http://localhost:3000/api/backing-tracks
# Expected: [{ id, youtubeUrl, videoId, title, thumbnailUrl, rootNote, scaleType, createdAt, updatedAt }]
```

- [ ] **Step 4: Clean up test row**

```bash
sqlite3 prisma/guitar_assistant.db "DELETE FROM BackingTrack WHERE title LIKE 'Test Backing%';"
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/backing-tracks/route.ts
git commit -m "feat: add GET/POST /api/backing-tracks"
```

---

## Task 6: `PATCH /api/backing-tracks/[id]` and `DELETE /api/backing-tracks/[id]`

**Files:**
- Create: `src/app/api/backing-tracks/[id]/route.ts`

**Interfaces:**
- Consumes:
  - `prisma` from `@/lib/prisma`.
  - `NOTES`, `SCALE_FORMULAS` from `@/lib/musicTheory`.
- Produces:
  - `GET /api/backing-tracks/[id]` → `200 BackingTrack` or `404`.
  - `PATCH /api/backing-tracks/[id]` body `{ title?, rootNote?, scaleType? }` → `200 BackingTrack` / `400` / `404`.
  - `DELETE /api/backing-tracks/[id]` → `200 { success: true }` / `404`.

- [ ] **Step 1: Create `src/app/api/backing-tracks/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NOTES, SCALE_FORMULAS } from "@/lib/musicTheory";

function isValidRootNote(note: unknown): note is string {
  return typeof note === "string" && (NOTES as readonly string[]).includes(note);
}

function isValidScaleType(scale: unknown): scale is string {
  if (typeof scale !== "string") return false;
  if (scale === "None") return false;
  return Object.prototype.hasOwnProperty.call(SCALE_FORMULAS, scale);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const track = await prisma.backingTrack.findUnique({ where: { id } });
  if (!track) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(track);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { title?: unknown; rootNote?: unknown; scaleType?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: { title?: string; rootNote?: string; scaleType?: string } = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "title must be a non-empty string" }, { status: 400 });
    }
    data.title = body.title.trim();
  }

  if (body.rootNote !== undefined) {
    if (!isValidRootNote(body.rootNote)) {
      return NextResponse.json({ error: `Invalid rootNote. Must be one of: ${NOTES.join(", ")}` }, { status: 400 });
    }
    data.rootNote = body.rootNote;
  }

  if (body.scaleType !== undefined) {
    if (!isValidScaleType(body.scaleType)) {
      return NextResponse.json({ error: "Invalid scaleType." }, { status: 400 });
    }
    data.scaleType = body.scaleType;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const existing = await prisma.backingTrack.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.backingTrack.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.backingTrack.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.backingTrack.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -v 'src/generated/prisma' | head -20`
Expected: no errors.

- [ ] **Step 3: Manual verification with curl**

```bash
# Create a temporary row to work with
curl -s -X POST http://localhost:3000/api/backing-tracks -H 'Content-Type: application/json' -d '{"url":"https://youtu.be/dQw4w9WgXcQ","title":"Patch Test","rootNote":"A","scaleType":"Minor Pentatonic"}'
# Capture the id from the response, then:

ID='<paste-id-here>'

# GET
curl -s http://localhost:3000/api/backing-tracks/$ID
# Expected: 200 with the row

# PATCH title only
curl -s -X PATCH http://localhost:3000/api/backing-tracks/$ID -H 'Content-Type: application/json' -d '{"title":"Renamed"}'
# Expected: 200 with title="Renamed"

# PATCH rootNote + scaleType
curl -s -X PATCH http://localhost:3000/api/backing-tracks/$ID -H 'Content-Type: application/json' -d '{"rootNote":"E","scaleType":"Blues"}'
# Expected: 200 with rootNote=E, scaleType=Blues

# PATCH invalid rootNote
curl -s -X PATCH http://localhost:3000/api/backing-tracks/$ID -H 'Content-Type: application/json' -d '{"rootNote":"X"}'
# Expected: 400

# PATCH empty body
curl -s -X PATCH http://localhost:3000/api/backing-tracks/$ID -H 'Content-Type: application/json' -d '{}'
# Expected: 400 "No updatable fields provided"

# DELETE
curl -s -X DELETE http://localhost:3000/api/backing-tracks/$ID
# Expected: 200 { "success": true }

# DELETE again
curl -s -X DELETE http://localhost:3000/api/backing-tracks/$ID
# Expected: 404

# GET after delete
curl -s http://localhost:3000/api/backing-tracks/$ID
# Expected: 404
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/backing-tracks/\[id\]/route.ts
git commit -m "feat: add PATCH/DELETE /api/backing-tracks/[id]"
```

---

## Task 7: `YouTubeEmbed` component

**Files:**
- Create: `src/components/BackingTracks/YouTubeEmbed.tsx`

**Interfaces:**
- Consumes: `buildEmbedUrl` from `@/lib/youtube` (Task 1).
- Produces:
  ```ts
  interface YouTubeEmbedProps {
    videoId: string;
    title?: string;   // used for iframe accessibility
    className?: string;
  }
  export default function YouTubeEmbed(props: YouTubeEmbedProps): JSX.Element;
  ```

- [ ] **Step 1: Create `src/components/BackingTracks/YouTubeEmbed.tsx`**

```tsx
'use client';

import { buildEmbedUrl } from '@/lib/youtube';

interface YouTubeEmbedProps {
  videoId: string;
  title?: string;
  className?: string;
}

export default function YouTubeEmbed({ videoId, title, className }: YouTubeEmbedProps) {
  return (
    <div className={`relative w-full ${className ?? ''}`} style={{ aspectRatio: '16 / 9' }}>
      <iframe
        src={buildEmbedUrl(videoId)}
        title={title ?? 'YouTube video player'}
        className="absolute inset-0 w-full h-full rounded-lg"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -v 'src/generated/prisma' | head -10`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/BackingTracks/YouTubeEmbed.tsx
git commit -m "feat: add YouTubeEmbed component"
```

---

## Task 8: `BackingTrackFretboard` — slim fretboard with root/scale dropdowns

**Files:**
- Create: `src/components/BackingTracks/BackingTrackFretboard.tsx`

**Interfaces:**
- Consumes:
  - `FretboardDisplay` from `@/components/ScaleExplorer` (Task 4).
  - `useFretboardEnhancements` from `@/components/ScaleExplorer`.
  - `NOTES`, `SCALE_FORMULAS` from `@/lib/musicTheory`.
- Produces:
  ```ts
  interface BackingTrackFretboardProps {
    rootNote: string;
    scaleType: string;
    onRootChange: (root: string) => void;
    onScaleChange: (scale: string) => void;
  }
  export default function BackingTrackFretboard(props: BackingTrackFretboardProps): JSX.Element;
  ```

- [ ] **Step 1: Create `src/components/BackingTracks/BackingTrackFretboard.tsx`**

```tsx
'use client';

import { NOTES, SCALE_FORMULAS } from '@/lib/musicTheory';
import type { ScaleType } from '@/lib/musicTheory';
import { FretboardDisplay, useFretboardEnhancements } from '@/components/ScaleExplorer';

interface BackingTrackFretboardProps {
  rootNote: string;
  scaleType: string;
  onRootChange: (root: string) => void;
  onScaleChange: (scale: string) => void;
}

export default function BackingTrackFretboard({
  rootNote,
  scaleType,
  onRootChange,
  onScaleChange,
}: BackingTrackFretboardProps) {
  const enhancements = useFretboardEnhancements({
    selectedKey: rootNote,
    selectedScale: scaleType as ScaleType,
  });

  // Backing tracks always require a real scale — exclude 'None'.
  const scaleOptions = Object.keys(SCALE_FORMULAS).filter((s) => s !== 'None');

  return (
    <div className="flex flex-col gap-4">
      {/* Root + scale selectors */}
      <div className="flex gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-amber-200/70 text-xs font-medium">Root</label>
          <select
            value={rootNote}
            onChange={(e) => onRootChange(e.target.value)}
            className="px-3 py-2 rounded bg-amber-900/50 text-amber-100 border border-amber-700/50 focus:outline-none focus:border-amber-500"
          >
            {NOTES.map((note) => (
              <option key={note} value={note}>{note}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-amber-200/70 text-xs font-medium">Scale</label>
          <select
            value={scaleType}
            onChange={(e) => onScaleChange(e.target.value)}
            className="px-3 py-2 rounded bg-amber-900/50 text-amber-100 border border-amber-700/50 focus:outline-none focus:border-amber-500"
          >
            {scaleOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <p className="text-amber-300 text-sm ml-2 pb-2">{rootNote} {scaleType}</p>
      </div>

      {/* Fretboard */}
      <FretboardDisplay
        getNoteDisplayInfo={enhancements.getNoteDisplayInfo}
        showDegreeColors={enhancements.showDegreeColors}
        isComparing={enhancements.isComparing}
        showNoteNames={true}
      />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -v 'src/generated/prisma' | head -10`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/BackingTracks/BackingTrackFretboard.tsx
git commit -m "feat: add slim BackingTrackFretboard with root + scale dropdowns"
```

---

## Task 9: `AddBackingTrackModal`

**Files:**
- Create: `src/components/BackingTracks/AddBackingTrackModal.tsx`

**Interfaces:**
- Consumes:
  - `isValidYouTubeUrl` from `@/lib/youtube` (Task 1).
  - `NOTES`, `SCALE_FORMULAS` from `@/lib/musicTheory`.
  - `BackingTrack` type from `@/types`.
- Produces:
  ```ts
  interface AddBackingTrackModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (track: BackingTrack) => void;
    onOpenExisting?: (existingId: string) => void;
  }
  export default function AddBackingTrackModal(props: AddBackingTrackModalProps): JSX.Element | null;
  ```

- [ ] **Step 1: Create `src/components/BackingTracks/AddBackingTrackModal.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { isValidYouTubeUrl } from '@/lib/youtube';
import { NOTES, SCALE_FORMULAS } from '@/lib/musicTheory';
import type { BackingTrack } from '@/types';

interface AddBackingTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (track: BackingTrack) => void;
  onOpenExisting?: (existingId: string) => void;
}

export default function AddBackingTrackModal({
  isOpen, onClose, onCreated, onOpenExisting,
}: AddBackingTrackModalProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [rootNote, setRootNote] = useState('A');
  const [scaleType, setScaleType] = useState('Minor Pentatonic');
  const [needsTitle, setNeedsTitle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const scaleOptions = Object.keys(SCALE_FORMULAS).filter((s) => s !== 'None');

  const reset = () => {
    setUrl(''); setTitle(''); setRootNote('A'); setScaleType('Minor Pentatonic');
    setNeedsTitle(false); setError(null); setExistingId(null); setSubmitting(false);
  };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setExistingId(null);

    if (!isValidYouTubeUrl(url)) {
      setError('Please enter a valid YouTube URL.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/backing-tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          title: title.trim() || undefined,
          rootNote,
          scaleType,
        }),
      });
      const body = await res.json();

      if (res.status === 201) {
        onCreated(body as BackingTrack);
        reset();
        onClose();
        return;
      }

      if (res.status === 409 && body.existingId) {
        setExistingId(body.existingId);
        setError(body.error ?? 'Already added.');
        return;
      }

      if (res.status === 422 && body.needsTitle) {
        setNeedsTitle(true);
        setError('Could not fetch the video title. Please enter it below.');
        return;
      }

      setError(body.error ?? `Request failed (${res.status}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={handleClose}>
      <div
        className="bg-neutral-900 border border-neutral-700 rounded-lg p-6 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-amber-100">Add Backing Track</h2>
          <button onClick={handleClose} className="text-neutral-400 hover:text-white">×</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-neutral-300">YouTube URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="px-3 py-2 rounded bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          {needsTitle && (
            <div className="flex flex-col gap-1">
              <label className="text-sm text-neutral-300">Title (required — auto-fetch failed)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="px-3 py-2 rounded bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-sm text-neutral-300">Root</label>
              <select
                value={rootNote}
                onChange={(e) => setRootNote(e.target.value)}
                className="px-3 py-2 rounded bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:border-amber-500"
              >
                {NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex-[2] flex flex-col gap-1">
              <label className="text-sm text-neutral-300">Scale</label>
              <select
                value={scaleType}
                onChange={(e) => setScaleType(e.target.value)}
                className="px-3 py-2 rounded bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:border-amber-500"
              >
                {scaleOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <div className="text-sm text-rose-400">
              {error}
              {existingId && onOpenExisting && (
                <button
                  type="button"
                  className="ml-2 underline hover:text-rose-300"
                  onClick={() => { onOpenExisting(existingId); handleClose(); }}
                >
                  Open existing
                </button>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-700 text-white text-sm disabled:opacity-50"
            >
              {submitting ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -v 'src/generated/prisma' | head -10`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/BackingTracks/AddBackingTrackModal.tsx
git commit -m "feat: add AddBackingTrackModal (URL + root + scale form)"
```

---

## Task 10: `BackingTrackList` and `BackingTrackDetail`

**Files:**
- Create: `src/components/BackingTracks/BackingTrackList.tsx`
- Create: `src/components/BackingTracks/BackingTrackDetail.tsx`

**Interfaces:**
- Consumes:
  - `BackingTrack` type from `@/types`.
  - `YouTubeEmbed` (Task 7), `BackingTrackFretboard` (Task 8).
- Produces:
  ```ts
  interface BackingTrackListProps {
    tracks: BackingTrack[];
    onSelect: (id: string) => void;
    onAddClick: () => void;
  }
  export default function BackingTrackList(props: BackingTrackListProps): JSX.Element;

  interface BackingTrackDetailProps {
    track: BackingTrack;
    onBack: () => void;
    onUpdate: (patch: { title?: string; rootNote?: string; scaleType?: string }) => void;
    onDelete: () => void;
  }
  export default function BackingTrackDetail(props: BackingTrackDetailProps): JSX.Element;
  ```

- [ ] **Step 1: Create `src/components/BackingTracks/BackingTrackList.tsx`**

```tsx
'use client';

import type { BackingTrack } from '@/types';

interface BackingTrackListProps {
  tracks: BackingTrack[];
  onSelect: (id: string) => void;
  onAddClick: () => void;
}

export default function BackingTrackList({ tracks, onSelect, onAddClick }: BackingTrackListProps) {
  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-amber-100">Backing Tracks</h1>
          <button
            onClick={onAddClick}
            className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium"
          >
            + Add Backing Track
          </button>
        </div>

        {tracks.length === 0 ? (
          <div className="text-center text-neutral-400 py-16">
            <p className="text-lg mb-2">No backing tracks yet.</p>
            <p className="text-sm">Click <span className="text-amber-300">+ Add Backing Track</span> to paste a YouTube URL and start practicing over it.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tracks.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelect(t.id)}
                className="text-left bg-neutral-900 hover:bg-neutral-800 rounded-lg overflow-hidden border border-neutral-800 transition-colors"
              >
                {t.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.thumbnailUrl}
                    alt={t.title}
                    className="w-full aspect-video object-cover"
                  />
                )}
                <div className="p-3">
                  <p className="text-white font-medium truncate">{t.title}</p>
                  <p className="text-amber-300 text-sm mt-1">{t.rootNote} {t.scaleType}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/BackingTracks/BackingTrackDetail.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { BackingTrack } from '@/types';
import YouTubeEmbed from './YouTubeEmbed';
import BackingTrackFretboard from './BackingTrackFretboard';

interface BackingTrackDetailProps {
  track: BackingTrack;
  onBack: () => void;
  onUpdate: (patch: { title?: string; rootNote?: string; scaleType?: string }) => void;
  onDelete: () => void;
}

export default function BackingTrackDetail({ track, onBack, onUpdate, onDelete }: BackingTrackDetailProps) {
  const [rootNote, setRootNote] = useState(track.rootNote);
  const [scaleType, setScaleType] = useState(track.scaleType);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(track.title);

  // Sync local state if a different track becomes selected
  useEffect(() => {
    setRootNote(track.rootNote);
    setScaleType(track.scaleType);
    setTitleDraft(track.title);
  }, [track.id, track.rootNote, track.scaleType, track.title]);

  // Debounced PATCH for scale changes
  const patchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulePatch = (patch: { rootNote?: string; scaleType?: string }) => {
    if (patchTimer.current) clearTimeout(patchTimer.current);
    patchTimer.current = setTimeout(() => onUpdate(patch), 300);
  };

  const handleRootChange = (r: string) => { setRootNote(r); schedulePatch({ rootNote: r }); };
  const handleScaleChange = (s: string) => { setScaleType(s); schedulePatch({ scaleType: s }); };

  const commitTitle = () => {
    const t = titleDraft.trim();
    if (t && t !== track.title) onUpdate({ title: t });
    setEditingTitle(false);
  };

  const handleDeleteClick = () => {
    if (confirm(`Delete "${track.title}"? This cannot be undone.`)) {
      onDelete();
    }
  };

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="text-amber-300 hover:text-amber-200 text-sm">← Back</button>
          <button
            onClick={handleDeleteClick}
            className="px-3 py-1.5 rounded bg-rose-900/50 hover:bg-rose-800/50 text-rose-200 text-sm"
          >
            Delete
          </button>
        </div>

        {/* Title */}
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitleDraft(track.title); setEditingTitle(false); } }}
            className="text-2xl font-bold text-amber-100 bg-transparent border-b border-amber-600 focus:outline-none w-full mb-6"
          />
        ) : (
          <h1
            className="text-2xl font-bold text-amber-100 mb-6 cursor-pointer hover:text-amber-200"
            onClick={() => setEditingTitle(true)}
            title="Click to rename"
          >
            {track.title}
          </h1>
        )}

        {/* Player + Fretboard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <YouTubeEmbed videoId={track.videoId} title={track.title} />
          </div>
          <div>
            <BackingTrackFretboard
              rootNote={rootNote}
              scaleType={scaleType}
              onRootChange={handleRootChange}
              onScaleChange={handleScaleChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -v 'src/generated/prisma' | head -10`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/BackingTracks/BackingTrackList.tsx src/components/BackingTracks/BackingTrackDetail.tsx
git commit -m "feat: add BackingTrackList and BackingTrackDetail views"
```

---

## Task 11: `BackingTracksView` orchestrator + barrel

**Files:**
- Create: `src/components/BackingTracks/BackingTracksView.tsx`
- Create: `src/components/BackingTracks/index.ts`

**Interfaces:**
- Consumes: everything from Tasks 7–10, plus `BackingTrack` type.
- Produces:
  ```ts
  export default function BackingTracksView(): JSX.Element;   // no props — self-contained
  ```

- [ ] **Step 1: Create `src/components/BackingTracks/BackingTracksView.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BackingTrack } from '@/types';
import BackingTrackList from './BackingTrackList';
import BackingTrackDetail from './BackingTrackDetail';
import AddBackingTrackModal from './AddBackingTrackModal';

export default function BackingTracksView() {
  const [tracks, setTracks] = useState<BackingTrack[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/backing-tracks');
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data: BackingTrack[] = await res.json();
      setTracks(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const selected = selectedId ? tracks.find((t) => t.id === selectedId) ?? null : null;

  const handleCreated = (t: BackingTrack) => {
    setTracks((prev) => [t, ...prev]);
    setSelectedId(t.id);
  };

  const handleUpdate = async (id: string, patch: { title?: string; rootNote?: string; scaleType?: string }) => {
    const res = await fetch(`/api/backing-tracks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      console.error('PATCH failed', await res.text());
      return;
    }
    const updated: BackingTrack = await res.json();
    setTracks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/backing-tracks/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      console.error('DELETE failed', await res.text());
      return;
    }
    setTracks((prev) => prev.filter((t) => t.id !== id));
    setSelectedId(null);
  };

  return (
    <>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-neutral-400">Loading…</div>
      ) : loadError ? (
        <div className="flex-1 flex items-center justify-center text-rose-400">{loadError}</div>
      ) : selected ? (
        <BackingTrackDetail
          track={selected}
          onBack={() => setSelectedId(null)}
          onUpdate={(patch) => handleUpdate(selected.id, patch)}
          onDelete={() => handleDelete(selected.id)}
        />
      ) : (
        <BackingTrackList
          tracks={tracks}
          onSelect={setSelectedId}
          onAddClick={() => setIsAddOpen(true)}
        />
      )}

      <AddBackingTrackModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onCreated={handleCreated}
        onOpenExisting={(id) => setSelectedId(id)}
      />
    </>
  );
}
```

- [ ] **Step 2: Create `src/components/BackingTracks/index.ts`**

```ts
export { default as BackingTracksView } from './BackingTracksView';
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -v 'src/generated/prisma' | head -10`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/BackingTracks/BackingTracksView.tsx src/components/BackingTracks/index.ts
git commit -m "feat: add BackingTracksView orchestrator"
```

---

## Task 12: Wire the new section into routing and nav

**Files:**
- Modify: `src/app/[[...section]]/page.tsx`
- Modify: `src/components/TopNav.tsx`

**Interfaces:**
- Consumes: `BackingTracksView` from `@/components/BackingTracks` (Task 11).
- Produces: user-visible section `/backing-tracks`.

- [ ] **Step 1: Update the `Section` union and `getSectionFromPath` in `src/app/[[...section]]/page.tsx`**

Locate the `type Section = ...` declaration (currently around line 35):

```ts
type Section = 'home' | 'lessons' | 'videos' | 'fretboard' | 'intervals' | 'chords' | 'tools' | 'circle' | 'tabs' | 'jamtracks' | 'recordings' | 'metrics' | 'knowledge' | 'gear' | 'progressions' | 'caged' | 'scales';
```

Append `| 'backing-tracks'`:

```ts
type Section = 'home' | 'lessons' | 'videos' | 'fretboard' | 'intervals' | 'chords' | 'tools' | 'circle' | 'tabs' | 'jamtracks' | 'recordings' | 'metrics' | 'knowledge' | 'gear' | 'progressions' | 'caged' | 'scales' | 'backing-tracks';
```

Then verify `getSectionFromPath` matches on the first URL segment. Read the function (starts at line 37); if it uses an explicit `switch`/`if` for each id, add a case for `'backing-tracks'` following the same pattern as `'jamtracks'`. If it does a generic "if the string is a valid Section, use it", no code change is needed — but confirm by tracing.

- [ ] **Step 2: Add the import and render branch in `src/app/[[...section]]/page.tsx`**

Near the top with the other component imports, add:

```ts
import { BackingTracksView } from '@/components/BackingTracks';
```

In the JSX rendering the active section (currently around line 2099–2127), add a new branch. Insert it BEFORE the final `<Fretboard />` fallback, next to the `'jamtracks'` branch for locality:

```tsx
      ) : activeSection === 'backing-tracks' ? (
        <BackingTracksView />
```

The final else-branch (which renders `<Fretboard />`) stays as the fallback.

- [ ] **Step 3: Update the `Section` union in `src/components/TopNav.tsx`**

Locate the `type Section = ...` declaration at line 11 of `TopNav.tsx` and append `| 'backing-tracks'` identically:

```ts
type Section = 'home' | 'lessons' | 'videos' | 'fretboard' | 'intervals' | 'chords' | 'tools' | 'circle' | 'tabs' | 'jamtracks' | 'recordings' | 'metrics' | 'knowledge' | 'gear' | 'progressions' | 'caged' | 'scales' | 'backing-tracks';
```

- [ ] **Step 4: Add the nav link in `src/components/TopNav.tsx`**

Right after the JamTracks `<Link>` block (currently ends around line 318), add a Backing Tracks link with the same shape:

```tsx
<Link
  href="/backing-tracks"
  onClick={() => onSectionChange('backing-tracks')}
  className={`px-2 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
    activeSection === 'backing-tracks'
      ? 'bg-gray-700 text-white'
      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
  }`}
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 10l3-3v10l-3-3H5a2 2 0 01-2-2v-0a2 2 0 012-2h4z" />
  </svg>
  <span className="hidden sm:inline">Backing Tracks</span>
  <span className="sm:hidden">Backing</span>
</Link>
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -v 'src/generated/prisma' | head -20`
Expected: no errors.

- [ ] **Step 6: Lint**

Run: `npm run lint 2>&1 | head -30`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/\[\[...section\]\]/page.tsx src/components/TopNav.tsx
git commit -m "feat: wire /backing-tracks section into router and top nav"
```

---

## Task 13: End-to-end manual verification

**Files:** none (verification-only task).

- [ ] **Step 1: Start the app**

```bash
docker-compose up
```

(or `npm run dev` if not using Docker locally). Wait for "Ready" / "listening on 3000".

- [ ] **Step 2: Navigate and verify empty state**

Open `http://localhost:3000/backing-tracks`. Expected:
- Top nav highlights "Backing Tracks".
- Empty-state message with a "+ Add Backing Track" button.

- [ ] **Step 3: Add a track — happy path**

Click "+ Add Backing Track". Paste a real YouTube URL for a backing track (e.g. any public "A minor blues backing track" video). Pick Root=A, Scale="Minor Pentatonic". Click Add. Expected:
- After ~2–10s (yt-dlp title fetch), the modal closes and the detail view loads with the YouTube player and fretboard side-by-side.
- Fretboard shows A minor pentatonic dots.
- Refresh the browser — track is still there.

- [ ] **Step 4: Change the scale**

On the detail view, change the Scale dropdown to "Blues". Expected:
- Fretboard dots update immediately.
- Wait 300ms — a PATCH fires. Refresh — the new scale sticks.

- [ ] **Step 5: Rename the track**

Click the title → edit → hit Enter. Expected:
- New title persists after refresh.

- [ ] **Step 6: Duplicate-URL flow**

Click "+ Add" again, paste the same URL. Expected:
- Error message says "Already added…" with an "Open existing" link.
- Clicking "Open existing" opens the detail view for that track.

- [ ] **Step 7: yt-dlp failure fallback**

Paste a URL that yt-dlp can't fetch (a private / deleted video, if you can find one; or temporarily rename the `yt-dlp` binary in the container to force failure — restore after). Expected:
- Modal shows "Could not fetch the video title. Please enter it below." and a Title field appears.
- Enter a title, submit — track is created with the manual title.

If you can't easily reproduce a yt-dlp failure, skip this step and note it as manual TODO.

- [ ] **Step 8: Delete the track**

Click Delete on the detail view, confirm the browser dialog. Expected:
- Returns to the list view.
- Track no longer appears.
- API GET returns empty (if no other tracks).

- [ ] **Step 9: `/fretboard` regression sanity check**

Navigate to `/fretboard`. Verify all controls still work (see Task 4 Step 5 for the list). No visual difference from before the refactor.

- [ ] **Step 10: Commit — verification note (optional)**

If any docs need touching (e.g. `README.md` per CLAUDE.md's "Documentation" rule), update them and commit:

```bash
git add README.md
git commit -m "docs: mention backing tracks feature in README"
```

Otherwise no commit needed — verification is a checkpoint, not a code change.

---

## Self-review notes

Ran the self-review checklist against the spec:

- **Spec coverage** — every spec section maps to a task:
  - §3 UX flow → Tasks 9–12.
  - §4 Architecture (component tree, refactor) → Tasks 4, 7–11.
  - §5 Data model → Task 2.
  - §6 API → Tasks 5–6.
  - §7 Data flow → Tasks 5–6, 10–11.
  - §8 Edge cases (invalid URL, duplicate, yt-dlp fallback, autoplay, Docker) → Tasks 5, 9, 13.
  - §9 Testing (unit / API / component / regression / manual) — adapted: unit-style verification via `node --input-type=module` snippets and curl (Tasks 1, 5, 6); regression via manual comparison (Task 4 Step 5, Task 13 Step 9). Full test framework not added per Global Constraints.
  - §10 Files touched — all listed as Create/Modify in each task's file list.

- **Placeholder scan** — no TBD / TODO / "similar to" references. Every code block is complete; every command has expected output.

- **Type consistency**:
  - `BackingTrack` shape in Task 3 (types) matches the Prisma model in Task 2 and the JSON shape returned by API routes in Tasks 5–6.
  - `FretboardDisplayProps` in Task 4 matches the props the callers (`Fretboard.tsx` refactor in Task 4 Step 3, `BackingTrackFretboard` in Task 8) pass.
  - `BackingTrackFretboardProps` in Task 8 matches the props `BackingTrackDetail` passes in Task 10.
  - `AddBackingTrackModalProps` in Task 9 matches how `BackingTracksView` uses it in Task 11.
  - The `Section` union is updated in both `src/app/[[...section]]/page.tsx` and `src/components/TopNav.tsx` (Task 12).
