# Jam Tracks MarkersBar Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the lessons `MarkersBar` in the jam-tracks section so markers support `0-9` jump keys, edit/rename, delete, clear, and add exactly as in lessons.

**Architecture:** UI wiring only in `page.tsx`. Add `externalMarkersBar` + `onMarkerBarStateChange` to the jam-track `BottomPlayer` (so it stops rendering its internal marker panel and exposes its `MarkerBarState`), then render one horizontal `MarkersBar` below the compact player, wired to the already-jam-aware marker handlers and reusing the existing `markerBarState`.

**Tech Stack:** Next.js 16 / React 19 / TypeScript. No new deps, no API/schema changes.

## Global Constraints

- Single file changed: `src/app/[[...section]]/page.tsx`. No API, schema, or marker-handler changes — jam marker add/update/rename/delete/clear are already wired to `/api/jamtracks/...`.
- Reuse the existing `markerBarState` state (lessons and jam-tracks sections are mutually exclusive via `activeSection`, so only one `BottomPlayer` is mounted at a time).
- The jam `MarkersBar` must use `handleMarkersClear(currentJamTrack.id)` for clear-all (the lessons bar hardcodes `currentTrack.id`, which is null in jam tracks).
- Do NOT add the vertical PDF-sidebar `MarkersBar` variant — jam tracks need only the horizontal bar.
- Docker prod build, no hot reload: `docker compose restart nextjs-app` (v2, never `docker-compose`) to pick up changes.
- Local type check: `npx tsc --noEmit` — ignore pre-existing Prisma-generated errors; no NEW errors from `page.tsx`.
- Do NOT run prisma/npm build locally (root-owned dirs).

---

### Task 1: Wire the lessons MarkersBar into the jam-tracks section

**Files:**
- Modify: `src/app/[[...section]]/page.tsx` — jam-track `<BottomPlayer>` render (~line 2199) and the jam-tracks left column (~lines 2197-2223).

**Interfaces:**
- Consumes (already defined elsewhere, do not change): `markerBarState` state and its `MarkerBarState` fields (`showMarkers`, `leadIn`, `editingMarkerId`, `editingMarkerName`, `currentTime`, `setLeadIn`, `addMarker`, `jumpToMarker`, `setEditingMarkerId`, `setEditingMarkerName`, `formatTime`, `isCountingIn`, `currentCountInBeat`, `totalCountInBeats`, `trackTempo`, `trackTimeSignature`); `setMarkerBarState`; handlers `handleMarkerRename`, `handleMarkerDelete`, `handleMarkersClear`, `handleTempoChange`, `handlePageFlipAnticipationChange`; state `pageFlipAnticipation`; component `MarkersBar` (already imported at `page.tsx:10`).

- [ ] **Step 1: Add the two MarkersBar-wiring props to the jam-track BottomPlayer**

In `src/app/[[...section]]/page.tsx`, in the jam-tracks `<BottomPlayer>` (the one with `track={currentJamTrack}` and `compact={true}`), add `externalMarkersBar` and `onMarkerBarStateChange` immediately after the `compact={true}` line:

```tsx
                <BottomPlayer
                  track={currentJamTrack}
                  compact={true}
                  externalMarkersBar={true}
                  onMarkerBarStateChange={setMarkerBarState}
                  onMarkerAdd={stableOnMarkerAdd}
```

(Leave the rest of that `BottomPlayer`'s props unchanged.)

- [ ] **Step 2: Render MarkersBar below the compact player**

Still in the jam-tracks section, the left column wraps the compact player in:

```tsx
            {currentJamTrack && (
              <div className="shrink-0 border-t border-gray-700">
                <BottomPlayer
                  ...
                />
              </div>
            )}
```

Immediately AFTER that closing `)}` (and before the closing `</div>` of the left `w-1/2` column), add the MarkersBar block:

```tsx
            {currentJamTrack && markerBarState && markerBarState.showMarkers && (
              <div className="shrink-0 border-t border-gray-700">
                <MarkersBar
                  markers={currentJamTrack.markers}
                  visible={markerBarState.showMarkers}
                  leadIn={markerBarState.leadIn}
                  editingMarkerId={markerBarState.editingMarkerId}
                  editingMarkerName={markerBarState.editingMarkerName}
                  currentTime={markerBarState.currentTime}
                  onLeadInChange={markerBarState.setLeadIn}
                  onAddMarker={markerBarState.addMarker}
                  onJumpToMarker={markerBarState.jumpToMarker}
                  onStartEdit={(id, name) => {
                    markerBarState.setEditingMarkerId(id);
                    markerBarState.setEditingMarkerName(name);
                  }}
                  onEditNameChange={markerBarState.setEditingMarkerName}
                  onSaveEdit={(markerId, name) => {
                    handleMarkerRename(markerId, name);
                    markerBarState.setEditingMarkerId(null);
                  }}
                  onCancelEdit={() => markerBarState.setEditingMarkerId(null)}
                  onDelete={(markerId) => handleMarkerDelete(markerId)}
                  onClearAll={() => handleMarkersClear(currentJamTrack.id)}
                  formatTime={markerBarState.formatTime}
                  isCountingIn={markerBarState.isCountingIn}
                  currentCountInBeat={markerBarState.currentCountInBeat}
                  totalCountInBeats={markerBarState.totalCountInBeats}
                  trackTempo={markerBarState.trackTempo}
                  trackTimeSignature={markerBarState.trackTimeSignature}
                  onTempoChange={handleTempoChange}
                  pageFlipAnticipation={pageFlipAnticipation}
                  onPageFlipAnticipationChange={handlePageFlipAnticipationChange}
                />
              </div>
            )}
```

Notes:
- `layout` is omitted → defaults to `"horizontal"` (the wrapping bar), which is what we want.
- `onClearAll` uses `currentJamTrack.id` (NOT `currentTrack.id`).
- This mirrors the lessons full-width bar at `page.tsx:2101-2134`, minus the fit-to-page sidebar guard.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: no NEW errors from `page.tsx` (ignore pre-existing Prisma-generated errors). A misspelled `markerBarState` field or handler name would surface here.

- [ ] **Step 4: Restart the app**

Run: `docker compose restart nextjs-app`
Wait for the container to come up (`docker compose logs -f nextjs-app` until the server is ready).

- [ ] **Step 5: Manual verification**

In the browser, open the Jam Tracks section and select a jam track that has markers:
1. The lessons-style `MarkersBar` appears below the compact player; `BottomPlayer`'s old internal marker panel is gone.
2. Press `1`..`9` and `0` → playback jumps to markers 1-10 (sorted by time). It must NOT jump while typing in the rename input.
3. Rename a marker via the pencil/dialog → persists after reload.
4. Delete a marker and Clear all → persist.
5. Drag a marker on the waveform → its time updates (move).
6. Switch to Lessons → markers there still work unchanged (no regression).

- [ ] **Step 6: Commit**

```bash
git add src/app/[[...section]]/page.tsx
git commit -m "feat(jamtracks): use lessons MarkersBar for marker edit/delete/jump parity"
```

---

## Final verification

- [ ] `npx tsc --noEmit` clean (no new errors).
- [ ] `npx vitest run` still green (no unit tests added; confirm nothing broke).
- [ ] Manual jam-tracks checks from Task 1 Step 5 all pass.
- [ ] Squash-merge the feature branch into `main` per the project git workflow.
- [ ] Delete this plan file and the spec file once verified and merged (per Task Cleanup rule).
