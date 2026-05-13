import { STANDARD_TUNING, getNoteAtFret, getScaleNotes } from "@/lib/musicTheory";
import {
  SHAPE_COLORS,
  findAllRootPositions,
  type TransposedShape,
} from "./cagedShapes";

interface CagedFretboardProps {
  rootNote: string;
  shapes: TransposedShape[];
  /** Scale to overlay around the shape(s). "None" or undefined = no overlay. */
  scaleType?: string;
  numFrets?: number;
}

const STRING_LABELS = [...STANDARD_TUNING].reverse();

const LEFT = 44;
const RIGHT = 12;
const TOP = 28;
const BOTTOM = 22;
const FRET_W = 52;
const STRING_H = 26;
const NUM_STRINGS = 6;
const INLAYS_SINGLE = [3, 5, 7, 9, 15];
const INLAYS_DOUBLE = [12];
const DOT_R = 11;
const ROOT_R = 6;
const OPEN_OFFSET = 22;

const ROOT_FILL = "#f59e0b";
const ROOT_STROKE = "#b45309";
const TONE_FILL = "#0891b2";
const TONE_STROKE = "#0e7490";

/**
 * Horizontal SVG fretboard for visualizing CAGED shapes.
 *
 * - High E on top, low E on bottom (tab convention).
 * - Single shape: amber root + cyan non-root, finger numbers inside, dim
 *   hollow rings on every other root location across the neck.
 * - Multi shape: each shape gets its own accent color from SHAPE_COLORS, and
 *   a label is placed near its lowest-fret root.
 */
