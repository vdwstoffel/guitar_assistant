# Jam Tracks PDF Redesign + Decoupled Page-Flips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Jam Tracks Guitar-Pro detail view with a persistent master-detail layout (list left, multi-PDF viewer right, waveform bottom), and turn PDF page-flips into their own automation (P shortcut) shared by Jam Tracks and Lessons.

**Architecture:** Reuse the Lessons `PdfViewer` inside a new tabbed `JamTrackPdfPanel`; store multiple named PDFs per jam track via a new `JamTrackPdf` model. Page-flips become standalone records (`JamTrackPageFlip` per PDF, `TrackPageFlip` per track); the reverse-scan resolver is extracted to a unit-tested `src/lib` module and drives a playback effect in `page.tsx`. Existing `Marker.pdfPage` data is migrated into `TrackPageFlip` and the field is dropped.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Prisma + SQLite, react-pdf (via existing `PdfViewer`), WaveSurfer (via existing `BottomPlayer`), Vitest for pure-logic unit tests.

## Global Constraints

- Docker is a **production build with no hot reload**. After changes that the running app must pick up: `docker compose restart nextjs-app` (Compose **v2** only — never `docker-compose`).
- **Always back up the DB before any migration:** `cp prisma/guitar_assistant.db prisma/guitar_assistant.db.backup`.
- `DATABASE_URL=file:./prisma/guitar_assistant.db` is **relative to CWD** — verify migrations target `prisma/guitar_assistant.db`; apply SQL directly if `migrate deploy` targets the wrong path.
- SQLite **cannot** `ALTER TABLE DROP COLUMN` — drop columns via table-recreate in the migration SQL.
- `.next/` and `src/generated/prisma/` are **root-owned** (Docker). Run `npx prisma generate` / `npm run build` **inside Docker**; use `npx tsc --noEmit` locally for type checking.
- Unit tests (`npm test` → `vitest run`) cover **pure logic in `src/lib/` only**. Components and API routes are verified via `npx tsc --noEmit` + manual run in Docker.
- **All content is uploaded through the UI**, never copied into `music/` manually.
- Squash-merge the feature branch into `main` (one commit).

---

## File Structure

**Created:**
- `src/lib/pageFlips.ts` — pure page-flip resolver + input validation.
- `src/lib/pageFlips.test.ts` — vitest tests.
- `src/app/api/jamtracks/[id]/pdf/route.ts` — POST (upload) + GET (list) PDFs.
- `src/app/api/jamtracks/[id]/pdf/[pdfId]/route.ts` — PATCH (rename) + DELETE.
- `src/app/api/jamtracks/[id]/pdf/[pdfId]/pageflips/route.ts` — GET/POST flips.
- `src/app/api/jamtracks/[id]/pdf/[pdfId]/pageflips/[flipId]/route.ts` — PATCH/DELETE.
- `src/app/api/tracks/[id]/pageflips/route.ts` — GET/POST track flips.
- `src/app/api/tracks/[id]/pageflips/[flipId]/route.ts` — PATCH/DELETE.
- `src/components/JamTrackList.tsx` — persistent left rail.
- `src/components/JamTrackPdfPanel.tsx` — PDF tab bar + `PdfViewer` + upload dialog.
- `src/components/PageFlipDialog.tsx` — create/edit a page-flip.

**Modified:**
- `prisma/schema.prisma` — new models, drop `gpFilePath` + `Marker.pdfPage`.
- `src/types/index.ts` — new interfaces; update `JamTrack`, `Track`, `Marker`.
- `src/app/[[...section]]/page.tsx` — jam-tracks master-detail rewire; page-flip playback effect + dialog wiring; remove GP viewer/selector.
- `src/components/BottomPlayer.tsx` — add `P` shortcut; expose current page; render page-flip flags.
- `src/components/MarkerNameDialog.tsx` — remove pdfPage field.
- `src/components/MarkersBar.tsx` — remove pdfPage assign UI/badge; keep anticipation toggle.
- `src/app/api/library/scan/route.ts` — discover jam-track PDFs.
- `src/app/api/jamtracks/route.ts` + `[id]/route.ts` — include `pdfs` in responses.
- `README.md`.

**Deleted:**
- `src/components/GuitarProViewer.tsx`, `src/components/JamTrackCompactSelector.tsx`.
- `src/app/api/jamtracks/[id]/gp/route.ts`, `src/app/api/gp/**`.

---

## Phase 1 — Foundation: resolver + schema

### Task 1: Page-flip resolver (pure logic, TDD)

**Files:**
- Create: `src/lib/pageFlips.ts`
- Test: `src/lib/pageFlips.test.ts`

**Interfaces:**
- Produces:
  - `interface PageFlip { timestamp: number; pdfPage: number }`
  - `resolvePageFlip(flips: PageFlip[], currentTime: number, anticipationSeconds: number, fallbackPage: number | null): number | null` — returns the page for the last flip whose `timestamp - anticipationSeconds <= currentTime`, else `fallbackPage`.
  - `validatePageFlipInput(raw: unknown): { ok: true; value: { timestamp: number; pdfPage: number } } | { ok: false; error: string }` — `timestamp` finite ≥ 0, `pdfPage` integer ≥ 1.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { resolvePageFlip, validatePageFlipInput } from "./pageFlips";

