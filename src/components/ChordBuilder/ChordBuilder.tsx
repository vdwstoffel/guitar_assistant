'use client';

import { useChordBuilder } from './hooks/useChordBuilder';
import ChordSelector from './components/ChordSelector';
import ChordDiagram from './components/ChordDiagram';
import ChordFretboard from './components/ChordFretboard';
import ChordInfoPanel from './components/ChordInfoPanel';

/**
 * ChordBuilder - Interactive chord explorer and library page.
 *
 * Container component that wires the useChordBuilder hook (all state + logic)
 * to four presentational sub-components:
 *   - ChordSelector   (root + quality pickers, formula display)
 *   - ChordDiagram    (SVG chord diagram with voicing navigation)
 *   - ChordFretboard  (full neck showing all chord tone positions)
 *   - ChordInfoPanel  (theory info: tones, keys, related chords)
 *
 * Layout:
 *   - Large screens: 3-column (selector | diagram | info) with fretboard below
 *   - Small screens: stacked vertically
 */
export default function ChordBuilder() {
  const {
    selectedRoot,
    selectedType,
    chordSymbol,
    chordNotes,
    chordTones,
    voicings,
    currentVoicingIndex,
    currentVoicing,
    keyAppearances,
    relatedChords,
    selectRoot,
    selectType,
    nextVoicing,
    prevVoicing,
    playCurrentChord,
  } = useChordBuilder();

  return (
    <div
      className="flex-1 flex flex-col overflow-auto"
      style={{
        background:
          'linear-gradient(to bottom, hsl(23, 64%, 5%), hsl(23, 64%, 18%))',
      }}
    >
      <div className="w-full max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-amber-100 mb-2">
            Chord Builder
          </h1>
          <p className="text-amber-200/60 text-sm max-w-2xl mx-auto">
            A chord is a group of notes played together. Select a root note and
            a chord quality to see its voicing on the guitar, hear how it sounds,
            and learn which keys it belongs to.
          </p>
        </div>

        {/* 3-column layout: Selector | Diagram | Info */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-6">
          {/* Left: selector */}
          <ChordSelector
            selectedRoot={selectedRoot}
            selectedType={selectedType}
            chordSymbol={chordSymbol}
            chordTones={chordTones}
            onSelectRoot={selectRoot}
            onSelectType={selectType}
          />

          {/* Center: chord diagram */}
          <div className="flex items-start justify-center">
            <ChordDiagram
              voicing={currentVoicing}
              chordSymbol={chordSymbol}
              chordNotes={chordNotes}
              voicingCount={voicings.length}
              currentIndex={currentVoicingIndex}
              onPrev={prevVoicing}
              onNext={nextVoicing}
              onPlay={playCurrentChord}
            />
          </div>

          {/* Right: info panel */}
          <ChordInfoPanel
            chordSymbol={chordSymbol}
            chordTones={chordTones}
            keyAppearances={keyAppearances}
            relatedChords={relatedChords}
          />
        </div>

        {/* Fretboard visualization (full width) */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            All {chordSymbol} positions on the fretboard
          </h2>
          <ChordFretboard
            chordNotes={chordNotes}
            currentVoicing={currentVoicing}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 text-xs text-amber-200/50">
          <LegendItem color="#f59e0b" label="Root note" />
          <LegendItem color="#06b6d4" label="Chord tone (voiced)" />
          <LegendItem color="#155e75" label="Chord tone (other positions)" opacity={0.5} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helper sub-component for the legend
// ---------------------------------------------------------------------------

interface LegendItemProps {
  color: string;
  label: string;
  opacity?: number;
}

function LegendItem({ color, label, opacity = 1 }: LegendItemProps) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-3 h-3 rounded-full"
        style={{ background: color, opacity }}
      />
      <span>{label}</span>
    </div>
  );
}