export default function CagedFretboard({
  rootNote,
  shapes,
  scaleType,
  numFrets = 15,
}: CagedFretboardProps) {
  const isSingle = shapes.length === 1;
  const width = LEFT + numFrets * FRET_W + RIGHT;
  const height = TOP + (NUM_STRINGS - 1) * STRING_H + BOTTOM;

  const scaleNotes = scaleType ? getScaleNotes(rootNote, scaleType) : [];
  const showScale = scaleNotes.length > 0;

  const rootPositions =
    isSingle && !showScale ? findAllRootPositions(rootNote, numFrets) : [];

  // Positions covered by the rendered shapes — skip when drawing the scale overlay.
  const shapeOccupied = new Set<string>();
  for (const ts of shapes) {
    ts.frets.forEach((fret, stringIdx) => {
      if (fret !== null) shapeOccupied.add(`${stringIdx}-${fret}`);
    });
  }

  // Fret window for the scale overlay.
  // Single shape: tight box around the shape (one fret below to two above).
  // Multi shape: full neck.
  let scaleFretMin = 0;
  let scaleFretMax = numFrets;
  if (isSingle && showScale) {
    scaleFretMin = Math.max(0, shapes[0].lowestFret - 1);
    scaleFretMax = Math.min(numFrets, shapes[0].highestFret + 2);
  }

  const scalePositions: { stringIdx: number; fret: number; isRoot: boolean }[] = [];
  if (showScale) {
    for (let stringIdx = 0; stringIdx < NUM_STRINGS; stringIdx++) {
      for (let fret = scaleFretMin; fret <= scaleFretMax; fret++) {
        if (shapeOccupied.has(`${stringIdx}-${fret}`)) continue;
        const note = getNoteAtFret(stringIdx, fret);
        if (scaleNotes.includes(note)) {
          scalePositions.push({ stringIdx, fret, isRoot: note === rootNote });
        }
      }
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg p-3 bg-neutral-900 border border-neutral-800">
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="select-none"
        style={{ minWidth: 600 }}
      >
        <FretboardBase numFrets={numFrets} />
        <Inlays numFrets={numFrets} />
        <FretNumbers numFrets={numFrets} />
        <Strings numFrets={numFrets} />
        <StringLabels />

        {rootPositions.map((p, i) => (
          <RootGhost key={`ghost-${i}`} stringIdx={p.stringIdx} fret={p.fret} />
        ))}

        {scalePositions.map((p) => (
          <ScaleDot
            key={`scale-${p.stringIdx}-${p.fret}`}
            stringIdx={p.stringIdx}
            fret={p.fret}
            isRoot={p.isRoot}
          />
        ))}

        {shapes.map((ts) => (
          <ShapeNotes
            key={ts.shape.name}
            ts={ts}
            multi={!isSingle}
            rootNote={rootNote}
          />
        ))}

        {!isSingle &&
          shapes.map((ts) => <ShapeLabel key={`lbl-${ts.shape.name}`} ts={ts} />)}
      </svg>
    </div>
  );
}

function ScaleDot({
  stringIdx,
  fret,
  isRoot,
}: {
  stringIdx: number;
  fret: number;
  isRoot: boolean;
}) {
  const { x, y } = notePos(stringIdx, fret);
  const noteName = getNoteAtFret(stringIdx, fret);
  return (
    <g opacity={0.7}>
      <circle
        cx={x}
        cy={y}
        r={8}
        fill={isRoot ? "#7c2d12" : "#1f2937"}
        stroke={isRoot ? "#f59e0b" : "#6b7280"}
        strokeWidth={1.5}
      />
      <text
        x={x}
        y={y + 3}
        textAnchor="middle"
        fontSize={noteName.length > 1 ? 7 : 9}
        fontWeight="bold"
        fill={isRoot ? "#fde68a" : "#d1d5db"}
        fontFamily="monospace"
      >
        {noteName}
      </text>
    </g>
  );
}

function FretboardBase({ numFrets }: { numFrets: number }) {
  return (
    <g>
      <rect
        x={LEFT}
        y={TOP - 4}
        width={numFrets * FRET_W}
        height={(NUM_STRINGS - 1) * STRING_H + 8}
        fill="#3a2e22"
        stroke="#1f1812"
        strokeWidth={1}
      />
      <rect
        x={LEFT - 4}
        y={TOP - 6}
        width={6}
        height={(NUM_STRINGS - 1) * STRING_H + 12}
        fill="#e5d5b8"
        stroke="#a89272"
        strokeWidth={1}
      />
      {Array.from({ length: numFrets }, (_, i) => i + 1).map((fret) => (
        <line
          key={`fret-${fret}`}
          x1={LEFT + fret * FRET_W}
          y1={TOP - 4}
          x2={LEFT + fret * FRET_W}
          y2={TOP + (NUM_STRINGS - 1) * STRING_H + 4}
          stroke="#9c8866"
          strokeWidth={2}
        />
      ))}
    </g>
  );
}

function Inlays({ numFrets }: { numFrets: number }) {
  const yMid = TOP + ((NUM_STRINGS - 1) * STRING_H) / 2;
  return (
    <g>
      {Array.from({ length: numFrets }, (_, i) => i + 1).map((fret) => {
        const cx = LEFT + (fret - 0.5) * FRET_W;
        if (INLAYS_DOUBLE.includes(fret)) {
          return (
            <g key={`inlay-${fret}`}>
              <circle cx={cx} cy={yMid - STRING_H} r={4} fill="#d4c5a9" opacity={0.55} />
              <circle cx={cx} cy={yMid + STRING_H} r={4} fill="#d4c5a9" opacity={0.55} />
            </g>
          );
        }
        if (INLAYS_SINGLE.includes(fret)) {
          return <circle key={`inlay-${fret}`} cx={cx} cy={yMid} r={4} fill="#d4c5a9" opacity={0.55} />;
        }
        return null;
      })}
    </g>
  );
}

function FretNumbers({ numFrets }: { numFrets: number }) {
  return (
    <g>
      {Array.from({ length: numFrets }, (_, i) => i + 1).map((fret) => (
        <text
          key={`num-${fret}`}
          x={LEFT + (fret - 0.5) * FRET_W}
          y={TOP - 12}
          textAnchor="middle"
          fontSize={11}
          fill={fret === 12 ? "#fbbf24" : "#9ca3af"}
          fontFamily="monospace"
        >
          {fret}
        </text>
      ))}
    </g>
  );
}

function Strings({ numFrets }: { numFrets: number }) {
  return (
    <g>
      {Array.from({ length: NUM_STRINGS }, (_, i) => {
        const y = TOP + i * STRING_H;
        const thickness = 1 + (NUM_STRINGS - 1 - i) * 0.35;
        return (
          <line
            key={`str-${i}`}
            x1={LEFT - OPEN_OFFSET - 4}
            y1={y}
            x2={LEFT + numFrets * FRET_W}
            y2={y}
            stroke="#d6d3d1"
            strokeWidth={thickness}
          />
        );
      })}
    </g>
  );
}

function StringLabels() {
  return (
    <g>
      {STRING_LABELS.map((label, i) => (
        <text
          key={`lbl-${i}`}
          x={6}
          y={TOP + i * STRING_H + 4}
          fontSize={11}
          fill="#9ca3af"
          fontFamily="monospace"
        >
          {label}
        </text>
      ))}
    </g>
  );
}

/** Position of a (stringIdx, fret) in SVG coordinates. */
function notePos(stringIdx: number, fret: number) {
  // Visual string row: stringIdx 0 = low E (bottom row), 5 = high E (top row).
  const row = NUM_STRINGS - 1 - stringIdx;
  const y = TOP + row * STRING_H;
  const x = fret === 0 ? LEFT - OPEN_OFFSET : LEFT + (fret - 0.5) * FRET_W;
  return { x, y };
}

function RootGhost({ stringIdx, fret }: { stringIdx: number; fret: number }) {
  const { x, y } = notePos(stringIdx, fret);
  return (
    <circle
      cx={x}
      cy={y}
      r={ROOT_R}
      fill="none"
      stroke={ROOT_FILL}
      strokeWidth={1.5}
      opacity={0.4}
    />
  );
}

function ShapeNotes({
  ts,
  multi,
  rootNote,
}: {
  ts: TransposedShape;
  multi: boolean;
  rootNote: string;
}) {
  const accent = SHAPE_COLORS[ts.shape.name];
  return (
    <g>
      {ts.frets.map((fret, stringIdx) => {
        if (fret === null) return null;
        const { x, y } = notePos(stringIdx, fret);
        const noteName = getNoteAtFret(stringIdx, fret);
        const isRoot = noteName === rootNote;

        let fill: string;
        let stroke: string;
        if (multi) {
          fill = accent.fill;
          stroke = isRoot ? "#fff" : accent.ring;
        } else {
          fill = isRoot ? ROOT_FILL : TONE_FILL;
          stroke = isRoot ? ROOT_STROKE : TONE_STROKE;
        }

        return (
          <g key={`note-${ts.shape.name}-${stringIdx}-${fret}`}>
            <circle
              cx={x}
              cy={y}
              r={DOT_R}
              fill={fill}
              stroke={stroke}
              strokeWidth={isRoot && multi ? 2.5 : 1.5}
            />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              fontSize={noteName.length > 1 ? 9 : 11}
              fontWeight="bold"
              fill="white"
              fontFamily="monospace"
            >
              {noteName}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function ShapeLabel({ ts }: { ts: TransposedShape }) {
  const x = LEFT + (ts.lowestFret - 0.5) * FRET_W;
  const y = TOP + (NUM_STRINGS - 1) * STRING_H + 16;
  const accent = SHAPE_COLORS[ts.shape.name];
  return (
    <g>
      <rect
        x={x - 10}
        y={y - 9}
        width={20}
        height={14}
        rx={4}
        fill={accent.fill}
        opacity={0.85}
      />
      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        fontSize={10}
        fontWeight="bold"
        fill="white"
        fontFamily="monospace"
      >
        {ts.shape.name}
      </text>
    </g>
  );
}
