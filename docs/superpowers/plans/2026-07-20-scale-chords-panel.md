# Scale Chords Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a companion panel to the Fretboard / Scale Explorer that lists the chords that work well with the selected scale (roman numeral + name + mini fingering diagram) and a set of common progressions.

**Architecture:** A new pure theory helper `getDiatonicChords` derives diatonic triads by stacking thirds within the selected scale's own notes (with a parent-scale fallback for pentatonic/blues). Two new presentational React components — `MiniChordDiagram` (compact static SVG) and `ScaleChords` (the panel) — render the result. `Fretboard.tsx` renders the panel below the fretboard. No new state, API, or DB.

**Tech Stack:** Next.js 16 / React 19 / TypeScript 5 / Tailwind CSS 4. SVG for chord diagrams. Existing helpers in `src/lib/musicTheory.ts`, `src/lib/chordVoicings.ts`, `src/lib/keyData.ts`.

## Global Constraints

- Note names are sharp-based throughout (from `NOTES` in `src/lib/musicTheory.ts`). Chord spellings follow suit (e.g. `A#dim`, not `Bbdim`).
- No test framework is installed. Type verification uses `npx tsc --noEmit` (filter Prisma-generated errors). Theory-layer logic is verified with a throwaway Node script (Node v24 runs `.ts` files natively). UI is verified visually in the dev server.
- Do NOT run Prisma commands or `npm run build` locally (Docker owns `.next/` and `src/generated/prisma/`).
- Follow the existing amber/wood theme used in `Fretboard.tsx` and the SVG style in `src/components/ChordBuilder/components/ChordDiagram.tsx`.
- Commit after each task. This work happens on branch `feat/scale-chords-panel`.

---

## File Structure

- `src/lib/musicTheory.ts` — **modify**: add `DiatonicChord` interface + `getDiatonicChords` function.
- `src/components/ScaleExplorer/MiniChordDiagram.tsx` — **create**: compact static SVG chord diagram.
- `src/components/ScaleExplorer/ScaleChords.tsx` — **create**: the panel (chord grid + progressions).
- `src/components/ScaleExplorer/index.ts` — **modify**: export `ScaleChords`.
- `src/components/Fretboard.tsx` — **modify**: render `<ScaleChords>` below the fretboard.

---

## Task 1: `getDiatonicChords` theory helper

**Files:**
- Modify: `src/lib/musicTheory.ts` (append after `getChordNotes`, around line 240)
- Test: throwaway script `/home/stoffel/Documents/guitar_assistant/scale-chords-check.ts` (deleted before commit)

**Interfaces:**
- Consumes (existing, in same file): `getScaleNotes(root: string, scaleType: string): string[]`, `getInterval(note1: string, note2: string): number`, `SCALE_FORMULAS`, `ScaleType`.
- Produces:
  - `interface DiatonicChord { name: string; root: string; quality: 'Major' | 'Minor' | 'Diminished' | 'Augmented'; roman: string; degreeIndex: number }`
  - `function getDiatonicChords(root: string, scaleType: string): { chords: DiatonicChord[]; parentScale: ScaleType | null }`

- [ ] **Step 1: Write the implementation**

Append to `src/lib/musicTheory.ts` (after the `getChordNotes` function, before the next section):

