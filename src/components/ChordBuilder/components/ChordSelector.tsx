import { NOTES } from '@/lib/musicTheory';
import { CHORD_TYPE_GROUPS } from '../types';
import type { ChordToneInfo } from '../hooks/useChordBuilder';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChordSelectorProps {
  selectedRoot: string;
  selectedType: string;
  chordSymbol: string;
  chordTones: ChordToneInfo[];
  onSelectRoot: (root: string) => void;
  onSelectType: (type: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Left panel: root note selector, chord quality selector, and formula display.
 *
 * Pure presentational component -- receives all data and callbacks via props.
 */
export default function ChordSelector({
  selectedRoot,
  selectedType,
  chordSymbol,
  chordTones,
  onSelectRoot,
  onSelectType,
}: ChordSelectorProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Root note selector */}
      <SectionLabel text="Root Note" />
      <div className="grid grid-cols-4 gap-1.5">
        {NOTES.map((note) => (
          <button
            key={note}
            onClick={() => onSelectRoot(note)}
            className={`px-2 py-2 rounded text-sm font-medium transition-colors ${
              selectedRoot === note
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-gray-700/60 text-gray-300 hover:bg-gray-600/80 hover:text-white'
            }`}
          >
            {note}
          </button>
        ))}
      </div>

      {/* Chord quality selector */}
      <SectionLabel text="Chord Quality" />
      <div className="flex flex-col gap-3">
        {CHORD_TYPE_GROUPS.map((group) => (
          <div key={group.label}>
            <span className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">
              {group.label}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {group.types.map((entry) => (
                <button
                  key={entry.key}
                  onClick={() => onSelectType(entry.key)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    selectedType === entry.key
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'bg-gray-700/60 text-gray-300 hover:bg-gray-600/80 hover:text-white'
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Chord formula display */}
      <SectionLabel text="Chord Formula" />
      <FormulaDisplay
        chordSymbol={chordSymbol}
        chordTones={chordTones}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ text }: { text: string }) {
  return (
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
      {text}
    </h3>
  );
}

interface FormulaDisplayProps {
  chordSymbol: string;
  chordTones: ChordToneInfo[];
}

function FormulaDisplay({ chordSymbol, chordTones }: FormulaDisplayProps) {
  if (chordTones.length === 0) return null;

  const noteList = chordTones.map((t) => t.note).join(' + ');
  const intervalList = chordTones.map((t) => t.abbreviation).join(', ');

  return (
    <div className="bg-gray-800/60 rounded-lg border border-gray-700/50 p-3 space-y-2">
      <div className="text-lg font-bold text-white">
        {chordSymbol}{' '}
        <span className="text-sm font-normal text-gray-400">
          = {noteList}
        </span>
      </div>
      <div className="text-sm text-gray-400">
        Formula:{' '}
        <span className="font-mono text-amber-300/80">{intervalList}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chordTones.map((tone) => (
          <span
            key={tone.semitones}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${
              tone.semitones === 0
                ? 'bg-amber-900/30 text-amber-300 border-amber-600/40'
                : 'bg-gray-700/50 text-gray-300 border-gray-600/40'
            }`}
          >
            <span className="font-mono font-bold">{tone.abbreviation}</span>
            <span className="text-gray-400">
              {tone.note}
              {tone.semitones > 0 && ` (${tone.intervalName})`}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
