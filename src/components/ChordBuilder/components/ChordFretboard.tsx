import {
  STANDARD_TUNING,
  STANDARD_TUNING_INDICES,
  getNoteName,
} from '@/lib/musicTheory';
import type { ChordVoicing } from '@/lib/chordVoicings';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NUM_FRETS = 15;
const INLAY_POSITIONS = [3, 5, 7, 9, 12, 15];
const DOUBLE_INLAY_FRETS = [12];
const STRING_HEIGHTS = [8, 6, 5, 4, 3, 2];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChordFretboardProps {
  /** The set of notes in the selected chord (e.g. ["C", "E", "G"]) */
  chordNotes: string[];
  /** The current voicing, if any (to highlight specific positions brightly) */
  currentVoicing: ChordVoicing | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Full 15-fret guitar fretboard showing:
 * - Voicing positions in bright colors (amber for root, cyan for other tones)
 * - All other positions where chord tones exist, dimmed
 * - Ghost hover notes on empty positions
 *
 * Follows the same visual style as IntervalFretboard for consistency.
 */
export default function ChordFretboard({
  chordNotes,
  currentVoicing,
}: ChordFretboardProps) {
  if (chordNotes.length === 0) return null;

  const rootNote = chordNotes[0];

  // Build a set of "voiced" positions from the current voicing
  const voicedPositions = buildVoicedPositionSet(currentVoicing);

  return (
    <div
      className="rounded-lg p-6"
      style={{
        background:
          'linear-gradient(135deg, hsl(30, 40%, 25%) 0%, hsl(30, 35%, 30%) 50%, hsl(30, 40%, 25%) 100%)',
        boxShadow:
          '0 10px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Fret numbers */}
      <div className="flex mb-3">
        <div className="w-12 flex-shrink-0" />
        {Array.from({ length: NUM_FRETS }, (_, i) => i + 1).map((fret) => (
          <div
            key={fret}
            className="flex-1 text-center text-xs font-mono"
            style={{ color: fret === 12 ? '#fbbf24' : '#d4af7a' }}
          >
            {fret}
          </div>
        ))}
      </div>

      {/* Fretboard surface */}
      <div
        className="relative rounded"
        style={{
          background:
            'linear-gradient(to bottom, hsl(30, 25%, 20%), hsl(30, 30%, 28%), hsl(30, 25%, 20%))',
          boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div className="relative py-4">
          {[...STANDARD_TUNING].reverse().map((tuningNote, reversedIdx) => {
            const stringIndex = STANDARD_TUNING.length - 1 - reversedIdx;
            return (
              <FretboardString
                key={stringIndex}
                stringIndex={stringIndex}
                tuningNote={tuningNote}
                chordNotes={chordNotes}
                rootNote={rootNote}
                voicedPositions={voicedPositions}
              />
            );
          })}
        </div>

        {/* Inlay markers */}
        <div className="flex absolute bottom-1 left-12 right-0">
          {Array.from({ length: NUM_FRETS }, (_, i) => i + 1).map((fret) => (
            <div
              key={fret}
              className="flex-1 h-8 flex items-center justify-center gap-2"
            >
              {INLAY_POSITIONS.includes(fret) && (
                <>
                  <InlayDot />
                  {DOUBLE_INLAY_FRETS.includes(fret) && <InlayDot />}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface FretboardStringProps {
  stringIndex: number;
  tuningNote: string;
  chordNotes: string[];
  rootNote: string;
  voicedPositions: Set<string>;
}

function FretboardString({
  stringIndex,
  tuningNote,
  chordNotes,
  rootNote,
  voicedPositions,
}: FretboardStringProps) {
  const height = STRING_HEIGHTS[stringIndex];
  const stringStyle = {
    height: `${height}px`,
    background: 'linear-gradient(to bottom, #bfbcc2, #e7e4eb, #bfbcc2)',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
  };

  return (
    <div className="relative flex items-center mb-1 last:mb-0">
      {/* Nut label */}
      <div
        className="w-12 flex-shrink-0 flex items-center justify-center"
        style={{
          height: '40px',
          background: 'linear-gradient(to right, hsl(30, 20%, 12%), hsl(30, 20%, 18%))',
          borderRight: '3px solid hsl(30, 15%, 8%)',
          boxShadow: 'inset -2px 0 4px rgba(0, 0, 0, 0.5)',
        }}
      >
        <span className="text-amber-100 font-bold text-xs">{tuningNote}</span>
      </div>

      {/* String line */}
      <div className="absolute left-12 right-0 flex items-center">
        <div className="w-full" style={stringStyle} />
      </div>

      {/* Fret cells */}
      {Array.from({ length: NUM_FRETS }, (_, f) => f + 1).map((fret) => (
        <FretCell
          key={fret}
          stringIndex={stringIndex}
          fret={fret}
          chordNotes={chordNotes}
          rootNote={rootNote}
          voicedPositions={voicedPositions}
        />
      ))}
    </div>
  );
}

interface FretCellProps {
  stringIndex: number;
  fret: number;
  chordNotes: string[];
  rootNote: string;
  voicedPositions: Set<string>;
}

function FretCell({
  stringIndex,
  fret,
  chordNotes,
  rootNote,
  voicedPositions,
}: FretCellProps) {
  const noteName = getNoteName(STANDARD_TUNING_INDICES[stringIndex] + fret);
  const isChordTone = chordNotes.includes(noteName);
  const isRoot = noteName === rootNote;
  const isVoiced = voicedPositions.has(`${stringIndex}-${fret}`);

  const showDot = isChordTone;

  return (
    <div
      className="relative flex-1 flex items-center justify-center group"
      style={{
        height: '40px',
        borderRight: fret === NUM_FRETS ? 'none' : '2px solid hsl(30, 30%, 35%)',
      }}
    >
      {showDot ? (
        <div
          className="absolute z-10 rounded-full flex items-center justify-center transition-all"
          style={{
            width: isVoiced ? '32px' : '26px',
            height: isVoiced ? '32px' : '26px',
            ...getDotStyle(isRoot, isVoiced),
          }}
        >
          <span
            className="text-white font-mono font-bold"
            style={{ fontSize: isVoiced ? '12px' : '10px' }}
          >
            {noteName}
          </span>
        </div>
      ) : (
        <div className="absolute z-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-70 transition-opacity w-7 h-7 bg-gray-600/80">
          <span className="text-gray-200 text-xs font-mono">{noteName}</span>
        </div>
      )}
    </div>
  );
}

function InlayDot() {
  return (
    <div
      className="rounded-full"
      style={{
        width: '10px',
        height: '10px',
        background: 'radial-gradient(circle, #f5f5dc 0%, #d4c5a9 100%)',
        boxShadow:
          'inset 0 1px 2px rgba(255, 255, 255, 0.5), 0 1px 3px rgba(0, 0, 0, 0.4)',
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a Set of "stringIndex-fret" keys for the voiced positions. */
function buildVoicedPositionSet(voicing: ChordVoicing | null): Set<string> {
  const set = new Set<string>();
  if (!voicing) return set;
  for (let i = 0; i < 6; i++) {
    const fret = voicing.frets[i];
    if (fret !== null && fret > 0) {
      set.add(`${i}-${fret}`);
    }
  }
  return set;
}

/** Returns inline styles for a chord-tone dot based on whether it's root and/or voiced. */
function getDotStyle(isRoot: boolean, isVoiced: boolean): React.CSSProperties {
  if (isRoot && isVoiced) {
    return {
      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      border: '2px solid #b45309',
      boxShadow: '0 0 12px rgba(245, 158, 11, 0.5), 0 2px 8px rgba(0, 0, 0, 0.4)',
    };
  }
  if (isRoot) {
    return {
      background: 'linear-gradient(135deg, #92400e 0%, #78350f 100%)',
      border: '2px solid #713f12',
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
      opacity: 0.6,
    };
  }
  if (isVoiced) {
    return {
      background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
      border: '2px solid #0e7490',
      boxShadow: '0 0 12px rgba(6, 182, 212, 0.5), 0 2px 8px rgba(0, 0, 0, 0.4)',
    };
  }
  // Chord tone but not in the current voicing -- dimmed
  return {
    background: 'linear-gradient(135deg, #155e75 0%, #164e63 100%)',
    border: '2px solid #0e4f5c',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
    opacity: 0.5,
  };
}
