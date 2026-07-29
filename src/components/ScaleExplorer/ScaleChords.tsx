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
    <div className="w-full text-left">
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