describe("resolvePageFlip", () => {
  const flips = [
    { timestamp: 10, pdfPage: 2 },
    { timestamp: 30, pdfPage: 3 },
    { timestamp: 20, pdfPage: 4 }, // intentionally unsorted
  ];

  it("returns fallback before any flip is reached", () => {
    expect(resolvePageFlip(flips, 5, 0, 1)).toBe(1);
    expect(resolvePageFlip(flips, 5, 0, null)).toBe(null);
  });

  it("returns the page of the latest passed flip (handles unsorted input)", () => {
    expect(resolvePageFlip(flips, 22, 0, 1)).toBe(4); // 10 and 20 passed, 20 is latest
    expect(resolvePageFlip(flips, 35, 0, 1)).toBe(3);
  });

  it("applies anticipation so a flip triggers early", () => {
    expect(resolvePageFlip(flips, 9, 0, 1)).toBe(1);   // not yet at t=10
    expect(resolvePageFlip(flips, 9, 1, 1)).toBe(2);   // 1s early -> flip fires
  });

  it("returns fallback for an empty list", () => {
    expect(resolvePageFlip([], 100, 1, 7)).toBe(7);
  });
});

describe("validatePageFlipInput", () => {
  it("accepts a valid flip", () => {
    expect(validatePageFlipInput({ timestamp: 12.5, pdfPage: 3 })).toEqual({
      ok: true, value: { timestamp: 12.5, pdfPage: 3 },
    });
  });
  it("rejects non-integer or <1 pages", () => {
    expect(validatePageFlipInput({ timestamp: 1, pdfPage: 0 }).ok).toBe(false);
    expect(validatePageFlipInput({ timestamp: 1, pdfPage: 2.5 }).ok).toBe(false);
  });
  it("rejects bad timestamps and non-objects", () => {
    expect(validatePageFlipInput({ timestamp: -1, pdfPage: 1 }).ok).toBe(false);
    expect(validatePageFlipInput({ timestamp: Infinity, pdfPage: 1 }).ok).toBe(false);
    expect(validatePageFlipInput(null).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/pageFlips.test.ts`
Expected: FAIL — cannot find module `./pageFlips`.

- [ ] **Step 3: Implement**

```ts
export interface PageFlip {
  timestamp: number;
  pdfPage: number;
}

// Resolve which PDF page should be showing at `currentTime`.
// Returns the page of the latest flip whose (timestamp - anticipation) has
// been passed; before any flip, returns `fallbackPage`.
export function resolvePageFlip(
  flips: PageFlip[],
  currentTime: number,
  anticipationSeconds: number,
  fallbackPage: number | null
): number | null {
  let best: PageFlip | null = null;
  for (const f of flips) {
    if (currentTime >= f.timestamp - anticipationSeconds) {
      if (best === null || f.timestamp > best.timestamp) best = f;
    }
  }
  return best ? best.pdfPage : fallbackPage;
}

// Validate a raw page-flip payload from a request body.
export function validatePageFlipInput(
  raw: unknown
): { ok: true; value: { timestamp: number; pdfPage: number } } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Invalid page-flip payload" };
  }
  const { timestamp, pdfPage } = raw as Record<string, unknown>;
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp < 0) {
    return { ok: false, error: "Invalid timestamp" };
  }
  if (typeof pdfPage !== "number" || !Number.isInteger(pdfPage) || pdfPage < 1) {
    return { ok: false, error: "Invalid pdfPage" };
  }
  return { ok: true, value: { timestamp, pdfPage } };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/lib/pageFlips.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pageFlips.ts src/lib/pageFlips.test.ts
git commit -m "feat(pageflips): add page-flip resolver and input validation"
```

---

### Task 2: Schema, migration, and types

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/types/index.ts`
- Migration SQL: `prisma/migrations/<timestamp>_jamtrack_pdfs_and_pageflips/migration.sql`

**Interfaces:**
- Produces (Prisma models): `JamTrackPdf`, `JamTrackPageFlip`, `TrackPageFlip`; `JamTrack.pdfs`, `Track.pageFlips`; removes `JamTrack.gpFilePath`, `Marker.pdfPage`.
- Produces (TS): `JamTrackPdf`, `JamTrackPageFlip`, `TrackPageFlip` interfaces; `JamTrack.pdfs: JamTrackPdf[]` (minus `gpFilePath`); `Track.pageFlips: TrackPageFlip[]`; `Marker` minus `pdfPage`.

- [ ] **Step 1: Back up the database**

```bash
cp prisma/guitar_assistant.db prisma/guitar_assistant.db.backup
```

- [ ] **Step 2: Edit `prisma/schema.prisma`**

In `model JamTrack`: remove the `gpFilePath String?` line; add `pdfs JamTrackPdf[]` to the relations block.
In `model Marker`: remove the `pdfPage Int?` line.
In `model Track`: add `pageFlips TrackPageFlip[]` to the relations block.
Add three new models:

```prisma
model JamTrackPdf {
  id         String             @id @default(uuid())
  name       String
  filePath   String
  sortOrder  Int                @default(0)
  jamTrackId String
  jamTrack   JamTrack           @relation(fields: [jamTrackId], references: [id], onDelete: Cascade)
  pageFlips  JamTrackPageFlip[]
  createdAt  DateTime           @default(now())

  @@index([jamTrackId])
}

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

- [ ] **Step 3: Create the migration (empty) and hand-write SQL**

Generate a migration folder without applying, then replace its `migration.sql`. Because `DATABASE_URL` is relative and the DB is bind-mounted, prefer generating the SQL and applying it explicitly.

Run:
```bash
npx prisma migrate dev --name jamtrack_pdfs_and_pageflips --create-only
```

Replace the generated `migration.sql` with:

```sql
-- New tables
CREATE TABLE "JamTrackPdf" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "jamTrackId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JamTrackPdf_jamTrackId_fkey" FOREIGN KEY ("jamTrackId") REFERENCES "JamTrack" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "JamTrackPdf_jamTrackId_idx" ON "JamTrackPdf"("jamTrackId");

CREATE TABLE "JamTrackPageFlip" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "timestamp" REAL NOT NULL,
  "pdfPage" INTEGER NOT NULL,
  "jamTrackPdfId" TEXT NOT NULL,
  CONSTRAINT "JamTrackPageFlip_jamTrackPdfId_fkey" FOREIGN KEY ("jamTrackPdfId") REFERENCES "JamTrackPdf" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "JamTrackPageFlip_jamTrackPdfId_idx" ON "JamTrackPageFlip"("jamTrackPdfId");

CREATE TABLE "TrackPageFlip" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "timestamp" REAL NOT NULL,
  "pdfPage" INTEGER NOT NULL,
  "trackId" TEXT NOT NULL,
  CONSTRAINT "TrackPageFlip_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TrackPageFlip_trackId_idx" ON "TrackPageFlip"("trackId");

-- Data migration: existing marker page-flips -> TrackPageFlip
INSERT INTO "TrackPageFlip" ("id", "timestamp", "pdfPage", "trackId")
SELECT lower(hex(randomblob(16))), "timestamp", "pdfPage", "trackId"
FROM "Marker"
WHERE "pdfPage" IS NOT NULL;

-- Drop Marker.pdfPage (table recreate)
CREATE TABLE "new_Marker" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "timestamp" REAL NOT NULL,
  "trackId" TEXT NOT NULL,
  CONSTRAINT "Marker_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Marker" ("id", "name", "timestamp", "trackId")
SELECT "id", "name", "timestamp", "trackId" FROM "Marker";
DROP TABLE "Marker";
ALTER TABLE "new_Marker" RENAME TO "Marker";
CREATE INDEX "Marker_trackId_idx" ON "Marker"("trackId");

-- Drop JamTrack.gpFilePath (table recreate, preserving all other columns)
CREATE TABLE "new_JamTrack" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "duration" REAL NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "inProgress" BOOLEAN NOT NULL DEFAULT false,
  "favorite" BOOLEAN NOT NULL DEFAULT false,
  "lastPlayedAt" DATETIME,
  "completedAt" DATETIME,
  "tempo" INTEGER,
  "timeSignature" TEXT NOT NULL DEFAULT '4/4',
  "playbackSpeed" INTEGER,
  "volume" INTEGER,
  "lufs" REAL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_JamTrack" ("id","title","filePath","duration","completed","inProgress","favorite","lastPlayedAt","completedAt","tempo","timeSignature","playbackSpeed","volume","lufs","createdAt")
SELECT "id","title","filePath","duration","completed","inProgress","favorite","lastPlayedAt","completedAt","tempo","timeSignature","playbackSpeed","volume","lufs","createdAt" FROM "JamTrack";
DROP TABLE "JamTrack";
ALTER TABLE "new_JamTrack" RENAME TO "JamTrack";
CREATE UNIQUE INDEX "JamTrack_filePath_key" ON "JamTrack"("filePath");
```

> Verify the `JamTrack` column list against the current `schema.prisma` before running (copy the exact set minus `gpFilePath`). The unique index name must match Prisma's convention (`JamTrack_filePath_key`).

- [ ] **Step 4: Apply the migration to the correct DB and regenerate the client**

Apply SQL directly against the known path (safer than relying on the relative URL), then generate the client inside Docker:

```bash
sqlite3 prisma/guitar_assistant.db < prisma/migrations/<timestamp>_jamtrack_pdfs_and_pageflips/migration.sql
docker compose exec nextjs-app npx prisma generate   # regenerate root-owned client in-container
```

If foreign-key enforcement complains, wrap the SQL in `PRAGMA foreign_keys=OFF;` … `PRAGMA foreign_keys=ON;`.

- [ ] **Step 5: Verify the schema changed and data migrated**

Run:
```bash
sqlite3 prisma/guitar_assistant.db "SELECT count(*) FROM TrackPageFlip;"          # >= number of markers that had pages
sqlite3 prisma/guitar_assistant.db "PRAGMA table_info(Marker);"                    # no pdfPage column
sqlite3 prisma/guitar_assistant.db "PRAGMA table_info(JamTrack);"                  # no gpFilePath column
sqlite3 prisma/guitar_assistant.db ".tables"                                       # JamTrackPdf, JamTrackPageFlip, TrackPageFlip present
```
Expected: as annotated.

- [ ] **Step 6: Update `src/types/index.ts`**

Add interfaces and update existing ones:

```ts
export interface JamTrackPageFlip {
  id: string;
  timestamp: number;
  pdfPage: number;
  jamTrackPdfId: string;
}

export interface JamTrackPdf {
  id: string;
  name: string;
  filePath: string;
  sortOrder: number;
  jamTrackId: string;
  pageFlips: JamTrackPageFlip[];
  createdAt: string;
}

export interface TrackPageFlip {
  id: string;
  timestamp: number;
  pdfPage: number;
  trackId: string;
}
```

In `JamTrack`: remove `gpFilePath: string | null;`, add `pdfs: JamTrackPdf[];`.
In `Track`: add `pageFlips: TrackPageFlip[];`.
In `Marker`: remove `pdfPage?: number | null;`.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: New errors ONLY where removed fields (`gpFilePath`, `marker.pdfPage`) are still referenced — those are fixed in Tasks 8–11. Note them; do not fix unrelated code.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/types/index.ts
git commit -m "feat(db): add JamTrackPdf + page-flip models, migrate marker pages, drop gpFilePath"
```

---

## Phase 2 — Jam-track PDF API

### Task 3: Upload + list PDFs

**Files:**
- Create: `src/app/api/jamtracks/[id]/pdf/route.ts`

**Interfaces:**
- Consumes: `JamTrackPdf` model (Task 2), `MUSIC_DIR`.
- Produces: `POST /api/jamtracks/[id]/pdf` (multipart: `file`, `name`) → created `JamTrackPdf`; `GET` → `JamTrackPdf[]` ordered by `sortOrder`.

- [ ] **Step 1: Implement the route** (mirrors the removed `gp/route.ts` storage pattern)

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "_") || "tab";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pdfs = await prisma.jamTrackPdf.findMany({
    where: { jamTrackId: id },
    orderBy: { sortOrder: "asc" },
    include: { pageFlips: true },
  });
  return NextResponse.json(pdfs);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const jamTrack = await prisma.jamTrack.findUnique({ where: { id } });
    if (!jamTrack) return NextResponse.json({ error: "Jam track not found" }, { status: 404 });

    const form = await request.formData();
    const file = form.get("file") as File | null;
    const rawName = (form.get("name") as string | null)?.trim();
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (path.extname(file.name).toLowerCase() !== ".pdf") {
      return NextResponse.json({ error: "Only .pdf files are supported" }, { status: 400 });
    }
    const displayName = rawName || file.name.replace(/\.pdf$/i, "");

    const musicPath = path.resolve(MUSIC_DIR);
    const trackFolder = path.dirname(path.join(musicPath, jamTrack.filePath));
    await fs.mkdir(trackFolder, { recursive: true });

    // Unique filename within the folder
    let base = sanitize(displayName);
    let fileName = `${base}.pdf`;
    let n = 1;
    while (await fs.stat(path.join(trackFolder, fileName)).then(() => true).catch(() => false)) {
      fileName = `${base}_${n++}.pdf`;
    }
    const targetAbs = path.join(trackFolder, fileName);
    await fs.writeFile(targetAbs, Buffer.from(await file.arrayBuffer()));

    const count = await prisma.jamTrackPdf.count({ where: { jamTrackId: id } });
    const created = await prisma.jamTrackPdf.create({
      data: {
        jamTrackId: id,
        name: displayName,
        filePath: path.relative(musicPath, targetAbs),
        sortOrder: count,
      },
      include: { pageFlips: true },
    });
    return NextResponse.json(created);
  } catch (e) {
    console.error("Error uploading jam track PDF:", e);
    return NextResponse.json({ error: "Failed to upload PDF" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit` (no new errors in this file).
- [ ] **Step 3: Verify manually** — restart Docker, upload a PDF via curl:

```bash
docker compose restart nextjs-app
curl -F "file=@/path/to/tab.pdf" -F "name=Rhythm" http://localhost:3000/api/jamtracks/<id>/pdf
curl http://localhost:3000/api/jamtracks/<id>/pdf   # lists the new PDF
```
Expected: JSON `JamTrackPdf` returned; file present in `music/JamTracks/<title>/`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/jamtracks/[id]/pdf/route.ts
git commit -m "feat(api): upload and list jam-track PDFs"
```

---

### Task 4: Rename + delete a PDF

**Files:**
- Create: `src/app/api/jamtracks/[id]/pdf/[pdfId]/route.ts`

**Interfaces:**
- Produces: `PATCH` (body `{ name }`) → updated `JamTrackPdf`; `DELETE` → `{ success: true }` (removes DB row + file; cascade deletes its page-flips).

- [ ] **Step 1: Implement**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pdfId: string }> }
) {
  const { pdfId } = await params;
  const { name } = await request.json();
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }
  const updated = await prisma.jamTrackPdf.update({
    where: { id: pdfId },
    data: { name: name.trim() },
    include: { pageFlips: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; pdfId: string }> }
) {
  const { pdfId } = await params;
  const pdf = await prisma.jamTrackPdf.findUnique({ where: { id: pdfId } });
  if (!pdf) return NextResponse.json({ error: "PDF not found" }, { status: 404 });
  try {
    await fs.unlink(path.join(path.resolve(MUSIC_DIR), pdf.filePath));
  } catch { /* file may already be gone */ }
  await prisma.jamTrackPdf.delete({ where: { id: pdfId } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit`.
- [ ] **Step 3: Verify** — restart Docker; `curl -X PATCH -H 'Content-Type: application/json' -d '{"name":"Lead"}' .../pdf/<pdfId>` then `curl -X DELETE .../pdf/<pdfId>`; confirm file removed.
- [ ] **Step 4: Commit**

```bash
git add src/app/api/jamtracks/[id]/pdf/[pdfId]/route.ts
git commit -m "feat(api): rename and delete jam-track PDFs"
```

---

### Task 5: Include PDFs in jam-track responses + scan discovery

**Files:**
- Modify: `src/app/api/jamtracks/route.ts`, `src/app/api/jamtracks/[id]/route.ts`
- Modify: `src/app/api/library/scan/route.ts`

**Interfaces:**
- Produces: jam-track GET responses include `pdfs: JamTrackPdf[]` (each with `pageFlips`). Scan upserts a `JamTrackPdf` for every `*.pdf` found in a jam-track folder that has no matching `filePath` row.

- [ ] **Step 1: Add `pdfs` to the includes**

In both `jamtracks/route.ts` (GET all) and `jamtracks/[id]/route.ts` (GET one), add to the Prisma query:

```ts
include: {
  markers: { orderBy: { timestamp: "asc" } },
  loops: true,
  pdfs: { orderBy: { sortOrder: "asc" }, include: { pageFlips: true } },
},
```
(Match each file's existing `include` shape; add the `pdfs` line.)

- [ ] **Step 2: Add scan discovery**

In `src/app/api/library/scan/route.ts`, in the section that processes each jam-track folder, read the folder for `.pdf` files and upsert rows keyed by `filePath`:

```ts
// Discover PDFs already sitting in the jam-track folder
const folderAbs = path.dirname(path.join(musicPath, jamTrack.filePath));
const entries = await fs.readdir(folderAbs).catch(() => [] as string[]);
const pdfFiles = entries.filter((f) => f.toLowerCase().endsWith(".pdf"));
for (let i = 0; i < pdfFiles.length; i++) {
  const relPath = path.relative(musicPath, path.join(folderAbs, pdfFiles[i]));
  const existing = await prisma.jamTrackPdf.findFirst({ where: { jamTrackId: jamTrack.id, filePath: relPath } });
  if (!existing) {
    await prisma.jamTrackPdf.create({
      data: {
        jamTrackId: jamTrack.id,
        name: pdfFiles[i].replace(/\.pdf$/i, ""),
        filePath: relPath,
        sortOrder: (await prisma.jamTrackPdf.count({ where: { jamTrackId: jamTrack.id } })),
      },
    });
  }
}
```
(Adapt variable names — `musicPath`, `jamTrack`, `prisma`, `fs`, `path` — to whatever the scan route already has in scope.)

- [ ] **Step 3: Type-check** — `npx tsc --noEmit`.
- [ ] **Step 4: Verify** — restart Docker; `curl http://localhost:3000/api/jamtracks` shows `pdfs` arrays; run a library scan and confirm a manually-present PDF is discovered exactly once (re-scan does not duplicate).
- [ ] **Step 5: Commit**

```bash
git add src/app/api/jamtracks/route.ts src/app/api/jamtracks/[id]/route.ts src/app/api/library/scan/route.ts
git commit -m "feat(api): include PDFs in jam-track responses and discover them on scan"
```

---

## Phase 3 — Page-flip API

### Task 6: Jam-track page-flip routes

**Files:**
- Create: `src/app/api/jamtracks/[id]/pdf/[pdfId]/pageflips/route.ts`
- Create: `src/app/api/jamtracks/[id]/pdf/[pdfId]/pageflips/[flipId]/route.ts`

**Interfaces:**
- Consumes: `validatePageFlipInput` (Task 1).
- Produces: `POST` (body `{ timestamp, pdfPage }`) → created `JamTrackPageFlip`; `GET` → list; `PATCH` (`{ pdfPage }` and/or `{ timestamp }`) → updated; `DELETE` → `{ success: true }`.

- [ ] **Step 1: Implement collection route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validatePageFlipInput } from "@/lib/pageFlips";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pdfId: string }> }
) {
  const { pdfId } = await params;
  const flips = await prisma.jamTrackPageFlip.findMany({
    where: { jamTrackPdfId: pdfId },
    orderBy: { timestamp: "asc" },
  });
  return NextResponse.json(flips);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pdfId: string }> }
) {
  const { pdfId } = await params;
  const parsed = validatePageFlipInput(await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const created = await prisma.jamTrackPageFlip.create({
    data: { jamTrackPdfId: pdfId, ...parsed.value },
  });
  return NextResponse.json(created);
}
```

- [ ] **Step 2: Implement item route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ flipId: string }> }
) {
  const { flipId } = await params;
  const body = await request.json();
  const data: { timestamp?: number; pdfPage?: number } = {};
  if (typeof body.timestamp === "number" && Number.isFinite(body.timestamp)) data.timestamp = body.timestamp;
  if (typeof body.pdfPage === "number" && Number.isInteger(body.pdfPage) && body.pdfPage >= 1) data.pdfPage = body.pdfPage;
  const updated = await prisma.jamTrackPageFlip.update({ where: { id: flipId }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ flipId: string }> }
) {
  const { flipId } = await params;
  await prisma.jamTrackPageFlip.delete({ where: { id: flipId } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Type-check** — `npx tsc --noEmit`.
- [ ] **Step 4: Verify** — restart Docker; POST a flip, GET the list, PATCH the page, DELETE it via curl.
- [ ] **Step 5: Commit**

```bash
git add src/app/api/jamtracks/[id]/pdf/[pdfId]/pageflips
git commit -m "feat(api): jam-track page-flip CRUD"
```

---

### Task 7: Track page-flip routes

**Files:**
- Create: `src/app/api/tracks/[id]/pageflips/route.ts`
- Create: `src/app/api/tracks/[id]/pageflips/[flipId]/route.ts`

**Interfaces:**
- Produces: same shape as Task 6 but keyed by `trackId` on `TrackPageFlip`.

- [ ] **Step 1: Implement** — copy Task 6's two files, replacing `jamTrackPageFlip` → `trackPageFlip`, `jamTrackPdfId` → `trackId`, and the collection param `{ pdfId }` → `{ id }` (use `id` as `trackId`).

```ts
// route.ts POST body
const created = await prisma.trackPageFlip.create({
  data: { trackId: id, ...parsed.value },
});
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit`.
- [ ] **Step 3: Verify** — restart Docker; curl POST/GET/PATCH/DELETE against `/api/tracks/<id>/pageflips`.
- [ ] **Step 4: Commit**

```bash
git add src/app/api/tracks/[id]/pageflips
git commit -m "feat(api): track page-flip CRUD"
```

---

## Phase 4 — UI

### Task 8: `JamTrackPdfPanel` (tabs + reused PdfViewer + upload)

**Files:**
- Create: `src/components/JamTrackPdfPanel.tsx`

**Interfaces:**
- Consumes: `PdfViewer` (`src/components/PdfViewer.tsx`: props `pdfPath, currentPage, onPageChange, version?, onFitToPageChange?`), `JamTrackPdf` type.
- Produces:

```ts
interface JamTrackPdfPanelProps {
  jamTrackId: string;
  pdfs: JamTrackPdf[];
  activePdfId: string | null;
  onActivePdfChange: (pdfId: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  onUploaded: () => void;          // refetch jam track after upload
  onRenamed: () => void;
  onDeleted: () => void;
}
export default function JamTrackPdfPanel(props: JamTrackPdfPanelProps): JSX.Element
```

- [ ] **Step 1: Implement the component**

Behavior: a horizontal tab bar (one button per `pdf`, highlighted when `pdf.id === activePdfId`, double-click to rename inline), a trailing `＋ Add PDF` button opening a file picker + name prompt (reuse a lightweight prompt: file input + text input in a small modal), and below it the reused `PdfViewer` fed the active PDF's `filePath`. Empty state ("No PDF attached — add one") when `pdfs` is empty.

```tsx
"use client";
import { useRef, useState } from "react";
import PdfViewer from "./PdfViewer";
import type { JamTrackPdf } from "@/types";

export default function JamTrackPdfPanel({
  jamTrackId, pdfs, activePdfId, onActivePdfChange,
  currentPage, onPageChange, onUploaded, onRenamed, onDeleted,
}: JamTrackPdfPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const active = pdfs.find((p) => p.id === activePdfId) ?? pdfs[0] ?? null;

  async function upload() {
    if (!pendingFile) return;
    const fd = new FormData();
    fd.append("file", pendingFile);
    fd.append("name", name.trim() || pendingFile.name.replace(/\.pdf$/i, ""));
    await fetch(`/api/jamtracks/${jamTrackId}/pdf`, { method: "POST", body: fd });
    setPendingFile(null); setName("");
    onUploaded();
  }
  async function rename(pdf: JamTrackPdf, newName: string) {
    await fetch(`/api/jamtracks/${jamTrackId}/pdf/${pdf.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    onRenamed();
  }
  async function remove(pdf: JamTrackPdf) {
    await fetch(`/api/jamtracks/${jamTrackId}/pdf/${pdf.id}`, { method: "DELETE" });
    onDeleted();
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 border-b border-gray-700 px-2 py-1 overflow-x-auto">
        {pdfs.map((p) => (
          <button key={p.id}
            onClick={() => onActivePdfChange(p.id)}
            onDoubleClick={() => { const n = prompt("Rename PDF", p.name); if (n) rename(p, n); }}
            className={`px-3 py-1 rounded text-sm whitespace-nowrap ${p.id === active?.id ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300"}`}>
            {p.name}
          </button>
        ))}
        <button onClick={() => fileRef.current?.click()} className="px-3 py-1 rounded text-sm bg-gray-800 text-gray-300 border border-gray-600">＋ Add PDF</button>
        {active && <button onClick={() => { if (confirm(`Delete "${active.name}"?`)) remove(active); }} className="ml-auto px-2 py-1 text-xs text-red-400">Delete</button>}
        <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPendingFile(f); setName(f.name.replace(/\.pdf$/i, "")); } e.target.value = ""; }} />
      </div>

      {pendingFile && (
        <div className="flex items-center gap-2 px-2 py-2 border-b border-gray-700 bg-gray-800">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="PDF name…"
            className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white" autoFocus />
          <button onClick={upload} className="px-3 py-1 bg-green-600 rounded text-sm text-white">Upload</button>
          <button onClick={() => setPendingFile(null)} className="px-3 py-1 bg-gray-700 rounded text-sm text-gray-300">Cancel</button>
        </div>
      )}

      <div className="flex-1 min-h-0">
        {active ? (
          <PdfViewer pdfPath={active.filePath} currentPage={currentPage} onPageChange={onPageChange} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm">No PDF attached — add one with ＋ Add PDF.</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit` (this file only).
- [ ] **Step 3: Commit**

```bash
git add src/components/JamTrackPdfPanel.tsx
git commit -m "feat(jamtracks): tabbed multi-PDF panel reusing the Lessons PdfViewer"
```

---

### Task 9: `JamTrackList` + master-detail rewire; remove GP viewer/selector

**Files:**
- Create: `src/components/JamTrackList.tsx`
- Modify: `src/app/[[...section]]/page.tsx` (jam-tracks section, lines ~2088–2270)
- Delete: `src/components/GuitarProViewer.tsx`, `src/components/JamTrackCompactSelector.tsx`, `src/app/api/jamtracks/[id]/gp/route.ts`, `src/app/api/gp/` (if present)

**Interfaces:**
- Consumes: `JamTrackPdfPanel` (Task 8), existing `handleJamTrackSelect`, `jamTracks`, `currentJamTrack`, upload/YouTube handlers.
- Produces:

```ts
interface JamTrackListProps {
  jamTracks: JamTrack[];
  currentJamTrackId: string | null;
  onSelect: (id: string) => void;
  onUpload: (files: FileList) => void;
  isUploading: boolean;
  onYouTubeImport: () => void;
  isImportingFromYouTube: boolean;
}
```

- [ ] **Step 1: Implement `JamTrackList`** — a persistent vertical list: header with title + Upload + YouTube buttons (reuse the button markup currently in `JamTracksView`), then rows (`title`, duration, completion badge) with the selected row highlighted; clicking a row calls `onSelect(id)`. Keep it presentational — no expand-in-place detail.

- [ ] **Step 2: Rewire the `jamtracks` branch in `page.tsx`** to a single master-detail layout (replaces both the "no track" and "compact" branches, lines ~2088–2270):

```tsx
) : activeSection === 'jamtracks' ? (
  <div className="flex flex-col h-full overflow-hidden">
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Left: persistent list */}
      <div className="w-72 shrink-0 border-r border-gray-700 overflow-y-auto">
        <JamTrackList
          jamTracks={jamTracks}
          currentJamTrackId={currentJamTrack?.id ?? null}
          onSelect={handleJamTrackSelect}
          onUpload={handleJamTrackUpload}
          isUploading={isUploadingJamTracks}
          onYouTubeImport={handleYouTubeImport}
          isImportingFromYouTube={isImportingFromYouTube}
        />
      </div>
      {/* Right: PDF panel */}
      <div className="flex-1 min-w-0 min-h-0">
        {currentJamTrack ? (
          <JamTrackPdfPanel
            jamTrackId={currentJamTrack.id}
            pdfs={currentJamTrack.pdfs}
            activePdfId={activeJamPdfId}
            onActivePdfChange={setActiveJamPdfId}
            currentPage={pdfPage}
            onPageChange={setPdfPage}
            onUploaded={refreshCurrentJamTrack}
            onRenamed={refreshCurrentJamTrack}
            onDeleted={refreshCurrentJamTrack}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">Select a jam track to get started</div>
        )}
      </div>
    </div>
    {/* Bottom: waveform player, full width */}
    {currentJamTrack && (
      <div className="shrink-0">
        <BottomPlayer
          track={currentJamTrack}
          compact={true}
          onMarkerAdd={stableOnMarkerAdd}
          onMarkerUpdate={stableOnMarkerUpdate}
          onMarkerRename={stableOnMarkerRename}
          onMarkerDelete={stableOnMarkerDelete}
          onMarkersClear={stableOnMarkersClear}
          onLoopSave={stableOnLoopSave}
          onLoopDelete={stableOnLoopDelete}
          onTimeUpdate={stableOnTimeUpdate}
          onSeekReady={stableOnSeekReady}
          /* page-flip props added in Task 10 */
        />
      </div>
    )}
  </div>
) : ...
```

Add supporting state near the other jam-track state in `page.tsx`:

```ts
const [activeJamPdfId, setActiveJamPdfId] = useState<string | null>(null);
// reset active PDF when the selected jam track changes
useEffect(() => {
  setActiveJamPdfId(currentJamTrack?.pdfs[0]?.id ?? null);
}, [currentJamTrack?.id]);
// refetch the current jam track after PDF add/rename/delete
const refreshCurrentJamTrack = useCallback(async () => {
  if (!currentJamTrack) return;
  const res = await fetch(`/api/jamtracks/${currentJamTrack.id}`);
  if (res.ok) { const updated = await res.json(); handleJamTrackUpdate(updated); }
}, [currentJamTrack?.id]);
```
(Wire `handleJamTrackUpdate` to replace the track in `jamTracks` state — it already exists; confirm it merges by id.)

- [ ] **Step 3: Remove GP + selector code** — delete the four files listed above; remove imports of `GuitarProViewer`, `JamTrackCompactSelector`, and the now-unused `handleJamTrackGpUpload` / `handleJamTrackGpDelete` handlers and their `onGpUpload`/`onGpDelete` props. Remove the desktop markers sidebar block (lines ~2178–2213) and the mobile `MarkersBar` block if it referenced the old layout (markers now render on the waveform only — keep `MarkersBar` only if still used elsewhere; otherwise drop its jam-track usage).

- [ ] **Step 4: Type-check** — `npx tsc --noEmit`. Fix all references to removed `gpFilePath` and deleted components until clean.

- [ ] **Step 5: Verify in Docker** — restart; open Jam Tracks: list stays visible, clicking a track loads its PDF tabs on the right and the waveform at the bottom; switching tracks does not collapse the list; add/rename/delete a PDF and switch tabs.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(jamtracks): persistent master-detail layout; remove Guitar Pro viewer/selector"
```

---

### Task 10: Page-flip automation — P shortcut, dialog, playback, waveform flags

**Files:**
- Create: `src/components/PageFlipDialog.tsx`
- Modify: `src/components/BottomPlayer.tsx`
- Modify: `src/app/[[...section]]/page.tsx`

**Interfaces:**
- Consumes: `resolvePageFlip` (Task 1), page-flip APIs (Tasks 6–7), `PageFlipDialog`.
- Produces: `PageFlipDialog` props `{ isOpen, timestamp, defaultPage, formatTime, onSave(page:number), onCancel }`. `BottomPlayer` gains props `currentPdfPage?: number`, `onPageFlipAdd?: (timestamp: number, page: number) => void`, `pageFlips?: { id:string; timestamp:number; pdfPage:number }[]`, `onPageFlipEdit?`, `onPageFlipDelete?`.

- [ ] **Step 1: Implement `PageFlipDialog`** — a modal styled like `MarkerNameDialog`, showing the timestamp (read-only) and a numeric page input pre-filled with `defaultPage`; Enter/Save calls `onSave(page)`, Escape cancels.

- [ ] **Step 2: Add the `P` shortcut in `BottomPlayer`** — in the keydown handler (`BottomPlayer.tsx` ~1046–1107), after the `KeyM` block:

```ts
if (e.code === "KeyP" && track && onPageFlipAddRef.current) {
  e.preventDefault();
  onPageFlipAddRef.current(waveSurferRef.current?.getCurrentTime() ?? 0, currentPdfPageRef.current ?? 1);
}
```
Add `currentPdfPageRef` / `onPageFlipAddRef` refs kept in sync with the new props (mirror how `handleVolume`/`track` are captured), and add `P` to the shortcuts help list. Confirm `P` is not otherwise bound (it isn't).

- [ ] **Step 3: Render page-flip flags on the waveform** — where marker regions are created (WaveSurfer `RegionsPlugin`), add regions for `pageFlips` with a distinct color and a `→p{pdfPage}` label; clicking a flag calls `onPageFlipEdit(id)`. Keep them visually separate from markers (e.g. purple vs. yellow).

- [ ] **Step 4: Wire in `page.tsx`** — hold `pageFlipDialog` state `{ open, timestamp, defaultPage } | null`. Pass to `BottomPlayer`:
  - Lessons: `currentPdfPage={pdfPage}`, `pageFlips={currentTrack?.pageFlips ?? []}`, `onPageFlipAdd={(t,p)=>setPageFlipDialog({open:true,timestamp:t,defaultPage:p})}`.
  - Jam Tracks: `currentPdfPage={pdfPage}`, `pageFlips={activeJamPdf?.pageFlips ?? []}` where `activeJamPdf = currentJamTrack?.pdfs.find(p=>p.id===activeJamPdfId)`, same `onPageFlipAdd`.

  On dialog save, POST to the correct endpoint based on active section:

```ts
async function savePageFlip(page: number, timestamp: number) {
  if (activeSection === "jamtracks" && activeJamPdfId) {
    await fetch(`/api/jamtracks/${currentJamTrack!.id}/pdf/${activeJamPdfId}/pageflips`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timestamp, pdfPage: page }),
    });
    await refreshCurrentJamTrack();
  } else if (currentTrack) {
    await fetch(`/api/tracks/${currentTrack.id}/pageflips`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timestamp, pdfPage: page }),
    });
    await refreshCurrentTrack();  // refetch track incl. pageFlips
  }
}
```
  Add a `refreshCurrentTrack` mirroring `refreshCurrentJamTrack` for Lessons if one does not exist.

- [ ] **Step 5: Replace the marker-based auto-flip effect** (`page.tsx` ~1761–1790) with a `resolvePageFlip`-based effect for **both** sections:

```ts
useEffect(() => {
  const flips = activeSection === "jamtracks"
    ? (currentJamTrack?.pdfs.find(p => p.id === activeJamPdfId)?.pageFlips ?? [])
    : (currentTrack?.pageFlips ?? []);
  if (flips.length === 0) return;
  const fallback = activeSection === "jamtracks" ? null : (currentTrack?.pdfPage ?? null);
  const target = resolvePageFlip(flips, currentAudioTime, pageFlipAnticipation ? 1 : 0, fallback);
  if (target != null && target !== lastAutoFlipPage.current) {
    lastAutoFlipPage.current = target;
    setPdfPage(target);
  }
}, [activeSection, currentTrack?.id, currentJamTrack?.id, activeJamPdfId, currentAudioTime, pageFlipAnticipation]);
```
(Rename the existing `lastTrackAutoFlipPage` ref to `lastAutoFlipPage`, and reset it to `null` when the track/jamtrack/activePdf changes.)

- [ ] **Step 6: Type-check** — `npx tsc --noEmit`.

- [ ] **Step 7: Verify in Docker** — restart. In both Lessons and Jam Tracks: press **P** during playback → dialog opens defaulting to the visible page → save creates a flag on the waveform; playback flips the page at that time; anticipation toggle makes it fire 1s early; click a flag to edit/delete; jam-track flips are per active PDF tab.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(pageflips): P-shortcut page-flip automations for Lessons and Jam Tracks"
```

