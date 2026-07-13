'use client';

import { useState } from 'react';
import {
  NOTES,
  SCALE_FORMULAS,
  getScaleNotes,
  CAGED_POSITIONS,
  MAJOR_PENTATONIC_POSITIONS,
  MINOR_PENTATONIC_POSITIONS,
  THREE_NPS_POSITIONS,
  getShapeFretWindow,
} from '@/lib/musicTheory';
import type { ScaleType, FretboardShape } from '@/lib/musicTheory';
import { FretboardDisplay, useFretboardEnhancements } from '@/components/ScaleExplorer';

type ShapeSystem = 'None' | 'CAGED' | 'Pentatonic' | '3NPS';

const SHAPE_SYSTEMS: ShapeSystem[] = ['None', 'CAGED', 'Pentatonic', '3NPS'];

interface BackingTrackFretboardProps {
  rootNote: string;
  scaleType: string;
  onRootChange: (root: string) => void;
  onScaleChange: (scale: string) => void;
}

export default function BackingTrackFretboard({
  rootNote,
  scaleType,
  onRootChange,
  onScaleChange,
}: BackingTrackFretboardProps) {
  const [shapeSystem, setShapeSystem] = useState<ShapeSystem>('None');
  const [shapePosition, setShapePosition] = useState<number>(1);

  // Resolve the current shape array based on system + scale.
  const shapeArray: FretboardShape[] = (() => {
    switch (shapeSystem) {
      case 'CAGED':
        return CAGED_POSITIONS;
      case '3NPS':
        return THREE_NPS_POSITIONS;
      case 'Pentatonic':
        return scaleType === 'Major Pentatonic'
          ? MAJOR_PENTATONIC_POSITIONS
          : MINOR_PENTATONIC_POSITIONS;
      case 'None':
      default:
        return [];
    }
  })();

  const activeShape = shapeArray.find((s) => s.position === shapePosition) ?? null;
  const boxOutline = activeShape ? getShapeFretWindow(activeShape, rootNote) : null;

  // Reset shape position to 1 when switching systems (so out-of-range positions vanish).
  function handleShapeSystemChange(next: ShapeSystem) {
    setShapeSystem(next);
    setShapePosition(1);
  }

  const enhancements = useFretboardEnhancements({
    selectedKey: rootNote,
    selectedScale: scaleType as ScaleType,
  });

  // Backing tracks always require a real scale — exclude 'None'.
  const scaleOptions = Object.keys(SCALE_FORMULAS).filter((s) => s !== 'None');

  const scaleNotes = getScaleNotes(rootNote, scaleType);

  return (
    <div className="flex flex-col gap-4">
      {/* Root + scale + shape selectors */}
      <div className="flex flex-wrap gap-4 items-end justify-center">
        <div className="flex flex-col gap-1">
          <label className="text-amber-200/70 text-xs font-medium">Root</label>
          <select
            value={rootNote}
            onChange={(e) => onRootChange(e.target.value)}
            className="px-3 py-2 rounded bg-amber-900/50 text-amber-100 border border-amber-700/50 focus:outline-none focus:border-amber-500"
          >
            {NOTES.map((note) => (
              <option key={note} value={note}>{note}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-amber-200/70 text-xs font-medium">Scale</label>
          <select
            value={scaleType}
            onChange={(e) => onScaleChange(e.target.value)}
            className="px-3 py-2 rounded bg-amber-900/50 text-amber-100 border border-amber-700/50 focus:outline-none focus:border-amber-500"
          >
            {scaleOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-amber-200/70 text-xs font-medium">Shape system</label>
          <select
            value={shapeSystem}
            onChange={(e) => handleShapeSystemChange(e.target.value as ShapeSystem)}
            className="px-3 py-2 rounded bg-amber-900/50 text-amber-100 border border-amber-700/50 focus:outline-none focus:border-amber-500"
          >
            {SHAPE_SYSTEMS.map((sys) => (
              <option key={sys} value={sys}>{sys}</option>
            ))}
          </select>
        </div>
        {shapeSystem !== 'None' && shapeArray.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-amber-200/70 text-xs font-medium">Shape</label>
            <select
              value={shapePosition}
              onChange={(e) => setShapePosition(Number(e.target.value))}
              className="px-3 py-2 rounded bg-amber-900/50 text-amber-100 border border-amber-700/50 focus:outline-none focus:border-amber-500"
            >
              {shapeArray.map((s) => (
                <option key={s.position} value={s.position}>
                  {shapeSystem === 'Pentatonic' ? s.name : `Shape ${s.position} (${s.name})`}
                </option>
              ))}
            </select>
          </div>
        )}
        <p className="text-amber-300 text-sm ml-2 pb-2">{rootNote} {scaleType}</p>
      </div>

      {/* Notes in the current scale */}
      {scaleNotes.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-amber-200/60 text-xs uppercase tracking-wide">Notes</span>
          {scaleNotes.map((note, idx) => (
            <span
              key={`${note}-${idx}`}
              className={`px-2.5 py-1 rounded text-sm font-mono font-bold ${
                idx === 0
                  ? 'bg-red-600/80 text-white border border-red-500'
                  : 'bg-amber-800/40 text-amber-100 border border-amber-700/40'
              }`}
            >
              {note}
            </span>
          ))}
        </div>
      )}

      {/* Fretboard — full 24 frets so you can solo across the neck */}
      <FretboardDisplay
        getNoteDisplayInfo={enhancements.getNoteDisplayInfo}
        showDegreeColors={enhancements.showDegreeColors}
        isComparing={enhancements.isComparing}
        showNoteNames={true}
        numFrets={24}
        boxOutline={boxOutline}
        outsideBoxBehavior="dim"
      />
    </div>
  );
}