```ts
// ---------------------------------------------------------------------------
// Diatonic chords for a scale
// ---------------------------------------------------------------------------

/** A chord built on one degree of a scale. */
export interface DiatonicChord {
  /** Full chord symbol, e.g. "Am", "F", "A#dim". */
  name: string;
  /** Root note name of the chord, e.g. "A". */
  root: string;
  quality: 'Major' | 'Minor' | 'Diminished' | 'Augmented';
  /** Roman-numeral function, e.g. "i", "VI", "vii°", "III+". */
  roman: string;
  /** 0-based position of the chord within the scale. */
  degreeIndex: number;
}

/**
 * Pentatonic/blues scales have 5-6 notes and no clean stack-of-thirds triads,
 * so their diatonic chords are taken from a parent heptatonic scale of the
 * same root.
 */
const PARENT_SCALE_FOR_CHORDS: Record<string, ScaleType> = {
  'Minor Pentatonic': 'Minor',
  'Major Pentatonic': 'Major',
  'Blues': 'Minor',
};

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const QUALITY_SUFFIX: Record<DiatonicChord['quality'], string> = {
  Major: '',
  Minor: 'm',
  Diminished: 'dim',
  Augmented: 'aug',
};

/** Classify a triad from the semitone sizes of its 3rd and 5th above the root. */
function triadQuality(
  thirdSemis: number,
  fifthSemis: number,
): DiatonicChord['quality'] {
  if (thirdSemis === 4 && fifthSemis === 7) return 'Major';
  if (thirdSemis === 3 && fifthSemis === 7) return 'Minor';
  if (thirdSemis === 3 && fifthSemis === 6) return 'Diminished';
  if (thirdSemis === 4 && fifthSemis === 8) return 'Augmented';
  // Fallback for unusual stacks: classify by the third.
  return thirdSemis <= 3 ? 'Minor' : 'Major';
}

/** Build the roman numeral for a degree given its chord quality. */
function romanFor(degreeIndex: number, quality: DiatonicChord['quality']): string {
  const base = ROMAN_NUMERALS[degreeIndex];
  switch (quality) {
    case 'Major':
      return base;
    case 'Augmented':
      return base + '+';
    case 'Minor':
      return base.toLowerCase();
    case 'Diminished':
      return base.toLowerCase() + '°';
  }
}

/**
 * Return the diatonic chords for a scale, built by stacking thirds within the
 * scale's own notes. For pentatonic/blues scales the chords come from a parent
 * heptatonic scale (see PARENT_SCALE_FOR_CHORDS); `parentScale` names that
 * scale, or is null when the requested scale is used directly.
 *
 * Returns empty chords for "None" or any scale that is not 7 notes after the
 * parent mapping.
 */
export function getDiatonicChords(
  root: string,
  scaleType: string,
): { chords: DiatonicChord[]; parentScale: ScaleType | null } {
  const parentScale = PARENT_SCALE_FOR_CHORDS[scaleType] ?? null;
  const effectiveScale = parentScale ?? scaleType;
  const notes = getScaleNotes(root, effectiveScale);
  if (notes.length !== 7) return { chords: [], parentScale };

  const chords: DiatonicChord[] = notes.map((chordRoot, i) => {
    const third = notes[(i + 2) % 7];
    const fifth = notes[(i + 4) % 7];
    const quality = triadQuality(
      getInterval(chordRoot, third),
      getInterval(chordRoot, fifth),
    );
    return {
      root: chordRoot,
      quality,
      name: chordRoot + QUALITY_SUFFIX[quality],
      roman: romanFor(i, quality),
      degreeIndex: i,
    };
  });

  return { chords, parentScale };
}
```

- [ ] **Step 2: Write the throwaway verification script**

Create `scale-chords-check.ts` in the repo root:

```ts
import { getDiatonicChords } from './src/lib/musicTheory.ts';

function assertEq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}\n  expected ${e}\n  actual   ${a}`);
    process.exitCode = 1;
  } else {
    console.log(`ok   ${label}`);
  }
}

