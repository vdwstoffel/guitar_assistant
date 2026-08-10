# Recording Track + Tempo Tagging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tag each recording made from the global top-bar recorder with the currently-playing track's name, its playback speed (percent), and the date, and show those on the recordings list.

**Architecture:** Add three nullable columns to `Recording` (`trackName`, `trackId`, `tempo`). `page.tsx` passes a `nowPlaying` prop into `TopNav`; `TopNav` learns the live speed from the existing `playbackSpeedChange` window event and includes the metadata in its upload request. `BottomPlayer` starts firing that event on track load so the speed is known before any manual change. `RecordingsView` displays the new fields.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Prisma + SQLite, Vitest (pure-logic unit tests only), Docker (production build).

## Global Constraints

- Docker is a **production build with no hot reload**. After changes that the running app must pick up: `docker compose restart nextjs-app`. Prisma client regeneration or schema changes require a rebuild: `docker compose up -d --build nextjs-app`.
- **Always** back up the DB before any migration: `cp prisma/guitar_assistant.db prisma/guitar_assistant.db.backup`.
- Use Docker Compose **v2** (`docker compose`), never `docker-compose`.
- `.next/` and `src/generated/prisma/` are root-owned (from Docker). Do **not** run `npx prisma generate` or `npm run build` locally — regenerate the Prisma client inside Docker via a rebuild.
- Local type checking: `npx tsc --noEmit` (ignore pre-existing Prisma-generated errors).
- New DB columns must be **nullable** (SQLite supports `ALTER TABLE ADD COLUMN`, not `DROP COLUMN`).
- `Track` and `JamTrack` expose the display name as `title` (not `name`). Both have `playbackSpeed: number | null`.
- **Schema is applied via `prisma db push`, not migrations.** The container entrypoint (`docker-entrypoint.sh`) runs `npx prisma generate` then `npx prisma db push --skip-generate` on every start, so restarting the container both regenerates the client and syncs the DB to `schema.prisma` (adding new nullable columns idempotently). Do not hand-author a migration folder for this change — it would not be applied by the tooling. Source is bind-mounted (`.:/app`) and `DATABASE_URL=file:/app/prisma/guitar_assistant.db` is the same file as the host's `prisma/guitar_assistant.db`, so a plain `docker compose restart nextjs-app` (no `--build`) picks up source + schema changes.
- This codebase's Vitest suite covers **pure lib functions only** (`src/lib/**/*.test.ts`). There is no React/component or API-route test harness, and adding one is out of scope. Component/route/DB work is verified by `npx tsc --noEmit` plus a Docker restart and manual check, as specified per task.
- Squash-merge the feature branch into `main` when done.

---

### Task 1: Persist track name, track id, and tempo on a recording

**Files:**
- Modify: `prisma/schema.prisma:266-276` (model `Recording`)
- Modify: `src/types/index.ts:213-221` (`Recording` interface)
- Create: `src/lib/recordings/tempo.ts`
- Test: `src/lib/recordings/tempo.test.ts`
- Modify: `src/app/api/recordings/upload/route.ts:36-71`

**Interfaces:**
- Produces: `Recording` gains optional `trackName: string | null`, `trackId: string | null`, `tempo: number | null`.
- Produces: `parseTempo(raw: FormDataEntryValue | null): number | null` — returns a positive integer or `null`.
- Produces: `/api/recordings/upload` now reads FormData fields `trackName`, `trackId`, `tempo` and stores them; when `trackName` is present it becomes the default `title`.

- [ ] **Step 1: Write the failing test for `parseTempo`**

Create `src/lib/recordings/tempo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseTempo } from "./tempo";

describe("parseTempo", () => {
  it("returns null for null", () => {
    expect(parseTempo(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseTempo("")).toBeNull();
  });

  it("returns null for non-numeric text", () => {
    expect(parseTempo("fast")).toBeNull();
  });

  it("returns null for zero or negative", () => {
    expect(parseTempo("0")).toBeNull();
    expect(parseTempo("-50")).toBeNull();
  });

  it("parses a plain integer percent", () => {
    expect(parseTempo("82")).toBe(82);
  });

  it("rounds a decimal to the nearest integer", () => {
    expect(parseTempo("99.6")).toBe(100);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/recordings/tempo.test.ts`
Expected: FAIL — cannot resolve `./tempo` (module does not exist).

- [ ] **Step 3: Implement `parseTempo`**

Create `src/lib/recordings/tempo.ts`:

