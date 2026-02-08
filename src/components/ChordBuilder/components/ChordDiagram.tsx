import { getNoteName } from '@/lib/musicTheory';
import type { ChordVoicing } from '@/lib/chordVoicings';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChordDiagramProps {
  voicing: ChordVoicing | null;
  chordSymbol: string;
  chordNotes: string[];
  voicingCount: number;
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onPlay: () => void;
}

// ---------------------------------------------------------------------------
// SVG layout constants
// ---------------------------------------------------------------------------

/** Standard tuning open note indices: E=4, A=9, D=2, G=7, B=11, E=4 */
const TUNING_INDICES = [4, 9, 2, 7, 11, 4];

const MARGIN_LEFT = 40;
const MARGIN_TOP = 50;
const STRING_SPACING = 30;
const FRET_SPACING = 40;
const NUM_STRINGS = 6;
const DISPLAY_FRETS = 5;
const DIAGRAM_WIDTH = MARGIN_LEFT + (NUM_STRINGS - 1) * STRING_SPACING + 40;
const DIAGRAM_HEIGHT = MARGIN_TOP + DISPLAY_FRETS * FRET_SPACING + 30;
const DOT_RADIUS = 11;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SVG-based chord diagram in the classic vertical "chord book" style.
 *
 * - Nut drawn at the top for open position chords
 * - Position marker shown if chord starts higher than fret 1
 * - Finger numbers shown inside fretted dots
 * - Muted strings marked with X, open strings with O
 * - Root notes are amber, other chord tones are cyan
 * - Barre drawn as a rounded rectangle
 */
export default function ChordDiagram({
  voicing,
  chordSymbol,
  chordNotes,
  voicingCount,
  currentIndex,
  onPrev,
  onNext,
  onPlay,
}: ChordDiagramProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Chord name */}
      <h2 className="text-2xl font-bold text-white">{chordSymbol}</h2>

      {voicing ? (
        <>
          {/* Voicing name */}
          {voicing.name && (
            <span className="text-sm text-gray-400">{voicing.name}</span>
          )}

          {/* SVG diagram */}
          <svg
            width={DIAGRAM_WIDTH}
            height={DIAGRAM_HEIGHT}
            viewBox={`0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}`}
            className="select-none"
          >
            <DiagramGrid position={voicing.position} />
            <DiagramStrings />
            <MutedOpenIndicators voicing={voicing} />
            {voicing.barreInfo && (
              <Barre
                barreInfo={voicing.barreInfo}
                position={voicing.position}
              />
            )}
            <FrettedDots
              voicing={voicing}
              chordNotes={chordNotes}
            />
          </svg>

          {/* Navigation controls */}
          <VoicingNav
            voicingCount={voicingCount}
            currentIndex={currentIndex}
            onPrev={onPrev}
            onNext={onNext}
          />
        </>
      ) : (
        <NoVoicingPlaceholder chordNotes={chordNotes} />
      )}

      {/* Play button */}
      <button
        onClick={onPlay}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition-colors"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <polygon points="5,3 19,12 5,21" />
        </svg>
        Play Chord
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** The fret grid lines and nut/position indicator. */
function DiagramGrid({ position }: { position: number }) {
  const isOpenPosition = position <= 1;

  return (
    <g>
      {/* Nut or position marker */}
      {isOpenPosition ? (
        <rect
          x={MARGIN_LEFT - 2}
          y={MARGIN_TOP - 4}
          width={(NUM_STRINGS - 1) * STRING_SPACING + 4}
          height={6}
          rx={1}
          fill="#d4c5a9"
        />
      ) : (
        <text
          x={MARGIN_LEFT - 18}
          y={MARGIN_TOP + FRET_SPACING / 2 + 4}
          textAnchor="middle"
          className="text-xs font-mono"
          fill="#9ca3af"
        >
          {position}fr
        </text>
      )}

      {/* Horizontal fret lines */}
      {Array.from({ length: DISPLAY_FRETS + 1 }, (_, i) => (
        <line
          key={`fret-${i}`}
          x1={MARGIN_LEFT}
          y1={MARGIN_TOP + i * FRET_SPACING}
          x2={MARGIN_LEFT + (NUM_STRINGS - 1) * STRING_SPACING}
          y2={MARGIN_TOP + i * FRET_SPACING}
          stroke="#6b7280"
          strokeWidth={i === 0 ? 2 : 1}
        />
      ))}
    </g>
  );
}