---

### Task 11: Strip marker `pdfPage` UI

**Files:**
- Modify: `src/components/MarkerNameDialog.tsx`, `src/components/MarkersBar.tsx`
- Modify: marker create/update handlers in `page.tsx` and `src/app/api/markers/route.ts` + `[id]/route.ts`

**Interfaces:**
- Produces: `MarkerNameDialog` no longer has `currentPdfPage`, `hasPdf`, `initialPdfPage`; `onSave: (name: string) => void`. Marker POST/PUT no longer read `pdfPage`.

- [ ] **Step 1: Simplify `MarkerNameDialog`** — remove the `hasPdf` page-number block (lines 94–109), the `pageNumber` state, and the `pdfPage` params; `onSave` becomes `(name: string) => void`.

- [ ] **Step 2: Update `MarkersBar`** — remove the "assign current PDF page" quick-action (lines ~330–343), the `p.{N}` badge (lines ~298, 326–329), and any `pdfPage` plumbing; **keep** the `pageFlipAnticipation` toggle (it now governs page-flips). Update `handleDialogSave` to pass only the name.

- [ ] **Step 3: Update callers** — in `page.tsx`, change marker add/rename handlers to the `(name) => ...` signature; in `src/app/api/markers/route.ts` remove `pdfPage` from the destructure and the create `data`; in `[id]/route.ts` remove `pdfPage` from the update.