```ts
/**
 * Parse a tempo (playback speed percent) value coming from multipart FormData.
 * Returns a positive integer, or null when the value is missing/invalid.
 */
export function parseTempo(raw: FormDataEntryValue | null): number | null {
  if (raw === null) return null;
  const n = Number(raw.toString().trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/recordings/tempo.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Add the columns to the Prisma schema**

In `prisma/schema.prisma`, change model `Recording` (lines 266-276) to:

```prisma
model Recording {
  id        String   @id @default(uuid())
  title     String
  filePath  String   @unique
  duration  Float
  mimeType  String
  notes     String?
  trackName String?
  trackId   String?
  tempo     Int?
  createdAt DateTime @default(now())

  @@index([createdAt])
}
```

- [ ] **Step 6: Update the `Recording` TypeScript interface**

In `src/types/index.ts`, change the `Recording` interface (lines 213-221) to:

```ts
export interface Recording {
  id: string;
  title: string;
  filePath: string;
  duration: number;
  mimeType: string;
  notes: string | null;
  trackName: string | null;
  trackId: string | null;
  tempo: number | null;
  createdAt: string;
}
```

- [ ] **Step 7: Store the new fields in the upload route**

In `src/app/api/recordings/upload/route.ts`:

Add the import near the top (after the existing imports, around line 4):

```ts
import { parseTempo } from "@/lib/recordings/tempo";
```

Inside `POST`, after `const durationRaw = formData.get("duration");` (line 41), read the new fields:

```ts
    const trackNameRaw = formData.get("trackName");
    const trackIdRaw = formData.get("trackId");
    const tempo = parseTempo(formData.get("tempo"));
    const trackName = trackNameRaw ? sanitizeName(trackNameRaw.toString()) || null : null;
    const trackId = trackIdRaw ? trackIdRaw.toString() : null;
```

Change the `title` line (line 52) so a track name becomes the default title:

```ts
    const title = titleRaw
      ? sanitizeName(titleRaw.toString()) || `Recording ${slug}`
      : trackName || `Recording ${slug}`;
```

Change the `prisma.recording.create` data block (lines 64-71) to include the new columns:

```ts
    const recording = await prisma.recording.create({
      data: {
        title,
        filePath: relativePath,
        duration,
        mimeType,
        trackName,
        trackId,
        tempo,
      },
    });
```

- [ ] **Step 8: Back up the DB, then restart the container to apply the schema and regenerate the client**

```bash
cp prisma/guitar_assistant.db prisma/guitar_assistant.db.backup
docker compose restart nextjs-app
```

The entrypoint runs `prisma generate` (regenerates the client with the new fields) and `prisma db push` (adds the nullable columns to the DB), then rebuilds and starts. Wait for the container to finish building and come up (`docker compose logs -f nextjs-app` until you see the server ready). Then confirm the columns exist:

Run: `sqlite3 prisma/guitar_assistant.db "PRAGMA table_info(Recording);"`
Expected: output includes rows for `trackName`, `trackId`, and `tempo`.

- [ ] **Step 9: Verify types and a real upload end-to-end**

Type check: `npx tsc --noEmit` (ignore pre-existing Prisma-generated errors; there should be no new errors from the files touched here).

Functional check (container running): POST a tiny recording with metadata and confirm it round-trips:

```bash
printf 'test' > /tmp/rec.webm
curl -s -F 'file=@/tmp/rec.webm;type=audio/webm' -F 'duration=1' \
  -F 'trackName=Ex. 10 11 (Shifting Accents)' -F 'trackId=abc123' -F 'tempo=82' \
  http://localhost:3000/api/recordings/upload
curl -s http://localhost:3000/api/recordings | head -c 600
```

Expected: the create response and the list both show `"trackName":"Ex. 10 11 (Shifting Accents)"`, `"trackId":"abc123"`, `"tempo":82`, and `title` equal to the track name. Then delete the test row so it doesn't clutter the UI:

```bash
sqlite3 prisma/guitar_assistant.db "DELETE FROM Recording WHERE trackId='abc123';"
```

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma src/types/index.ts \
  src/lib/recordings/tempo.ts src/lib/recordings/tempo.test.ts \
  src/app/api/recordings/upload/route.ts
git commit -m "feat(recordings): persist track name, id, and tempo on upload"
```

---

### Task 2: Emit playback speed when a track loads

**Files:**
- Modify: `src/components/BottomPlayer.tsx:355-358` (inside the WaveSurfer `ready` handler)

**Interfaces:**
- Consumes: the existing window `CustomEvent('playbackSpeedChange', { detail: { trackId, speed } })` contract (already dispatched on user speed change at `BottomPlayer.tsx:251`).
- Produces: the same event now also fires once when a track's saved speed is applied on load, so listeners know the current speed without waiting for a manual change.

