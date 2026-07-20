import { getNoteName, getChordNotes } from '@/lib/musicTheory';
import type { DiatonicChord } from '@/lib/musicTheory';
import { getVoicingsForChord } from '@/lib/chordVoicings';
import type { ChordVoicing } from '@/lib/chordVoicings';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MiniChordDiagramProps {
  root: string;
  quality: DiatonicChord['quality'];
  chordName: string;
}

// ---------------------------------------------------------------------------
// SVG layout constants (compact, static — mirrors ChordBuilder/ChordDiagram)
// ---------------------------------------------------------------------------

/** Standard tuning open note indices: E=4, A=9, D=2, G=7, B=11, E=4 */
const TUNING_INDICES = [4, 9, 2, 7, 11, 4];

const MARGIN_LEFT = 18;
const MARGIN_TOP = 18;
const STRING_SPACING = 14;
const FRET_SPACING = 18;
const NUM_STRINGS = 6;
const DISPLAY_FRETS = 4;
const WIDTH = MARGIN_LEFT + (NUM_STRINGS - 1) * STRING_SPACING + 18;
const HEIGHT = MARGIN_TOP + DISPLAY_FRETS * FRET_SPACING + 10;
const DOT_RADIUS = 5;

/** Quality names double as chordVoicings/CHORD_FORMULAS type keys. */
function typeForQuality(quality: DiatonicChord['quality']): string {
  return quality; // 'Major' | 'Minor' | 'Diminished' | 'Augmented'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Compact, static SVG chord diagram. Shows the first available voicing for the
 * chord; if none exists, lists the chord's notes as a text fallback.
 */
export default function MiniChordDiagram({ root, quality, chordName }: MiniChordDiagramProps) {
  const type = typeForQuality(quality);
  const voicing: ChordVoicing | undefined = getVoicingsForChord(root, type)[0];
  const rootNote = getChordNotes(root, type)[0] ?? root;

  if (!voicing) {
    const notes = getChordNotes(root, type);
    return (
      <div className="flex items-center justify-center text-center px-2 py-3 rounded bg-amber-950/40 border border-amber-800/30" style={{ width: WIDTH, height: HEIGHT }}>
        <span className="text-[10px] leading-tight text-amber-200/60">
          {notes.length ? notes.join(' · ') : 'no diagram'}
        </span>
      </div>
    );
  }

  const isOpen = voicing.position <= 1;

  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="select-none">
      {/* Nut (open) or position label */}
      {isOpen ? (
        <rect x={MARGIN_LEFT - 1} y={MARGIN_TOP - 3} width={(NUM_STRINGS - 1) * STRING_SPACING + 2} height={3} rx={1} fill="#d4c5a9" />
      ) : (
        <text x={MARGIN_LEFT - 10} y={MARGIN_TOP + FRET_SPACING / 2 + 3} textAnchor="middle" fill="#d4a373" style={{ fontSize: '8px', fontFamily: 'monospace' }}>
          {voicing.position}
        </text>
      )}

      {/* Fret lines */}
      {Array.from({ length: DISPLAY_FRETS + 1 }, (_, i) => (
        <line key={`f${i}`} x1={MARGIN_LEFT} y1={MARGIN_TOP + i * FRET_SPACING} x2={MARGIN_LEFT + (NUM_STRINGS - 1) * STRING_SPACING} y2={MARGIN_TOP + i * FRET_SPACING} stroke="#78716c" strokeWidth={i === 0 && isOpen ? 2 : 1} />
      ))}

      {/* String lines */}
      {Array.from({ length: NUM_STRINGS }, (_, i) => (
        <line key={`s${i}`} x1={MARGIN_LEFT + i * STRING_SPACING} y1={MARGIN_TOP} x2={MARGIN_LEFT + i * STRING_SPACING} y2={MARGIN_TOP + DISPLAY_FRETS * FRET_SPACING} stroke="#a8a29e" strokeWidth={1} />
      ))}

      {/* X / O indicators */}
      {voicing.frets.map((fret, s) => {
        const x = MARGIN_LEFT + s * STRING_SPACING;
        const y = MARGIN_TOP - 7;
        if (fret === null) {
          return <text key={`x${s}`} x={x} y={y} textAnchor="middle" fill="#ef4444" style={{ fontSize: '8px', fontWeight: 700 }}>×</text>;
        }
        if (fret === 0) {
          return <circle key={`o${s}`} cx={x} cy={y - 2} r={2.5} fill="none" stroke="#a8a29e" strokeWidth={1} />;
        }
        return null;
      })}

      {/* Barre */}
      {voicing.barreInfo && (() => {
        const b = voicing.barreInfo;
        const fretOffset = b.fret - (voicing.position > 0 ? voicing.position : 0);
        const y = MARGIN_TOP + (fretOffset - 0.5) * FRET_SPACING;
        const x1 = MARGIN_LEFT + b.fromString * STRING_SPACING;
        const x2 = MARGIN_LEFT + b.toString * STRING_SPACING;
        return <rect x={x1 - 3} y={y - 3} width={x2 - x1 + 6} height={6} rx={3} fill="#44403c" stroke="#78716c" strokeWidth={0.75} />;
      })()}

      {/* Fretted dots */}
      {voicing.frets.map((fret, s) => {
        if (fret === null || fret === 0) return null;
        const displayFret = fret - (voicing.position > 0 ? voicing.position : 0) + (voicing.position > 0 ? 1 : 0);
        const x = MARGIN_LEFT + s * STRING_SPACING;
        const y = MARGIN_TOP + (displayFret - 0.5) * FRET_SPACING;
        const noteName = getNoteName(TUNING_INDICES[s] + fret);
        const isRoot = noteName === rootNote;
        return (
          <circle key={`d${s}`} cx={x} cy={y} r={DOT_RADIUS} fill={isRoot ? '#d97706' : '#0891b2'} stroke={isRoot ? '#b45309' : '#0e7490'} strokeWidth={1} />
        );
      })}

      {/* screen-reader label */}
      <title>{chordName}</title>
    </svg>
  );
}