- [ ] **Step 4: Type-check** — `npx tsc --noEmit` until clean (no remaining `pdfPage` references on markers).

- [ ] **Step 5: Verify in Docker** — restart; add/rename a marker in both sections — dialog shows only a name field; existing markers still jump correctly; page-flips still work (from Task 10).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(markers): remove pdfPage from markers now that page-flips are separate"
```

---

### Task 12: Docs + cleanup

**Files:**
- Modify: `README.md`
- Delete: any completed `tasks/` file for this work (if present)

- [ ] **Step 1: Update `README.md`** — in the Jam Tracks / Features section, replace Guitar Pro tab language with: multiple named PDF tabs per jam track (upload, rename, switch), persistent list layout, and P-shortcut page-flip automations (shared with Lessons).
- [ ] **Step 2: Remove any stale `tasks/` entry** for this feature.
- [ ] **Step 3: Full type-check + build in Docker**

```bash
npx tsc --noEmit
docker compose exec nextjs-app npm run build
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: document jam-track multi-PDF + page-flip automations"
```

---

## Self-Review Notes

- **Spec coverage:** layout (Task 9), multi-PDF upload/name/switch (Tasks 3–5, 8), reuse Lessons PdfViewer (Task 8), markers-on-waveform-only (Task 9 removes sidebar), replace GP with PDF (Tasks 2, 9), decoupled page-flips + P shortcut for both sections (Tasks 1, 6, 7, 10), migrate-then-remove `Marker.pdfPage` (Task 2), remove marker page UI (Task 11), scan discovery (Task 5), docs (Task 12). All covered.
- **Type consistency:** resolver `resolvePageFlip`/`validatePageFlipInput` names match across Tasks 1/6/7/10; `JamTrackPdf.pageFlips`, `Track.pageFlips` match Tasks 2/8/10; `activeJamPdfId`/`refreshCurrentJamTrack` consistent across Tasks 9/10.
- **Testing approach:** pure logic is unit-tested (Task 1); routes/components verified via `tsc --noEmit` + Docker run, matching this repo's actual test surface.
```