- [ ] **Step 1: Dispatch the event on track load**

In `src/components/BottomPlayer.tsx`, in the `ready` handler where the saved speed is applied (lines 355-358), add a dispatch right after `ws.setPlaybackRate(...)`:

```ts
      // Apply saved playback speed for this track
      const speed = track.playbackSpeed ?? 100;
      setPlaybackSpeed(speed);
      ws.setPlaybackRate(speed / 100, true);

      // Announce the loaded speed so listeners (e.g. the recorder) know it
      // without waiting for a manual speed change.
      window.dispatchEvent(new CustomEvent('playbackSpeedChange', {
        detail: { trackId: track.id, speed }
      }));
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no new errors from `BottomPlayer.tsx`.

- [ ] **Step 3: Restart the app and verify the event fires on load**

```bash
docker compose restart nextjs-app
```

In the browser DevTools console, run this before selecting a track:

```js
window.addEventListener('playbackSpeedChange', e => console.log('speed', e.detail));
```

Then open a lesson track. Expected: a `speed { trackId, speed }` log appears when the track finishes loading (before you touch the speed control). Confirm the existing `InProgressIndicator` speed badge still updates when you change speed manually (no regression).

- [ ] **Step 4: Commit**

```bash
git add src/components/BottomPlayer.tsx
git commit -m "feat(player): announce playback speed on track load"
```

---

### Task 3: Feed the playing track + speed to the recorder and send them on save

**Files:**
- Modify: `src/app/[[...section]]/page.tsx:68-71` (add a `nowPlaying` memo), `src/app/[[...section]]/page.tsx:1886-1893` (pass the prop)
- Modify: `src/components/TopNav.tsx:28-37` (prop type + destructure), `src/components/TopNav.tsx:50` (add state + effects nearby), `src/components/TopNav.tsx:202-223` (send metadata)

**Interfaces:**
- Consumes: `Track.title`, `Track.id`, `JamTrack.title`, `JamTrack.id` from `page.tsx` state (`currentTrack`, `currentJamTrack`).
- Consumes: the `playbackSpeedChange` window event from Task 2.
- Produces: `TopNav` prop `nowPlaying: { id: string; name: string } | null`.
- Produces: the recorder's upload FormData now includes `trackName`, `trackId`, and `tempo` when a track is playing (consumed by Task 1's route).

- [ ] **Step 1: Compute `nowPlaying` in page.tsx**

In `src/app/[[...section]]/page.tsx`, right after the `currentJamTrack` memo (lines 68-71), add:

```ts
  const nowPlaying = useMemo<{ id: string; name: string } | null>(() => {
    if (currentTrack) return { id: currentTrack.id, name: currentTrack.title };
    if (currentJamTrack) return { id: currentJamTrack.id, name: currentJamTrack.title };
    return null;
  }, [currentTrack, currentJamTrack]);
```

- [ ] **Step 2: Pass `nowPlaying` into `TopNav`**

In the `<TopNav ... />` render (lines 1886-1893), add the prop:

```tsx
      <TopNav
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onSearchTrackSelect={handleSearchTrackSelect}
        onSearchBookSelect={handleSearchBookSelect}
        onSearchJamTrackSelect={handleSearchJamTrackSelect}
        onGoToTrack={handleGoToTrackFromMetrics}
        nowPlaying={nowPlaying}
      />
```

- [ ] **Step 3: Add the prop to `TopNavProps` and destructure it**

In `src/components/TopNav.tsx`, add to `TopNavProps` (lines 28-35):

```ts
  nowPlaying: { id: string; name: string } | null;
