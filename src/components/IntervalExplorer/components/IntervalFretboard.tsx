import {
  STANDARD_TUNING,
  getNoteAtFret,
} from '@/lib/musicTheory';
import type { FretPosition } from '../types';

const NUM_FRETS = 15;
const INLAY_POSITIONS = [3, 5, 7, 9, 12, 15];
const DOUBLE_INLAY_FRETS = [12];

/** String thickness in pixels, from 6th (thickest) to 1st (thinnest). */
const STRING_HEIGHTS = [8, 6, 5, 4, 3, 2];

interface IntervalFretboardProps {
  selectedRoot: FretPosition;
  selectedTarget: FretPosition | null;
  allOccurrences: FretPosition[];
  showAllOccurrences: boolean;
  onFretClick: (stringIndex: number, fret: number) => void;
}

/** Check whether a fret position matches a specific string + fret. */
function positionMatches(pos: FretPosition, s: number, f: number): boolean {
  return pos.string === s && pos.fret === f;
}

/** Check whether a position appears in a list of positions. */
function isInPositionList(positions: FretPosition[], s: number, f: number): boolean {
  return positions.some((p) => p.string === s && p.fret === f);
}

export default function IntervalFretboard({
  selectedRoot,
  selectedTarget,
  allOccurrences,
  showAllOccurrences,
  onFretClick,
}: IntervalFretboardProps) {
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
        {/* Strings (reversed so 1st string is at top visually) */}
        <div className="relative py-4">
          {[...STANDARD_TUNING].reverse().map((tuningNote, reversedIdx) => {
            const stringIndex = STANDARD_TUNING.length - 1 - reversedIdx;
            return (
              <FretboardString
                key={stringIndex}
                stringIndex={stringIndex}
                tuningNote={tuningNote}
                selectedRoot={selectedRoot}
                selectedTarget={selectedTarget}
                allOccurrences={allOccurrences}
                showAllOccurrences={showAllOccurrences}
                onFretClick={onFretClick}
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
  selectedRoot: FretPosition;
  selectedTarget: FretPosition | null;
  allOccurrences: FretPosition[];
  showAllOccurrences: boolean;
  onFretClick: (stringIndex: number, fret: number) => void;
}

function FretboardString({
  stringIndex,
  tuningNote,
  selectedRoot,
  selectedTarget,
  allOccurrences,
  showAllOccurrences,
  onFretClick,
}: FretboardStringProps) {
  const height = STRING_HEIGHTS[stringIndex];
  const stringStyle = {
    height: `${height}px`,
    background: 'linear-gradient(to bottom, #bfbcc2, #e7e4eb, #bfbcc2)',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
  };

  return (
    <div className="relative flex items-center mb-1 last:mb-0">
      {/* Nut with open string label */}
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
          selectedRoot={selectedRoot}
          selectedTarget={selectedTarget}
          allOccurrences={allOccurrences}
          showAllOccurrences={showAllOccurrences}
          onFretClick={onFretClick}
        />
      ))}
    </div>
  );
}

interface FretCellProps {
  stringIndex: number;
  fret: number;
  selectedRoot: FretPosition;
  selectedTarget: FretPosition | null;
  allOccurrences: FretPosition[];
  showAllOccurrences: boolean;
  onFretClick: (stringIndex: number, fret: number) => void;
}

function FretCell({
  stringIndex,
  fret,
  selectedRoot,
  selectedTarget,
  allOccurrences,
  showAllOccurrences,
  onFretClick,
}: FretCellProps) {
  const noteName = getNoteAtFret(stringIndex, fret);
  const isRoot = positionMatches(selectedRoot, stringIndex, fret);
  const isTarget = selectedTarget
    ? positionMatches(selectedTarget, stringIndex, fret)
    : false;
  const isOccurrence =
    showAllOccurrences && isInPositionList(allOccurrences, stringIndex, fret);

  const showDot = isRoot || isTarget || isOccurrence;

  const dotStyle = getDotStyle(isRoot, isTarget);

  return (
    <div
      className="relative flex-1 flex items-center justify-center cursor-pointer group"
      style={{
        height: '40px',
        borderRight: fret === NUM_FRETS ? 'none' : '2px solid hsl(30, 30%, 35%)',
      }}
      onClick={() => onFretClick(stringIndex, fret)}
    >
      {showDot ? (
        <div
          className="absolute z-10 rounded-full flex items-center justify-center transition-all"
          style={{
            width: '32px',
            height: '32px',
            ...dotStyle,
          }}
        >
          <span className="text-white text-xs font-mono font-bold">{noteName}</span>
        </div>
      ) : (
        /* Hover ghost dot - show note name on hover for empty positions */
        <div className="absolute z-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-70 transition-opacity w-7 h-7 bg-gray-600/80">
          <span className="text-gray-200 text-xs font-mono">{noteName}</span>
        </div>
      )}
    </div>
  );
}

/** Returns inline styles for a note dot based on its role. */
function getDotStyle(
  isRoot: boolean,
  isTarget: boolean,
): React.CSSProperties {
  if (isRoot) {
    return {
      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      border: '2px solid #b45309',
      boxShadow: '0 0 12px rgba(245, 158, 11, 0.5), 0 2px 8px rgba(0, 0, 0, 0.4)',
    };
  }
  if (isTarget) {
    return {
      background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
      border: '2px solid #0e7490',
      boxShadow: '0 0 12px rgba(6, 182, 212, 0.5), 0 2px 8px rgba(0, 0, 0, 0.4)',
    };
  }
  // Occurrence (dimmer shade)
  return {
    background: 'linear-gradient(135deg, #155e75 0%, #164e63 100%)',
    border: '2px solid #0e4f5c',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
    opacity: 0.7,
  };
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
