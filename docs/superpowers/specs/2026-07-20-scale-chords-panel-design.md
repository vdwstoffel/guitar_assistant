# Scale Chords Panel — Design

**Date:** 2026-07-20
**Status:** Approved for planning

## Problem

In the Fretboard / Scale Explorer (`src/components/Fretboard.tsx`), the user selects a
scale and key (e.g. A Minor). They want a companion panel that tells them **which chords
work well with that scale** and lists a few **common chord progressions**, so they can
assemble a rhythm loop to practice lead over.

The panel is informational. It does **not** modify the fretboard visualization.

## Goals

- When a scale + key is selected, show the chords that work well with that scale.
- Each chord shows: roman numeral (function), chord name, and a mini fingering diagram.
- Below the chords, list common progressions (text only) resolved to actual chord names.
- Purely derived/presentational — no audio, no new state beyond what already exists, no API/DB.

## Non-Goals (YAGNI)

- No audio playback or strumming.
- No click-to-highlight / step-through of progressions.
- No changes to the fretboard note visualization.
- No changes to `KEY_DATA` in `src/lib/keyData.ts`.

## Design

### 1. Theory layer — `getDiatonicChords` in `src/lib/musicTheory.ts`

New pure function:

```ts
export interface DiatonicChord {
  name: string;        // "Am", "F", "Bdim"
  root: string;        // "A"
  quality: 'Major' | 'Minor' | 'Diminished' | 'Augmented';
  roman: string;       // "i", "VI", "vii°"
  degreeIndex: number; // 0-based position within the scale
}

export function getDiatonicChords(root: string, scaleType: ScaleType): DiatonicChord[];
```

Behavior:

- **7-note scales** (Major, Minor, Dorian, Phrygian, Lydian, Mixolydian, Harmonic Minor):
  build each chord by stacking thirds within the actual scale notes — for degree `i`, use
  scale notes at positions `i`, `i+2`, `i+4` (mod 7, wrapping the octave). Derive the triad
  quality from the semitone intervals root→third and root→fifth (computed via
  `getInterval`):
  - third `4`, fifth `7` → Major (major 3rd + perfect 5th)
  - third `3`, fifth `7` → Minor (minor 3rd + perfect 5th)
  - third `3`, fifth `6` → Diminished (minor 3rd + diminished 5th)
  - third `4`, fifth `8` → Augmented (major 3rd + augmented 5th)
  Generate the roman numeral from the degree number (I–VII), casing by quality
  (uppercase = major/aug, lowercase = minor/dim), with `°` suffix for diminished and `+`
  for augmented.
- **Pentatonic / Blues** (Minor Pentatonic, Major Pentatonic, Blues — 5–6 notes, no clean
  diatonic triads): fall back to the parent heptatonic scale of the same root:
  - Minor Pentatonic → Minor
  - Blues → Minor
  - Major Pentatonic → Major
  The panel surfaces a note indicating the parent scale used.
- **`None`**: function is not called (panel hidden).

This generic third-stacking approach is correct per-scale and avoids the enharmonic
key-name mismatch in `KEY_DATA` (the key selector uses sharp-only note names from `NOTES`,
while `KEY_DATA` uses flat spellings for several keys).

Chord names are spelled using the existing note names returned by `getScaleNotes`
(sharp-based). This is acceptable for practical use.

### 2. Progressions

Reuse the existing `COMMON_PROGRESSIONS` (index-based) from `src/lib/keyData.ts`. Each
progression's `indices` map into the computed `DiatonicChord[]`. Render each progression
with the **actual** chord names and numerals from the computed diatonic set (not the
major-centric `name` label), so a minor scale correctly shows e.g. `i – VI – III – VII`.

For pentatonic/blues scales, progressions resolve against the parent scale's diatonic
chords (7 entries), so all indices are valid.

### 3. UI components (in `src/components/ScaleExplorer/`)

- **`ScaleChords.tsx`** — the panel.
  - Props: `{ root: string; scaleType: ScaleType }`.
  - Renders nothing when `scaleType === 'None'`.
  - Header: "Chords in {root} {scaleType}" plus, when parent-derived, a small note like
    *"Chords from the parent A natural minor scale."*
  - A responsive grid of chord cards.
  - A "Common progressions" section below the grid.
  - Styled to match the existing amber/wood fretboard theme.
- **`MiniChordDiagram.tsx`** — a small, static SVG chord diagram.
  - Props: `{ root: string; quality: DiatonicChord['quality']; chordName: string }`.
  - Reuses the drawing approach from `src/components/ChordBuilder/components/ChordDiagram.tsx`
    (fret grid, strings, fretted dots, barre, X/O indicators) but static — no voicing
    navigation, no play button, no local state. Smaller dimensions.
  - Looks up the first voicing via `getVoicingsForChord(root, type)` where `type` maps the
    quality to the voicing library's type string (`Major`, `Minor`, `Diminished`,
    `Augmented`).
  - Fallback: if no voicing exists, show the chord's notes as text (matching the existing
    `NoVoicingPlaceholder` behavior).
- **Chord card**: roman numeral on top, chord name, mini diagram below.

### 4. Data flow

`Fretboard.tsx` already holds `selectedScale` and `selectedKey`. Render
`<ScaleChords root={selectedKey} scaleType={selectedScale} />` below the fretboard/legends,
gated on `selectedScale !== 'None'` and `!trainer.isRunning`. No new state, no API, no DB.

## Testing

- `getDiatonicChords` unit checks (representative cases):
  - C Major → `C, Dm, Em, F, G, Am, Bdim` with numerals `I ii iii IV V vi vii°`.
  - A Minor → `Am, Bdim, C, Dm, Em, F, G` with numerals `i ii° III iv v VI VII`.
  - A Minor Pentatonic → same as A Minor (parent fallback), with parent flag set.
  - A Harmonic Minor → `Am, Bdim, Caug, Dm, E, F, G#dim` (quality/numeral spot-checks).
- Manual/visual check in the Scale Explorer: select several scales/keys, confirm cards and
  diagrams render, fallback shows notes for chords lacking a voicing, and progressions list
  resolves to the right chord names.

## Files touched

- `src/lib/musicTheory.ts` — add `DiatonicChord` + `getDiatonicChords`.
- `src/components/ScaleExplorer/MiniChordDiagram.tsx` — new.
- `src/components/ScaleExplorer/ScaleChords.tsx` — new.
- `src/components/ScaleExplorer/index.ts` — export new components.
- `src/components/Fretboard.tsx` — render `<ScaleChords>`.
