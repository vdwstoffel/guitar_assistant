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

## Music Theory Library (Feature #13 Phase 1)
- `src/lib/musicTheory.ts` - Shared music theory constants and functions (NOTES, STANDARD_TUNING, SCALE_FORMULAS, CHORD_FORMULAS, INTERVALS, interval/scale/chord calculation functions)
- `src/lib/audioGenerator.ts` - Web Audio API utilities for playing notes/intervals/chords by name (singleton AudioContext pattern, same as clickGenerator.ts)
- **NOTES uses sharps only** (C, C#, D, ..., B). CircleOfFifths.tsx uses flat-based spellings (Gb, Db, Ebm) for music-theory-correct display and keeps its own KEY_DATA.
- `SCALE_FORMULAS` consolidates all scale data from Fretboard.tsx (was called `SCALES` locally)
- `ScaleType` exported as `keyof typeof SCALE_FORMULAS`
- Fretboard.tsx refactored to import from musicTheory.ts; uses thin wrapper functions to bind component state to shared pure functions

## IntervalExplorer (Feature #13 Phase 2)
- **Route**: `/intervals` - accessible via Theory dropdown in TopNav
- **Folder**: `src/components/IntervalExplorer/` - follows modular feature folder pattern
  - `index.ts` - barrel export
  - `IntervalExplorer.tsx` - container component (wires hook to UI)
  - `types.ts` - FretPosition, IntervalInfo types + INTERVAL_REFERENCE constant (13 intervals with abbreviations, qualities, song examples)
  - `hooks/useIntervalExplorer.ts` - all state management and audio playback logic
  - `components/IntervalFretboard.tsx` - clickable fretboard with root/target/occurrence highlighting
  - `components/IntervalDisplay.tsx` - prominent bar showing current interval name, semitones, quality
  - `components/IntervalReferencePanel.tsx` - table of all 13 intervals, clickable to highlight on fretboard
- **Section type**: `'intervals'` added to both TopNav.tsx and page.tsx Section unions
- **Octave calculation**: Uses absolute MIDI-like semitone values (E2=40, A2=45, etc.) for accurate pitch mapping
- **First modular feature folder** in this codebase - can serve as template for future features

## ChordBuilder (Feature #13 Phase 3)
- **Route**: `/chords` - accessible via Theory dropdown in TopNav (after Intervals, before Circle of 5ths)
- **Folder**: `src/components/ChordBuilder/` - follows same modular feature folder pattern as IntervalExplorer
  - `index.ts` - barrel export
  - `ChordBuilder.tsx` - container component (wires hook to 4 sub-components)
  - `types.ts` - ChordTypeGroup, ChordTypeEntry, CHORD_TYPE_GROUPS, INTERVAL_ABBREVIATIONS, getChordSymbol()
  - `hooks/useChordBuilder.ts` - state management: root/type selection, voicing navigation, chord theory derivations, audio playback
  - `components/ChordSelector.tsx` - root note + chord quality picker with formula display
  - `components/ChordDiagram.tsx` - SVG vertical chord diagram (nut, frets, dots, barre, finger numbers)
  - `components/ChordFretboard.tsx` - full 15-fret neck showing all chord tone positions (voiced vs dimmed)
  - `components/ChordInfoPanel.tsx` - theory info: chord tones, key appearances, related chords
- **Data file**: `src/lib/chordVoicings.ts` - ChordVoicing interface + ~50 voicing definitions (CAGED, barre, power, 7th, sus, etc.)
  - `getVoicingsForChord(root, type)` and `getAvailableTypesForRoot(root)` lookup helpers
- **Section type**: `'chords'` added to both TopNav.tsx and page.tsx Section unions
- **Key architecture decisions**:
  - Voicing data separated into `src/lib/` (reusable data) vs component types in feature folder
  - Hook derives key appearances by iterating all 12 major/minor keys and matching scale degree quality
  - Related chords computed by finding chords sharing 2+ notes (limited to 12 for display)
  - playChord uses voicing-specific notes when available (actual fretted notes) for accurate sound

## ScaleExplorer / Fretboard Enhancements (Feature #13 Phase 4)
- **Folder**: `src/components/ScaleExplorer/` - modular feature folder enhancing Fretboard.tsx
  - `index.ts` - barrel export
  - `types.ts` - LabelMode, FretboardEnhancementsState, ComparisonClass, NoteDisplayInfo types
  - `hooks/useFretboardEnhancements.ts` - all enhancement state + getNoteDisplayInfo() factory
  - `components/FretboardToolbar.tsx` - degree colors toggle, label mode selector, compare dropdown
  - `components/ScaleFormulaDisplay.tsx` - interval formula badges (R - m3 - P4 - P5 - m7)
  - `components/PentatonicPositionSelector.tsx` - position 1-5 + All buttons for pentatonic box patterns
  - `components/DegreeLegend.tsx` - color legend for root/3rd/5th/7th/other
  - `components/ScaleComparisonLegend.tsx` - both/primary-only/compare-only legend
- **Data added to musicTheory.ts**: INTERVAL_ABBREVIATIONS, DEGREE_LABELS, MINOR_PENTATONIC_POSITIONS, MAJOR_PENTATONIC_POSITIONS, PentatonicBoxPosition interface, getDegreeColorClass(), getScaleIntervalFormula(), isInPentatonicBox(), getRootFretOn6thString()
- **Fretboard.tsx** now imports from ScaleExplorer barrel; uses useFretboardEnhancements hook; NoteDot sub-component handles degree/comparison/label rendering
- **5 features**: Scale Degree Coloring, Interval/Degree Label Modes, Scale Formula Display, Pentatonic Box Positions (5 CAGED shapes), Scale Comparison Mode

## CircleEnhancements (Feature #13 Phase 5)
- **Route**: `/circle` - accessible via Theory dropdown in TopNav
- **Folder**: `src/components/CircleEnhancements/` - modular feature folder enhancing CircleOfFifths.tsx
  - `index.ts` - barrel export
  - `types.ts` - NotationMode, ProgressionChord, FLAT_TO_SHARP, ROMAN_TO_NASHVILLE maps, chordRootToSharp(), getSharpRoot(), getChordQuality()
  - `hooks/useProgressionPlayer.ts` - playback state (isPlaying, bpm, activeChordIndex), setTimeout-based scheduler with named function self-reference pattern
  - `hooks/useCustomProgression.ts` - custom progression builder state (add/remove/clear chords with unique IDs)
  - `components/ProgressionPlayback.tsx` - displays a progression with play/stop, active chord highlighting, notation mode
  - `components/CustomProgressionBuilder.tsx` - diatonic chord buttons + sequence bar with remove/play/clear
  - `components/NashvilleToggle.tsx` - Roman/Nashville notation toggle
- **CircleOfFifths.tsx** now imports from CircleEnhancements barrel; replaces old static progression card with enhanced version
- **3 features**: Progression Playback (hear chords via audioGenerator), Custom Progression Builder, Nashville Number toggle
- **Key architecture decisions**:
  - Flat-to-sharp conversion in types.ts bridges KEY_DATA (flat spellings) to CHORD_FORMULAS (sharps only)
  - Named function expression pattern (`function tickFn()` inside useCallback) for self-referencing setTimeout scheduling
  - React 19 lint: avoid ref writes during render; use useEffect for ref sync
  - `playChordByName` extracted as a module-level pure function (not a hook) since it needs no React state

## NoteTrainer (Feature #13 Phase 6)
- **Route**: `/trainer` - accessible via Theory dropdown in TopNav (last entry, after Circle of 5ths)
- **Folder**: `src/components/NoteTrainer/` - follows same modular feature folder pattern
  - `index.ts` - barrel export
  - `NoteTrainer.tsx` - container component (wires useNoteTrainer hook to 7 sub-components)
  - `types.ts` - TrainingMode, Difficulty, QuizQuestion union (4 question types), FretPosition, ScoreState, FeedbackState, constants (FRET_RANGES, INTERVAL_OPTIONS, TRAINING_MODES)
  - `hooks/useQuizQuestion.ts` - question generation per mode with no-repeat logic
  - `hooks/useNoteTrainer.ts` - core quiz orchestration: mode/difficulty, answer checking, scoring, feedback timing, auto-advance
  - `components/TrainerFretboard.tsx` - fretboard with highlighted/secondary/revealed positions and optional click handling
  - `components/AnswerButtons.tsx` - union props pattern for note (12 chromatic) or interval (variable) answer grids with feedback coloring
  - `components/ScoreDisplay.tsx` - streak (fire icon), accuracy percentage, reset button
  - `components/ModeSelector.tsx` - horizontal tab buttons for 4 training modes
  - `components/DifficultySelector.tsx` - Easy/Medium/Hard toggle with context-aware descriptions
  - `components/EarTrainingPanel.tsx` - large play/replay button for ear training mode
  - `components/QuestionPrompt.tsx` - mode-aware question text with correct/wrong feedback
- **Section type**: `'trainer'` added to both TopNav.tsx and page.tsx Section unions
- **4 training modes**: Note Quiz (identify highlighted note), Find Note (click correct fret), Intervals Visual (identify interval on fretboard), Ear Training (identify audible interval)
- **3 difficulty levels**: Easy (frets 0-5 / 4 intervals), Medium (frets 0-9 / 7 intervals), Hard (frets 0-15 / all 13 intervals)
- **Key architecture decisions**:
  - Question types are a discriminated union on `mode` field for type-safe pattern matching
  - AnswerButtons uses union props pattern (`type: 'notes' | 'intervals'`) to render different button grids
  - useQuizQuestion tracks previous question via ref to avoid immediate repeats
  - Feedback timing: 1.2s delay before auto-advancing to next question (NEXT_QUESTION_DELAY_MS)
  - Mode/difficulty changes reset score and generate fresh question immediately
  - TrainerFretboard reuses IntervalFretboard's visual style but adds feedback coloring + clickable mode

## Feature #13 Phase 7 - Polish & Verification
- **All routing verified**: Section type in both TopNav.tsx and page.tsx includes all 8 sections (library, videos, fretboard, intervals, chords, tools, circle, trainer)
- **getSectionFromPath** handles all new routes correctly
- **Theory dropdown order**: Fretboard -> Intervals -> Chords -> Circle of 5ths -> Trainer (correct)
- **TypeScript**: `npx tsc --noEmit` passes with zero errors (excluding expected Prisma-generated errors)
- **ESLint**: All new files pass with zero errors
- **'use client' pattern**: Container components (IntervalExplorer.tsx, ChordBuilder.tsx, NoteTrainer.tsx, Fretboard.tsx, CircleOfFifths.tsx) and ScaleExplorer sub-components all have the directive. Sub-components in IntervalExplorer, ChordBuilder, NoteTrainer folders are purely presentational (no hooks) and inherit the client boundary from their parent.
- **Fixed**: Moved `'use client'` in NoteTrainer.tsx from line 15 (after JSDoc) to line 1 for consistency
- **Metronome**: Not a routed section; lives as an inline toggle panel within TopNav.tsx

## File Organization Notes
- `src/types/index.ts` - TypeScript interfaces (Author, Book, Track, Marker, JamTrack, etc.)
- `src/lib/prisma.ts` - Prisma client singleton
- `src/lib/clickGenerator.ts` - Audio click generation for count-in
- `src/lib/musicTheory.ts` - Shared music theory data and pure functions
- `src/lib/audioGenerator.ts` - Web Audio API note/chord playback utilities
- `src/lib/chordVoicings.ts` - Guitar chord voicing definitions (ChordVoicing interface + data)
- `src/lib/tapTempo.ts` - Tap tempo utility
