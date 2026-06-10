'use client';

import { useMemo } from 'react';
import { getNoteAtFret, getDegreeLabel } from '@/lib/musicTheory';

interface Props {
  root: string;
  scaleType: string;
  /** Highlight range [low, high] inclusive. Notes outside fade out. null = full neck. */
  highlightRange: [number, number] | null;
  scaleNotes: Set<string>;
}

const NUM_FRETS = 15;
const STRING_LABELS = ['E', 'B', 'G', 'D', 'A', 'E']; // 1st→6th, top-down
const INLAY_FRETS = [3, 5, 7, 9, 12, 15];

/** Compact read-only fretboard that highlights scale notes for the chosen key. */
export default function ScalePracticeFretboard({
  root,
  scaleType,
  highlightRange,
  scaleNotes,
}: Props) {
  const grid = useMemo(() => {
    // Row 0 = high E (string index 5 internally), Row 5 = low E (string index 0).
    const rows: { stringIndex: number; cells: { fret: number; note: string }[] }[] = [];
    for (let row = 0; row < 6; row++) {
      const stringIndex = 5 - row;
      const cells: { fret: number; note: string }[] = [];
      for (let f = 0; f <= NUM_FRETS; f++) {
        cells.push({ fret: f, note: getNoteAtFret(stringIndex, f) });
      }
      rows.push({ stringIndex, cells });
    }
    return rows;
  }, []);

  const isInRange = (fret: number): boolean => {
    if (!highlightRange) return true;
    return fret >= highlightRange[0] && fret <= highlightRange[1];
  };

  return (
    <div className="bg-gray-900/60 rounded-lg p-4 overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: 0, minWidth: '720px' }}>
        <thead>
          <tr>
            <th className="text-xs text-amber-200/60 w-6"></th>
            {Array.from({ length: NUM_FRETS + 1 }).map((_, f) => (
              <th
                key={f}
                className="text-xs text-amber-200/50 font-normal text-center pb-1"
                style={{ minWidth: '32px' }}
              >
                {f === 0 ? '' : f}
                {INLAY_FRETS.includes(f) && (
                  <div className="text-amber-300/40 text-[10px]">●{f === 12 ? '●' : ''}</div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row) => (
            <tr key={row.stringIndex}>
              <td className="text-xs text-amber-200/60 pr-2 text-right font-mono">
                {STRING_LABELS[5 - row.stringIndex]}
              </td>
              {row.cells.map((cell) => {
                const inScale = scaleNotes.has(cell.note);
                const isRoot = cell.note === root;
                const inRange = isInRange(cell.fret);
                const showDot = inScale && inRange;
                const degree = inScale ? getDegreeLabel(cell.note, root, scaleType) : '';

                return (
                  <td
                    key={cell.fret}
                    className="relative text-center align-middle border-b border-gray-700/50"
                    style={{
                      height: '32px',
                      borderRight: cell.fret === 0 ? '3px solid #a78bfa' : '1px solid #4b5563',
                    }}
                  >
                    {showDot && (
                      <div
                        className="inline-flex items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{
                          width: '22px',
                          height: '22px',
                          background: isRoot
                            ? 'linear-gradient(135deg, #dc2626, #991b1b)'
                            : 'linear-gradient(135deg, #4a5568, #2d3748)',
                          border: isRoot ? '2px solid #b91c1c' : '2px solid #1a202c',
                          opacity: inRange ? 1 : 0.3,
                        }}
                        title={`${cell.note} (${degree || '—'}) — fret ${cell.fret}`}
                      >
                        {isRoot ? 'R' : degree}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
