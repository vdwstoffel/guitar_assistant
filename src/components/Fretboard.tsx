'use client';

import { useState } from 'react';
import {
  NOTES,
  STANDARD_TUNING,
  SCALE_FORMULAS,
} from '@/lib/musicTheory';
import type { ScaleType } from '@/lib/musicTheory';
import {
  useFretboardEnhancements,
  FretboardToolbar,
  ScaleFormulaDisplay,
  PentatonicPositionSelector,
  DegreeLegend,
  ScaleComparisonLegend,
} from '@/components/ScaleExplorer';
import type { NoteDisplayInfo } from '@/components/ScaleExplorer';

// Fretboard-specific display constants
const NUM_FRETS = 15;
const INLAY_POSITIONS = [3, 5, 7, 9, 12, 15];
const DOUBLE_INLAY_FRETS = [12];

// ---------------------------------------------------------------------------
// Note dot styling helpers (pure functions, no React state)
// ---------------------------------------------------------------------------

/** Return inline styles for a note dot based on its display classification. */
function getNoteStyle(
  info: NoteDisplayInfo,
  showDegreeColors: boolean,
  isComparing: boolean,
): React.CSSProperties {
  // Comparison mode: distinct styles per comparison class
  if (isComparing) {
    return getComparisonStyle(info);
  }

  // Degree coloring mode
  if (showDegreeColors && !info.isRoot) {
    return getDegreeStyle(info);
  }

  // Default: root = red, others = dark gray
  if (info.isRoot) {
    return {
      background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
      border: '2px solid #b91c1c',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.1)',
    };
  }

  return {
    background: 'linear-gradient(135deg, #4a5568 0%, #2d3748 100%)',
    border: '2px solid #1a202c',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.1)',
  };
}