// C Major -> C Dm Em F G Am Bdim / I ii iii IV V vi vii°
const cMaj = getDiatonicChords('C', 'Major');
assertEq('C Major names', cMaj.chords.map((c) => c.name),
  ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
assertEq('C Major romans', cMaj.chords.map((c) => c.roman),
  ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
assertEq('C Major parent', cMaj.parentScale, null);

// A Minor -> Am Bdim C Dm Em F G / i ii° III iv v VI VII
const aMin = getDiatonicChords('A', 'Minor');
assertEq('A Minor names', aMin.chords.map((c) => c.name),
  ['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G']);
assertEq('A Minor romans', aMin.chords.map((c) => c.roman),
  ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']);

// A Minor Pentatonic -> falls back to A Minor, parentScale = 'Minor'
const aPent = getDiatonicChords('A', 'Minor Pentatonic');
assertEq('A MinPent names', aPent.chords.map((c) => c.name),
  ['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G']);
assertEq('A MinPent parent', aPent.parentScale, 'Minor');

// A Harmonic Minor -> Am Bdim Caug Dm E F G#dim
const aHm = getDiatonicChords('A', 'Harmonic Minor');
assertEq('A HarmMin names', aHm.chords.map((c) => c.name),
  ['Am', 'Bdim', 'Caug', 'Dm', 'E', 'F', 'G#dim']);

// None -> empty
assertEq('None empty', getDiatonicChords('C', 'None').chords, []);
```

- [ ] **Step 3: Run the verification script**

Run: `cd /home/stoffel/Documents/guitar_assistant && node scale-chords-check.ts`
Expected: all lines start `ok`, exit code 0. If any `FAIL` appears, fix `getDiatonicChords` and re-run.

- [ ] **Step 4: Type-check**

Run: `cd /home/stoffel/Documents/guitar_assistant && npx tsc --noEmit 2>&1 | grep -v "generated/prisma" | grep -iE "musicTheory" || echo "no musicTheory type errors"`
Expected: `no musicTheory type errors`

- [ ] **Step 5: Delete the throwaway script and commit**

```bash
cd /home/stoffel/Documents/guitar_assistant
rm scale-chords-check.ts
git add src/lib/musicTheory.ts
git commit -m "feat(theory): add getDiatonicChords helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `MiniChordDiagram` component

**Files:**
- Create: `src/components/ScaleExplorer/MiniChordDiagram.tsx`

**Interfaces:**
- Consumes: `getVoicingsForChord(root: string, type: string): ChordVoicing[]` and `ChordVoicing` from `src/lib/chordVoicings.ts`; `getNoteName(index: number): string` and `getChordNotes(root: string, chordType: string): string[]` from `src/lib/musicTheory.ts`; `DiatonicChord` from `src/lib/musicTheory.ts`.
- Produces: default export `MiniChordDiagram` with props `{ root: string; quality: DiatonicChord['quality']; chordName: string }`.

- [ ] **Step 1: Create the component**

Create `src/components/ScaleExplorer/MiniChordDiagram.tsx`:

```tsx
import { getNoteName, getChordNotes } from '@/lib/musicTheory';
import type { DiatonicChord } from '@/lib/musicTheory';
import { getVoicingsForChord } from '@/lib/chordVoicings';
import type { ChordVoicing } from '@/lib/chordVoicings';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MiniChordDiagramProps {
  root: string;
  quality: DiatonicChord['quality'];
  chordName: string;
}

// ---------------------------------------------------------------------------
// SVG layout constants (compact, static — mirrors ChordBuilder/ChordDiagram)
// ---------------------------------------------------------------------------

/** Standard tuning open note indices: E=4, A=9, D=2, G=7, B=11, E=4 */
const TUNING_INDICES = [4, 9, 2, 7, 11, 4];

const MARGIN_LEFT = 18;
const MARGIN_TOP = 18;
const STRING_SPACING = 14;
const FRET_SPACING = 18;
const NUM_STRINGS = 6;
const DISPLAY_FRETS = 4;
const WIDTH = MARGIN_LEFT + (NUM_STRINGS - 1) * STRING_SPACING + 18;
const HEIGHT = MARGIN_TOP + DISPLAY_FRETS * FRET_SPACING + 10;
const DOT_RADIUS = 5;

/** Quality names double as chordVoicings/CHORD_FORMULAS type keys. */
function typeForQuality(quality: DiatonicChord['quality']): string {
  return quality; // 'Major' | 'Minor' | 'Diminished' | 'Augmented'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Compact, static SVG chord diagram. Shows the first available voicing for the
 * chord; if none exists, lists the chord's notes as a text fallback.
 */
export default function MiniChordDiagram({ root, quality, chordName }: MiniChordDiagramProps) {
  const type = typeForQuality(quality);
  const voicing: ChordVoicing | undefined = getVoicingsForChord(root, type)[0];

  if (!voicing) {
    const notes = getChordNotes(root, type);
    return (
      <div className="flex items-center justify-center text-center px-2 py-3 rounded bg-amber-950/40 border border-amber-800/30" style={{ width: WIDTH, height: HEIGHT }}>
        <span className="text-[10px] leading-tight text-amber-200/60">
          {notes.length ? notes.join(' · ') : 'no diagram'}
        </span>
      </div>
    );
  }

  const isOpen = voicing.position <= 1;

  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="select-none">
      {/* Nut (open) or position label */}
      {isOpen ? (
        <rect x={MARGIN_LEFT - 1} y={MARGIN_TOP - 3} width={(NUM_STRINGS - 1) * STRING_SPACING + 2} height={3} rx={1} fill="#d4c5a9" />
      ) : (
        <text x={MARGIN_LEFT - 10} y={MARGIN_TOP + FRET_SPACING / 2 + 3} textAnchor="middle" fill="#d4a373" style={{ fontSize: '8px', fontFamily: 'monospace' }}>
          {voicing.position}
        </text>
      )}

      {/* Fret lines */}
      {Array.from({ length: DISPLAY_FRETS + 1 }, (_, i) => (
        <line key={`f${i}`} x1={MARGIN_LEFT} y1={MARGIN_TOP + i * FRET_SPACING} x2={MARGIN_LEFT + (NUM_STRINGS - 1) * STRING_SPACING} y2={MARGIN_TOP + i * FRET_SPACING} stroke="#78716c" strokeWidth={i === 0 && isOpen ? 2 : 1} />
      ))}

      {/* String lines */}
      {Array.from({ length: NUM_STRINGS }, (_, i) => (
        <line key={`s${i}`} x1={MARGIN_LEFT + i * STRING_SPACING} y1={MARGIN_TOP} x2={MARGIN_LEFT + i * STRING_SPACING} y2={MARGIN_TOP + DISPLAY_FRETS * FRET_SPACING} stroke="#a8a29e" strokeWidth={1} />
      ))}

      {/* X / O indicators */}
      {voicing.frets.map((fret, s) => {
        const x = MARGIN_LEFT + s * STRING_SPACING;
        const y = MARGIN_TOP - 7;
        if (fret === null) {
          return <text key={`x${s}`} x={x} y={y} textAnchor="middle" fill="#ef4444" style={{ fontSize: '8px', fontWeight: 700 }}>×</text>;
        }
        if (fret === 0) {
          return <circle key={`o${s}`} cx={x} cy={y - 2} r={2.5} fill="none" stroke="#a8a29e" strokeWidth={1} />;
        }
        return null;
      })}

      {/* Barre */}
      {voicing.barreInfo && (() => {
        const b = voicing.barreInfo;
        const fretOffset = b.fret - (voicing.position > 0 ? voicing.position : 0);
        const y = MARGIN_TOP + (fretOffset - 0.5) * FRET_SPACING;
        const x1 = MARGIN_LEFT + b.fromString * STRING_SPACING;
        const x2 = MARGIN_LEFT + b.toString * STRING_SPACING;
        return <rect x={x1 - 3} y={y - 3} width={x2 - x1 + 6} height={6} rx={3} fill="#44403c" stroke="#78716c" strokeWidth={0.75} />;
      })()}

      {/* Fretted dots */}
      {voicing.frets.map((fret, s) => {
        if (fret === null || fret === 0) return null;
        const displayFret = fret - (voicing.position > 0 ? voicing.position : 0) + (voicing.position > 0 ? 1 : 0);
        const x = MARGIN_LEFT + s * STRING_SPACING;
        const y = MARGIN_TOP + (displayFret - 0.5) * FRET_SPACING;
        const noteName = getNoteName(TUNING_INDICES[s] + fret);
        const isRoot = noteName === root;
        return (
          <circle key={`d${s}`} cx={x} cy={y} r={DOT_RADIUS} fill={isRoot ? '#d97706' : '#0891b2'} stroke={isRoot ? '#b45309' : '#0e7490'} strokeWidth={1} />
        );
      })}

      {/* screen-reader label */}
      <title>{chordName}</title>
    </svg>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd /home/stoffel/Documents/guitar_assistant && npx tsc --noEmit 2>&1 | grep -v "generated/prisma" | grep -iE "MiniChordDiagram" || echo "no MiniChordDiagram type errors"`
Expected: `no MiniChordDiagram type errors`

- [ ] **Step 3: Commit**

```bash
cd /home/stoffel/Documents/guitar_assistant
git add src/components/ScaleExplorer/MiniChordDiagram.tsx
git commit -m "feat(fretboard): add MiniChordDiagram component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `ScaleChords` panel + export

**Files:**
- Create: `src/components/ScaleExplorer/ScaleChords.tsx`
- Modify: `src/components/ScaleExplorer/index.ts`

**Interfaces:**
- Consumes: `getDiatonicChords`, `DiatonicChord`, `ScaleType` from `src/lib/musicTheory.ts`; `COMMON_PROGRESSIONS` from `src/lib/keyData.ts`; `MiniChordDiagram` (Task 2).
- Produces: default export `ScaleChords` with props `{ root: string; scaleType: ScaleType }`; re-exported from `ScaleExplorer/index.ts` as `ScaleChords`.

- [ ] **Step 1: Create the panel component**

Create `src/components/ScaleExplorer/ScaleChords.tsx`:

```tsx
import { getDiatonicChords } from '@/lib/musicTheory';
import type { ScaleType } from '@/lib/musicTheory';
import { COMMON_PROGRESSIONS } from '@/lib/keyData';
import MiniChordDiagram from './MiniChordDiagram';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ScaleChordsProps {
  root: string;
  scaleType: ScaleType;
}

/** Human label for the parent scale fallback note. */
const PARENT_LABEL: Record<string, string> = {
  Minor: 'natural minor',
  Major: 'major',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Informational panel: the chords that work well with the selected scale
 * (roman numeral + name + mini fingering diagram) and a list of common
 * progressions resolved to actual chord names. Renders nothing for "None".
 */
export default function ScaleChords({ root, scaleType }: ScaleChordsProps) {
  if (scaleType === 'None') return null;

  const { chords, parentScale } = getDiatonicChords(root, scaleType);
  if (chords.length === 0) return null;

  return (
    <div className="mt-10 w-full max-w-4xl mx-auto text-left">
      <h2 className="text-xl font-bold text-amber-100 mb-1">
        Chords in {root} {scaleType}
      </h2>
      {parentScale && (
        <p className="text-amber-200/50 text-xs mb-4">
          Chords from the parent {root} {PARENT_LABEL[parentScale] ?? parentScale.toLowerCase()} scale.
        </p>
      )}
      {!parentScale && <div className="mb-4" />}

      {/* Chord grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {chords.map((chord) => (
          <div
            key={chord.degreeIndex}
            className="flex flex-col items-center gap-1 p-2 rounded-lg bg-amber-950/30 border border-amber-800/30"
          >
            <span className="text-amber-400 text-xs font-mono">{chord.roman}</span>
            <span className="text-amber-100 text-sm font-semibold">{chord.name}</span>
            <MiniChordDiagram root={chord.root} quality={chord.quality} chordName={chord.name} />
          </div>
        ))}
      </div>

      {/* Common progressions */}
      <h3 className="text-lg font-semibold text-amber-100 mt-8 mb-3">Common progressions</h3>
      <div className="space-y-2">
        {COMMON_PROGRESSIONS.map((prog) => {
          const steps = prog.indices.map((i) => chords[i]).filter(Boolean);
          if (steps.length !== prog.indices.length) return null;
          return (
            <div
              key={prog.name}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-2 rounded bg-amber-950/20 border border-amber-800/20"
            >
              <span className="text-amber-300/70 text-xs w-20 shrink-0">{prog.label}</span>
              <span className="text-amber-100 text-sm font-medium">
                {steps.map((c) => c.name).join('  –  ')}
              </span>
              <span className="text-amber-400/60 text-xs font-mono">
                {steps.map((c) => c.roman).join(' – ')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Export from the ScaleExplorer barrel**

Add to `src/components/ScaleExplorer/index.ts` (after the `FretboardDisplay` export lines):

```ts
export { default as ScaleChords } from './ScaleChords';
```

- [ ] **Step 3: Type-check**

Run: `cd /home/stoffel/Documents/guitar_assistant && npx tsc --noEmit 2>&1 | grep -v "generated/prisma" | grep -iE "ScaleChords" || echo "no ScaleChords type errors"`
Expected: `no ScaleChords type errors`

- [ ] **Step 4: Commit**

```bash
cd /home/stoffel/Documents/guitar_assistant
git add src/components/ScaleExplorer/ScaleChords.tsx src/components/ScaleExplorer/index.ts
git commit -m "feat(fretboard): add ScaleChords panel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Wire panel into the Fretboard page

**Files:**
- Modify: `src/components/Fretboard.tsx`

**Interfaces:**
- Consumes: `ScaleChords` from `@/components/ScaleExplorer` (Task 3). Existing state `selectedScale`, `selectedKey`, and `trainer.isRunning` in `Fretboard.tsx`.

- [ ] **Step 1: Import `ScaleChords`**

In `src/components/Fretboard.tsx`, add `ScaleChords` to the existing named import from `@/components/ScaleExplorer` (the block at lines 10-18):

```tsx
import {
  useFretboardEnhancements,
  FretboardToolbar,
  ScaleFormulaDisplay,
  PentatonicPositionSelector,
  DegreeLegend,
  ScaleComparisonLegend,
  FretboardDisplay,
  ScaleChords,
} from '@/components/ScaleExplorer';
```

- [ ] **Step 2: Render the panel below the legends**

In `src/components/Fretboard.tsx`, locate the closing of the legends block — the `)}` that ends `{!trainer.isRunning && ( ... )}` (around line 222), immediately before the `</div>` that closes `<div className="w-full max-w-7xl">`. Insert the panel right after that legends block:

```tsx
        {/* Chords that work well with the selected scale */}
        {!trainer.isRunning && selectedScale !== 'None' && (
          <ScaleChords root={selectedKey} scaleType={selectedScale} />
        )}
```

The result should read (for orientation):

```tsx
            {/* ...legends block... */}
          </div>
        )}

        {/* Chords that work well with the selected scale */}
        {!trainer.isRunning && selectedScale !== 'None' && (
          <ScaleChords root={selectedKey} scaleType={selectedScale} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `cd /home/stoffel/Documents/guitar_assistant && npx tsc --noEmit 2>&1 | grep -v "generated/prisma" | grep -iE "Fretboard.tsx" || echo "no Fretboard type errors"`
Expected: `no Fretboard type errors`

- [ ] **Step 4: Manual visual verification**

Run: `cd /home/stoffel/Documents/guitar_assistant && npm run dev` (if not already running), open `http://localhost:3000/fretboard`.
Check:
- Select **A Minor** → panel shows "Chords in A Minor", 7 cards (Am, Bdim, C, Dm, Em, F, G) with roman numerals `i ii° III iv v VI VII`, most with diagrams, and a "Common progressions" list resolving to real chord names.
- Select **A Minor Pentatonic** → panel shows the parent-scale note and the same 7 chords.
- Select **C Major** → cards `C Dm Em F G Am Bdim` with `I ii iii IV V vi vii°`.
- Switch to **Note Trainer** → panel disappears.
- Select scale **None** → panel is absent.
- Confirm a chord lacking a voicing (e.g. some `dim`/`aug`) shows its notes as a text fallback rather than a broken diagram.

- [ ] **Step 5: Commit**

```bash
cd /home/stoffel/Documents/guitar_assistant
git add src/components/Fretboard.tsx
git commit -m "feat(fretboard): show scale chords panel in Scale Explorer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** theory helper (Task 1), mini diagrams with notes fallback (Task 2), panel with chord cards + progressions (Task 3), wiring gated on `None`/trainer (Task 4). All spec sections covered.
- **Signature refinement:** the spec described `getDiatonicChords` returning `DiatonicChord[]`; the plan returns `{ chords, parentScale }` so the panel can render the parent-scale note (the spec's testing section already requires the "parent flag"). Consistent across Tasks 1/3.
- **Type consistency:** `DiatonicChord.quality` values (`Major|Minor|Diminished|Augmented`) are reused verbatim as `chordVoicings`/`CHORD_FORMULAS` type keys in Task 2 (`typeForQuality`), and as the `quality` prop passed from Task 3.
- **`COMMON_PROGRESSIONS`** always resolves against a 7-chord array (heptatonic or parent), so all indices (max index 5) are valid; the `steps.length` guard is defensive.