/** Vertical string lines. */
function DiagramStrings() {
  return (
    <g>
      {Array.from({ length: NUM_STRINGS }, (_, i) => (
        <line
          key={`string-${i}`}
          x1={MARGIN_LEFT + i * STRING_SPACING}
          y1={MARGIN_TOP}
          x2={MARGIN_LEFT + i * STRING_SPACING}
          y2={MARGIN_TOP + DISPLAY_FRETS * FRET_SPACING}
          stroke="#9ca3af"
          strokeWidth={2 - i * 0.2}
        />
      ))}
    </g>
  );
}

/** X and O indicators above the nut for muted/open strings. */
function MutedOpenIndicators({ voicing }: { voicing: ChordVoicing }) {
  return (
    <g>
      {voicing.frets.map((fret, stringIdx) => {
        const x = MARGIN_LEFT + stringIdx * STRING_SPACING;
        const y = MARGIN_TOP - 16;

        if (fret === null) {
          return (
            <text
              key={`mute-${stringIdx}`}
              x={x}
              y={y}
              textAnchor="middle"
              fill="#ef4444"
              className="text-sm font-bold"
            >
              X
            </text>
          );
        }
        if (fret === 0) {
          return (
            <circle
              key={`open-${stringIdx}`}
              cx={x}
              cy={y - 4}
              r={6}
              fill="none"
              stroke="#9ca3af"
              strokeWidth={1.5}
            />
          );
        }
        return null;
      })}
    </g>
  );
}

/** Barre bar rendered as a rounded rectangle. */
function Barre({
  barreInfo,
  position,
}: {
  barreInfo: NonNullable<ChordVoicing['barreInfo']>;
  position: number;
}) {
  const fretOffset = barreInfo.fret - (position > 0 ? position : 0);
  const y = MARGIN_TOP + (fretOffset - 0.5) * FRET_SPACING;
  const x1 = MARGIN_LEFT + barreInfo.fromString * STRING_SPACING;
  const x2 = MARGIN_LEFT + barreInfo.toString * STRING_SPACING;

  return (
    <rect
      x={x1 - 6}
      y={y - 7}
      width={x2 - x1 + 12}
      height={14}
      rx={7}
      fill="#374151"
      stroke="#6b7280"
      strokeWidth={1}
    />
  );
}

/** Dots on fretted positions with finger numbers inside. */
function FrettedDots({
  voicing,
  chordNotes,
}: {
  voicing: ChordVoicing;
  chordNotes: string[];
}) {
  const rootNote = chordNotes[0];

  return (
    <g>
      {voicing.frets.map((fret, stringIdx) => {
        if (fret === null || fret === 0) return null;

        const displayFret = fret - (voicing.position > 0 ? voicing.position : 0) + (voicing.position > 0 ? 1 : 0);
        const x = MARGIN_LEFT + stringIdx * STRING_SPACING;
        const y = MARGIN_TOP + (displayFret - 0.5) * FRET_SPACING;

        const noteName = getNoteName(TUNING_INDICES[stringIdx] + fret);
        const isRoot = noteName === rootNote;
        const finger = voicing.fingers[stringIdx];

        return (
          <g key={`dot-${stringIdx}`}>
            <circle
              cx={x}
              cy={y}
              r={DOT_RADIUS}
              fill={isRoot ? '#d97706' : '#0891b2'}
              stroke={isRoot ? '#b45309' : '#0e7490'}
              strokeWidth={1.5}
            />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              fill="white"
              className="text-xs font-bold"
              style={{ fontSize: '11px' }}
            >
              {finger && finger > 0 ? finger : ''}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Shown when no voicing diagram is available for the selected chord. */
function NoVoicingPlaceholder({ chordNotes }: { chordNotes: string[] }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 px-4 bg-gray-800/40 rounded-lg border border-gray-700/50">
      <span className="text-gray-400 text-sm text-center">
        No voicing diagram available for this chord.
      </span>
      {chordNotes.length > 0 && (
        <span className="text-gray-500 text-xs">
          Notes: {chordNotes.join(', ')}
        </span>
      )}
    </div>
  );
}

/** Left/right arrows to cycle through voicings. */
function VoicingNav({
  voicingCount,
  currentIndex,
  onPrev,
  onNext,
}: {
  voicingCount: number;
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (voicingCount <= 1) return null;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onPrev}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-700/60 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
        aria-label="Previous voicing"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <span className="text-sm text-gray-400 font-mono">
        {currentIndex + 1} / {voicingCount}
      </span>
      <button
        onClick={onNext}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-700/60 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
        aria-label="Next voicing"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
