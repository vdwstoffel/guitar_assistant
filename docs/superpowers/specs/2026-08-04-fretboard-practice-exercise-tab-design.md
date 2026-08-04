# Fretboard: Integrated Practice Exercise Tab

**Date:** 2026-08-04
**Status:** Approved

## Goal

Fold the standalone **Scale Practice Generator** (`/scales`) into the **Fretboard** page
(`/fretboard`) as a new tab below the fretboard. The Fretboard page already has Key and
Scale selectors and the full 24-fret board, so we only add "the rest" (exercise controls +
generated tab) and drop the duplicate standalone page.

## Design

### New "Practice Exercise" tab
- Added to `ScaleReferenceTabs` (the tab strip below the fretboard) alongside
  "Chords & Progressions" and "Interval Meanings".
- New id `'practice'`, label `Practice Exercise`.

### `PracticeExerciseTab` component (`src/components/ScaleExplorer/PracticeExerciseTab.tsx`)
- Props: `root: string`, `scaleType: ScaleType` — sourced from the fretboard's existing
  `selectedKey` / `selectedScale`. **No duplicate Key/Scale dropdowns.**
- Local state: `exerciseType`, `position`, `tempo`, `duration`, `bars`, and the generated
  `GeneratedExercise | null`.
- Controls rendered: Exercise, Position, Tempo (BPM), Note Duration, Bars, plus
  **Generate** and **↻ Regenerate**.
- Renders the generated tab via the existing `AlphaTexStatic` (alphaTab) viewer.
- When `scaleType === 'None'`, shows a "Select a scale above" hint (same pattern as the
  Chords tab) and no controls/output.
- **No companion mini-fretboard** — the main board above already visualizes the scale.

### Reused unchanged (the generation engine)
- `src/lib/exerciseGenerator.ts`
- `src/lib/alphatexSerializer.ts`
- `src/lib/scalePositions.ts`
- `src/components/AlphaTexStatic.tsx`

### Removed (consolidation)
- Delete `src/components/ScalePractice/` entirely:
  - `ScalePracticeGenerator.tsx`, `ExerciseControls.tsx`, `ScalePracticeFretboard.tsx`, `index.ts`
- `src/components/TopNav.tsx`: remove the `{ id: 'scales', label: 'Scale Practice' }`
  dropdown item, drop `'scales'` from the `Section` type and from `isTheoryActive`.
- `src/app/[[...section]]/page.tsx`: remove the `ScalePracticeGenerator` import, drop
  `'scales'` from the `Section` type and `getSectionFromPath`, and remove the
  `activeSection === 'scales'` render branch.

## Out of scope (v1)
- Syncing the exercise's Position selector to highlight that fret range on the main board.
  The two stay independent; the board keeps its own pentatonic position selector.

## Verification
- `npx tsc --noEmit` clean for touched files; no dangling `scales` / `ScalePractice`
  references (grep).
- Manual: Fretboard page → pick Key + Scale → Practice Exercise tab → Generate renders a
  tab; "None" scale shows the hint. Theory dropdown no longer lists Scale Practice.
