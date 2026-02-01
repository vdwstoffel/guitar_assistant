'use client';

import { useState } from 'react';

// Constants
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const STANDARD_TUNING = ['E', 'A', 'D', 'G', 'B', 'E']; // 6th to 1st string
const NUM_FRETS = 15;
const INLAY_POSITIONS = [3, 5, 7, 9, 12, 15];
const DOUBLE_INLAY_FRETS = [12];

// Scale patterns (intervals from root in semitones)
const SCALES = {
  'None': [],
  'Major': [0, 2, 4, 5, 7, 9, 11],
  'Minor': [0, 2, 3, 5, 7, 8, 10],
  'Minor Pentatonic': [0, 3, 5, 7, 10],
  'Major Pentatonic': [0, 2, 4, 7, 9],
  'Blues': [0, 3, 5, 6, 7, 10],
  'Dorian': [0, 2, 3, 5, 7, 9, 10],
  'Phrygian': [0, 1, 3, 5, 7, 8, 10],
  'Lydian': [0, 2, 4, 6, 7, 9, 11],
  'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
};

type ScaleType = keyof typeof SCALES;

export default function Fretboard() {
  const [showNoteNames, setShowNoteNames] = useState(true);
  const [selectedScale, setSelectedScale] = useState<ScaleType>('None');
  const [selectedKey, setSelectedKey] = useState('C');

  // Get the chromatic index for a note name
  function getNoteIndex(noteName: string): number {
    return NOTES.indexOf(noteName);
  }

  // Calculate note name for a given string and fret
  function getNoteFromString(stringIndex: number, fret: number): string {
    const openStringNote = STANDARD_TUNING[stringIndex];
    const openNoteIndex = getNoteIndex(openStringNote);
    const noteIndex = (openNoteIndex + fret) % 12;
    return NOTES[noteIndex];
  }

  // Check if a note is in the selected scale
  function isNoteInScale(noteName: string): boolean {
    if (selectedScale === 'None') return true;

    const rootIndex = getNoteIndex(selectedKey);
    const noteIndex = getNoteIndex(noteName);
    const intervalFromRoot = (noteIndex - rootIndex + 12) % 12;

    return SCALES[selectedScale].includes(intervalFromRoot);
  }

  // Check if a note is the root note of the scale
  function isRootNote(noteName: string): boolean {
    return selectedScale !== 'None' && noteName === selectedKey;
  }

  // Check if a fret position should have an inlay marker
  function isInlayPosition(fret: number): boolean {
    return INLAY_POSITIONS.includes(fret);
  }

  // Check if a fret position should have double inlay markers
  function isDoubleInlay(fret: number): boolean {
    return DOUBLE_INLAY_FRETS.includes(fret);
  }

  // Get string height and style based on string index
  function getStringStyle(stringIndex: number) {
    const heights = [8, 6, 5, 4, 3, 2]; // 6th to 1st string in pixels
    const height = heights[stringIndex];
    return {
      height: `${height}px`,
      background: 'linear-gradient(to bottom, #bfbcc2, #e7e4eb, #bfbcc2)',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
    };
  }

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
                  {Object.keys(SCALES).map((scale) => (
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

            {selectedScale !== 'None' && (
              <p className="text-amber-300 text-sm">
                Showing: {selectedKey} {selectedScale}
              </p>
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
                      const noteName = getNoteFromString(stringIndex, fret);
                      const inScale = isNoteInScale(noteName);
                      const isRoot = isRootNote(noteName);

                      return (
                      <div
                        key={fret}
                        className="relative flex-1 flex items-center justify-center"
                        style={{
                          height: '40px',
                          borderRight: fret === NUM_FRETS ? 'none' : '2px solid hsl(30, 30%, 35%)',
                        }}
                      >
                        {/* Note overlay - only show if in scale */}
                        {showNoteNames && inScale && (
                          <div
                            className="absolute z-10 rounded-full flex items-center justify-center transition-all cursor-default hover:scale-110"
                            style={{
                              width: '32px',
                              height: '32px',
                              background: isRoot
                                ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
                                : 'linear-gradient(135deg, #4a5568 0%, #2d3748 100%)',
                              border: isRoot ? '2px solid #b91c1c' : '2px solid #1a202c',
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.1)',
                            }}
                            onMouseEnter={(e) => {
                              if (!isRoot) {
                                e.currentTarget.style.background = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
                                e.currentTarget.style.borderColor = '#d97706';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isRoot) {
                                e.currentTarget.style.background = 'linear-gradient(135deg, #4a5568 0%, #2d3748 100%)';
                                e.currentTarget.style.borderColor = '#1a202c';
                              }
                            }}
                          >
                            <span className="text-white text-xs font-mono font-bold">
                              {noteName}
                            </span>
                          </div>
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

        {/* Legend */}
        <div className="mt-6 text-center text-sm text-amber-200/70 space-y-1">
          <p>Hover over notes to highlight them</p>
          {selectedScale !== 'None' && (
            <p className="text-red-400">Red notes indicate the root note of the scale</p>
          )}
        </div>
      </div>
    </div>
  );
}
