'use client';

import React from 'react';
import { STANDARD_TUNING } from '@/lib/musicTheory';
import type { NoteDisplayInfo } from './types';

const DEFAULT_NUM_FRETS = 15;
const INLAY_POSITIONS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
const DOUBLE_INLAY_FRETS = [12, 24];

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
// NoteDot sub-component
// ---------------------------------------------------------------------------

interface NoteDotProps {
  info: NoteDisplayInfo;
  showDegreeColors: boolean;
  isComparing: boolean;
  opacity?: number;
}

function NoteDot({ info, showDegreeColors, isComparing, opacity }: NoteDotProps) {
  const style = getNoteStyle(info, showDegreeColors, isComparing);
  const textColorClass = isComparing ? getComparisonTextColor(info) : 'text-white';

  return (
    <div
      className="absolute z-10 rounded-full flex items-center justify-center transition-all cursor-default hover:scale-110"
      style={{
        width: '32px',
        height: '32px',
        opacity: opacity ?? 1,
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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FretboardDisplayProps {
  /** Function returning per-position display info; identity of the fn should be stable per render. */
  getNoteDisplayInfo: (stringIndex: number, fret: number) => NoteDisplayInfo;
  showDegreeColors: boolean;
  isComparing: boolean;
  showNoteNames: boolean;
  /** Optional per-fret override (used by the note trainer to spotlight one note). Returns node or null. */
  renderOverride?: (stringIndex: number, fret: number) => React.ReactNode | null;
  numFrets?: number; // default 15
  /** Optional fret window to outline across all 6 strings. */
  boxOutline?: { lowFret: number; highFret: number } | null;
  /** How to treat notes outside `boxOutline`. Defaults to 'hide' for backwards compat with ScaleExplorer. */
  outsideBoxBehavior?: 'hide' | 'dim';
}

export default function FretboardDisplay({
  getNoteDisplayInfo,
  showDegreeColors,
  isComparing,
  showNoteNames,
  renderOverride,
  numFrets = DEFAULT_NUM_FRETS,
  boxOutline = null,
  outsideBoxBehavior = 'hide',
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
              style={{
                color: fret === 12 || fret === 24 ? '#fbbf24' : '#d4af7a',
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
                  {Array.from({ length: numFrets }, (_, fret) => fret + 1).map((fret) => {
                    const info = getNoteDisplayInfo(stringIndex, fret);
                    const override = renderOverride?.(stringIndex, fret) ?? null;

                    const isOutsideBox =
                      !!boxOutline && (fret < boxOutline.lowFret || fret > boxOutline.highFret);

                    // 'hide' mode: preserve legacy behavior — gate on info.inSelectedBox.
                    // 'dim' mode: always render the dot when it's in-scale, but dim it if outside the outline.
                    const shouldShowNormal =
                      showNoteNames && info.inScale && (
                        outsideBoxBehavior === 'dim'
                          ? true
                          : info.inSelectedBox
                      );

                    const noteOpacity =
                      outsideBoxBehavior === 'dim' && isOutsideBox ? 0.3 : 1;

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
                          <NoteDot
                            info={info}
                            showDegreeColors={showDegreeColors}
                            isComparing={isComparing}
                            opacity={noteOpacity}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Inlay Markers */}
          <div className="flex absolute bottom-1 left-12 right-0">
            {Array.from({ length: numFrets }, (_, i) => i + 1).map((fret) => (
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

          {/* Shape box outline overlay */}
          {boxOutline && (
            <div
              className="absolute pointer-events-none rounded"
              style={{
                // The strings-container starts at left:48px (w-12 nut).
                // Each fret column has flex-1 width; compute % of the full string row.
                left: `calc(48px + ((${boxOutline.lowFret} - 1) / ${numFrets}) * (100% - 48px))`,
                width: `calc(((${boxOutline.highFret} - ${boxOutline.lowFret} + 1) / ${numFrets}) * (100% - 48px))`,
                top: '8px',    // matches py-4 padding on strings container (16px top - 8px inset)
                bottom: '8px',
                border: '2px solid rgba(251, 191, 36, 0.7)',
                backgroundColor: 'rgba(251, 191, 36, 0.08)',
                boxShadow: '0 0 12px rgba(251, 191, 36, 0.25)',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