```

And add `nowPlaying` to the destructured params (line 37):

```ts
const TopNav = memo(function TopNav({ activeSection, onSectionChange, onSearchTrackSelect, onSearchBookSelect, onSearchJamTrackSelect, onGoToTrack, nowPlaying }: TopNavProps) {
```

- [ ] **Step 4: Track the current tempo in `TopNav`**

In `src/components/TopNav.tsx`, just after `const recorder = useAudioRecorder();` (line 50), add state and two effects. Keep the values in refs too so the upload callback reads fresh values without re-creating:

```ts
  const [currentTempo, setCurrentTempo] = useState(100);
  const nowPlayingRef = useRef(nowPlaying);
  nowPlayingRef.current = nowPlaying;
  const currentTempoRef = useRef(100);
  currentTempoRef.current = currentTempo;

  // Reset tempo to default whenever the playing track changes; the load-time
  // playbackSpeedChange event (see BottomPlayer) will correct it immediately.
  useEffect(() => {
    setCurrentTempo(100);
  }, [nowPlaying?.id]);

  // Learn the live playback speed for the currently-playing track.
  useEffect(() => {
    const onSpeed = (event: Event) => {
      const detail = (event as CustomEvent<{ trackId: string; speed: number }>).detail;
      if (nowPlayingRef.current && detail.trackId === nowPlayingRef.current.id) {
        setCurrentTempo(detail.speed);
      }
    };
    window.addEventListener('playbackSpeedChange', onSpeed);
    return () => window.removeEventListener('playbackSpeedChange', onSpeed);
  }, []);
```

Note: `useEffect`, `useRef`, and `useState` are already imported at `TopNav.tsx:4`.

- [ ] **Step 5: Send the metadata on save**

In `handleRecorderToggle` (lines 202-223), after `fd.append('duration', result.duration.toString());` (line 211), append the track metadata when a track is playing:

```ts
        const np = nowPlayingRef.current;
        if (np) {
          fd.append('trackName', np.name);
          fd.append('trackId', np.id);
          fd.append('tempo', Math.round(currentTempoRef.current).toString());
        }
```

Because the callback reads `nowPlayingRef`/`currentTempoRef` (not the state directly), the existing `useCallback(..., [recorder])` dependency list at line 223 stays correct — do not change it.

- [ ] **Step 6: Verify types**

Run: `npx tsc --noEmit`
Expected: no new errors. In particular, `page.tsx` must now pass `nowPlaying` (a missing prop would be a type error), confirming the wiring compiles.

- [ ] **Step 7: Restart and verify end-to-end from the UI**

```bash
docker compose restart nextjs-app
```

In the browser: open a lesson track, set the speed to a distinct value (e.g. 82%), open the top-bar recorder, grant mic access if needed, Record for ~2s, Stop. Then check it saved with the tag:

```bash
curl -s http://localhost:3000/api/recordings | head -c 400
```

Expected: the newest recording shows the lesson's `trackName`, its `trackId`, and `"tempo":82`. Also record once with **nothing** playing (e.g. from the Tools section) and confirm it still saves with `trackName`/`trackId`/`tempo` all `null` and no error.

- [ ] **Step 8: Commit**

```bash
git add src/app/[[...section]]/page.tsx src/components/TopNav.tsx
git commit -m "feat(recordings): tag recordings with the playing track and its speed"
```

---

### Task 4: Show track name and tempo on the recordings list

**Files:**
- Modify: `src/components/RecordingsView.tsx:263-267` (the metadata row under each recording title)

**Interfaces:**
- Consumes: `Recording.trackName` and `Recording.tempo` (added in Task 1).

- [ ] **Step 1: Render the track name and tempo badge**

In `src/components/RecordingsView.tsx`, replace the metadata row (lines 263-267):

```tsx
                      <div className="text-xs text-gray-400 flex flex-wrap items-center gap-2 mt-0.5">
                        <span>{formatDate(rec.createdAt)}</span>
                        <span>•</span>
                        <span>{formatDuration(rec.duration)}</span>
                        {rec.trackName && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[16rem]">{rec.trackName}</span>
                          </>
                        )}
                        {rec.tempo != null && (
                          <span className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-200 tabular-nums">
                            {rec.tempo}%
                          </span>
                        )}
                      </div>
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no new errors from `RecordingsView.tsx`.

- [ ] **Step 3: Restart and verify in the UI**

```bash
docker compose restart nextjs-app
```

Open **Recordings → View all**. Expected: the recording made in Task 3 shows its track name and an `82%` badge next to the date and duration; older untagged recordings show just date + duration (no empty separators or `%` badge).

- [ ] **Step 4: Commit**

```bash
git add src/components/RecordingsView.tsx
git commit -m "feat(recordings): show track name and tempo on the recordings list"
```

---

## Final verification

- [ ] Full type check passes: `npx tsc --noEmit` (no new errors).
- [ ] Unit tests pass: `npx vitest run src/lib/recordings/tempo.test.ts`.
- [ ] Manual: record during a lesson at 82% → list shows name + `82%` + today's date.
- [ ] Manual: change speed mid-lesson before recording → saved tempo reflects the latest speed.
- [ ] Manual: record with nothing playing → saves untagged, no errors, list shows only date + duration.
- [ ] Squash-merge the feature branch into `main` per the project git workflow.
- [ ] Delete this plan file and the spec file once the feature is verified and merged (per Task Cleanup rule).