function getDegreeStyle(info: NoteDisplayInfo): React.CSSProperties {
  const base = '0 2px 8px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.1)';
  switch (info.degreeColorClass) {
    case 'root':
      return { background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)', border: '2px solid #b91c1c', boxShadow: base };
    case 'third':
      return { background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', border: '2px solid #1e40af', boxShadow: base };
    case 'fifth':
      return { background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', border: '2px solid #166534', boxShadow: base };
    case 'seventh':
      return { background: 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)', border: '2px solid #6b21a8', boxShadow: base };
    default:
      return { background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)', border: '2px solid #374151', boxShadow: base };
  }
}

function getComparisonStyle(info: NoteDisplayInfo): React.CSSProperties {
  const base = '0 2px 8px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.1)';
  switch (info.comparisonClass) {
    case 'both':
      return { background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', border: '2px solid #b45309', boxShadow: base };
    case 'primary-only':
      return { background: 'transparent', border: '2px solid #22d3ee', boxShadow: base };
    case 'compare-only':
      return { background: 'transparent', border: '2px solid #fb7185', boxShadow: base };
    default:
      return { background: 'linear-gradient(135deg, #4a5568 0%, #2d3748 100%)', border: '2px solid #1a202c', boxShadow: base };
  }
}

/** Determine the text color for a note label in comparison mode. */
function getComparisonTextColor(info: NoteDisplayInfo): string {
  switch (info.comparisonClass) {
    case 'both': return 'text-white';
    case 'primary-only': return 'text-cyan-300';
    case 'compare-only': return 'text-rose-300';
    default: return 'text-white';
  }
}

// ---------------------------------------------------------------------------
// String visual style (pure function)
// ---------------------------------------------------------------------------

function getStringStyle(stringIndex: number) {
  const heights = [8, 6, 5, 4, 3, 2]; // 6th to 1st string in pixels
  const height = heights[stringIndex];
  return {
    height: `${height}px`,
    background: 'linear-gradient(to bottom, #bfbcc2, #e7e4eb, #bfbcc2)',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
  };
}

function isInlayPosition(fret: number): boolean {
  return INLAY_POSITIONS.includes(fret);
}

function isDoubleInlay(fret: number): boolean {
  return DOUBLE_INLAY_FRETS.includes(fret);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Fretboard() {
  const [showNoteNames, setShowNoteNames] = useState(true);
  const [selectedScale, setSelectedScale] = useState<ScaleType>('None');
  const [selectedKey, setSelectedKey] = useState('C');

  const enhancements = useFretboardEnhancements({
    selectedKey,
    selectedScale,
  });

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center p-6 overflow-auto"
      style={{
        background: 'linear-gradient(to bottom, hsl(23, 64%, 5%), hsl(23, 64%, 18%))',
      }}
    >
      <div className="w-full max-w-7xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-amber-100 mb-4">Guitar Fretboard</h1>
          <p className="text-amber-200/70 mb-6">Standard Tuning (E A D G B E)</p>

          {/* Controls */}
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => setShowNoteNames(!showNoteNames)}
              className={`px-4 py-2 rounded transition-colors ${
                showNoteNames
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-amber-900/50 hover:bg-amber-800/50 text-amber-200'
              }`}
            >
              {showNoteNames ? 'Hide Note Names' : 'Show Note Names'}
            </button>

            {/* Scale Selection */}
            <div className="flex gap-4 items-center">
              <div className="flex flex-col gap-2">
                <label className="text-amber-200/70 text-sm font-medium">Scale</label>
                <select
                  value={selectedScale}
                  onChange={(e) => setSelectedScale(e.target.value as ScaleType)}
                  className="px-3 py-2 rounded bg-amber-900/50 text-amber-100 border border-amber-700/50 focus:outline-none focus:border-amber-500"
                >
                  {Object.keys(SCALE_FORMULAS).map((scale) => (
                    <option key={scale} value={scale}>
                      {scale}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-amber-200/70 text-sm font-medium">Key</label>
                <select
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                  disabled={selectedScale === 'None'}
                  className="px-3 py-2 rounded bg-amber-900/50 text-amber-100 border border-amber-700/50 focus:outline-none focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {NOTES.map((note) => (
                    <option key={note} value={note}>
                      {note}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Scale info, formula, and enhancement controls */}
            {selectedScale !== 'None' && (
              <div className="max-w-lg text-center space-y-2">
                <p className="text-amber-300 text-sm font-medium">
                  {selectedKey} {selectedScale}
                </p>
                <p className="text-amber-200/60 text-sm leading-relaxed">
                  {SCALE_FORMULAS[selectedScale].description}
                </p>

                {/* Scale Formula Display */}
                <ScaleFormulaDisplay formula={enhancements.scaleFormula} />

                <div className="flex flex-wrap justify-center gap-2">
                  {SCALE_FORMULAS[selectedScale].genres.map((genre) => (
                    <span
                      key={genre}
                      className="px-2 py-0.5 rounded-full text-xs bg-amber-800/40 text-amber-300/80 border border-amber-700/30"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Enhancement Toolbar */}
            <FretboardToolbar
              selectedScale={selectedScale}
              showDegreeColors={enhancements.showDegreeColors}
              labelMode={enhancements.labelMode}
              compareScale={enhancements.compareScale}
              onToggleDegreeColors={enhancements.toggleDegreeColors}
              onSetLabelMode={enhancements.setLabelMode}
              onSetCompareScale={enhancements.setCompareScale}
            />

            {/* Pentatonic Position Selector */}
            {enhancements.hasPentatonicPositions && (
              <PentatonicPositionSelector
                positions={enhancements.pentatonicPositions}
                selectedPosition={enhancements.selectedPosition}
                onSelectPosition={enhancements.setSelectedPosition}
              />
            )}
          </div>
        </div>

        {/* Fretboard Container */}
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
              {Array.from({ length: NUM_FRETS }, (_, i) => i + 1).map((fret) => (
                <div
                  key={fret}
                  className="flex-1 text-center text-xs font-mono"
                  style={{
                    color: fret === 12 ? '#fbbf24' : '#d4af7a',
                  }}
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
              {/* Strings Container */}
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

                    {/* String line spanning all frets */}
                    <div className="absolute left-12 right-0 flex items-center">
                      <div
                        className="w-full"
                        style={getStringStyle(stringIndex)}
                      />
                    </div>

                    {/* Frets with note positions */}
                    {Array.from({ length: NUM_FRETS }, (_, fret) => fret + 1).map((fret) => {
                      const info = enhancements.getNoteDisplayInfo(stringIndex, fret);
                      const shouldShow = info.inScale && info.inSelectedBox;

                      return (
                      <div
                        key={fret}
                        className="relative flex-1 flex items-center justify-center"
                        style={{
                          height: '40px',
                          borderRight: fret === NUM_FRETS ? 'none' : '2px solid hsl(30, 30%, 35%)',
                        }}
                      >
                        {/* Note overlay - only show if in scale (and in selected box if applicable) */}
                        {showNoteNames && shouldShow && (
                          <NoteDot
                            info={info}
                            showDegreeColors={enhancements.showDegreeColors}
                            isComparing={enhancements.isComparing}
                          />
                        )}
                      </div>
                      );
                    })}
                  </div>
                );
                })}
              </div>

              {/* Inlay Markers */}
              <div className="flex absolute bottom-1 left-12 right-0">
                {Array.from({ length: NUM_FRETS }, (_, i) => i + 1).map((fret) => (
                  <div
                    key={fret}
                    className="flex-1 h-8 flex items-center justify-center gap-2"
                  >
                    {isInlayPosition(fret) && (
                      <>
                        <div
                          className="rounded-full"
                          style={{
                            width: '10px',
                            height: '10px',
                            background: 'radial-gradient(circle, #f5f5dc 0%, #d4c5a9 100%)',
                            boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.5), 0 1px 3px rgba(0, 0, 0, 0.4)',
                          }}
                        />
                        {isDoubleInlay(fret) && (
                          <div
                            className="rounded-full"
                            style={{
                              width: '10px',
                              height: '10px',
                              background: 'radial-gradient(circle, #f5f5dc 0%, #d4c5a9 100%)',
                              boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.5), 0 1px 3px rgba(0, 0, 0, 0.4)',
                            }}
                          />
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Legends */}
        <div className="mt-6 text-center text-sm text-amber-200/70 space-y-2">
          <p>Hover over notes to highlight them</p>

          {/* Degree color legend */}
          <DegreeLegend visible={enhancements.showDegreeColors && selectedScale !== 'None'} />

          {/* Comparison legend */}
          <ScaleComparisonLegend
            primaryScale={selectedScale}
            compareScale={enhancements.compareScale}
            selectedKey={selectedKey}
          />

          {/* Default root note hint (only when no special modes are active) */}
          {selectedScale !== 'None' && !enhancements.showDegreeColors && !enhancements.isComparing && (
            <p className="text-red-400">Red notes indicate the root note of the scale</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NoteDot sub-component (kept in same file for co-location with rendering logic)
// ---------------------------------------------------------------------------

interface NoteDotProps {
  info: NoteDisplayInfo;
  showDegreeColors: boolean;
  isComparing: boolean;
}

function NoteDot({ info, showDegreeColors, isComparing }: NoteDotProps) {
  const style = getNoteStyle(info, showDegreeColors, isComparing);
  const textColorClass = isComparing ? getComparisonTextColor(info) : 'text-white';

  return (
    <div
      className="absolute z-10 rounded-full flex items-center justify-center transition-all cursor-default hover:scale-110"
      style={{
        width: '32px',
        height: '32px',
        ...style,
      }}
      onMouseEnter={(e) => {
        // Only apply hover highlight in default mode (no degree colors, no comparison)
        if (!info.isRoot && !showDegreeColors && !isComparing) {
          e.currentTarget.style.background = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
          e.currentTarget.style.borderColor = '#d97706';
        }
      }}
      onMouseLeave={(e) => {
        if (!info.isRoot && !showDegreeColors && !isComparing) {
          e.currentTarget.style.background = 'linear-gradient(135deg, #4a5568 0%, #2d3748 100%)';
          e.currentTarget.style.borderColor = '#1a202c';
        }
      }}
    >
      <span className={`${textColorClass} text-xs font-mono font-bold`}>
        {info.label}
      </span>
    </div>
  );
}
