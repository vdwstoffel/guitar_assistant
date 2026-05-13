import { STANDARD_TUNING_INDICES, getNoteIndex, getNoteName } from "@/lib/musicTheory";

export type CagedShapeName = "C" | "A" | "G" | "E" | "D";

export interface CagedShape {
  name: CagedShapeName;
  /**
   * Frets per string in the open form, indexed 0..5 where 0 = low E (6th string),
   * 5 = high E (1st string). `null` means muted / not played as part of the shape.
   */
  openFrets: (number | null)[];
  /**
   * Suggested fingers for the barre (movable) form, same indexing as `openFrets`.
   * 1 = index, 2 = middle, 3 = ring, 4 = pinky. The barre finger is encoded as 1
   * across all strings on the barre fret. `null` = no finger / muted.
   */
  barreFingers: (number | null)[];
  /** String the shape's lowest root sits on (0 = low E, 1 = A, 2 = D, 3 = G, 4 = B, 5 = high E). */
  rootStringIdx: number;
  /** Fret of that lowest root in the open form — used as the transposition anchor. */
  rootFretInOpen: number;
}

export const CAGED_SHAPES: CagedShape[] = [
  {
    name: "C",
    openFrets: [null, 3, 2, 0, 1, 0],
    barreFingers: [null, 3, 2, null, 1, null],
    rootStringIdx: 1,
    rootFretInOpen: 3,
  },
  {
    name: "A",
    openFrets: [null, 0, 2, 2, 2, 0],
    barreFingers: [null, 1, 2, 3, 4, null],
    rootStringIdx: 1,
    rootFretInOpen: 0,
  },
  {
    name: "G",
    openFrets: [3, 2, 0, 0, 0, 3],
    barreFingers: [3, 2, null, null, null, 4],
    rootStringIdx: 0,
    rootFretInOpen: 3,
  },
  {
    name: "E",
    openFrets: [0, 2, 2, 1, 0, 0],
    barreFingers: [1, 3, 4, 2, 1, 1],
    rootStringIdx: 0,
    rootFretInOpen: 0,
  },
  {
    name: "D",
    openFrets: [null, null, 0, 2, 3, 2],
    barreFingers: [null, null, 1, 2, 4, 3],
    rootStringIdx: 2,
    rootFretInOpen: 0,
  },
];

export interface TransposedShape {
  shape: CagedShape;
  /** Absolute fret per string (null = muted). */
  frets: (number | null)[];
  /** Fret where the shape's lowest root note sits in this key. */
  rootFret: number;
  /** Lowest fret across all strings — useful for ordering shapes along the neck. */
  lowestFret: number;
  /** Highest fret across all strings. */
  highestFret: number;
}

/**
 * Transpose a CAGED shape into the given major key by sliding it so the shape's
 * lowest root sits on the target root note. Returns the shape with absolute
 * fret positions and bounds.
 *
 * The shape is placed at the lowest fret position whose root fret is >= the
 * shape's open root fret, so shapes never wrap below the nut.
 */
export function transposeShape(shape: CagedShape, rootNote: string): TransposedShape {
  const rootIdx = getNoteIndex(rootNote);
  const stringOpenIdx = STANDARD_TUNING_INDICES[shape.rootStringIdx];

  let targetFret = (rootIdx - stringOpenIdx + 12) % 12;
  if (targetFret < shape.rootFretInOpen) {
    targetFret += 12;
  }

  const delta = targetFret - shape.rootFretInOpen;
  const frets = shape.openFrets.map((f) => (f === null ? null : f + delta));

  const playedFrets = frets.filter((f): f is number => f !== null);
  const lowestFret = playedFrets.length > 0 ? Math.min(...playedFrets) : 0;
  const highestFret = playedFrets.length > 0 ? Math.max(...playedFrets) : 0;

  return { shape, frets, rootFret: targetFret, lowestFret, highestFret };
}

/**
 * Transpose all 5 CAGED shapes into the given key, ordered by ascending fret
 * position so they tile up the neck (the way you'd actually navigate them).
 */
export function transposeAllShapes(rootNote: string): TransposedShape[] {
  return CAGED_SHAPES.map((s) => transposeShape(s, rootNote)).sort(
    (a, b) => a.lowestFret - b.lowestFret,
  );
}

/**
 * Find every fret on every string (within `numFrets`) that produces the given
 * note name. Used to dim-highlight all root locations on the visualization.
 */
export function findAllRootPositions(
  rootNote: string,
  numFrets: number,
): { stringIdx: number; fret: number }[] {
  const positions: { stringIdx: number; fret: number }[] = [];
  for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
    for (let fret = 0; fret <= numFrets; fret++) {
      if (getNoteName(STANDARD_TUNING_INDICES[stringIdx] + fret) === rootNote) {
        positions.push({ stringIdx, fret });
      }
    }
  }
  return positions;
}

/** Stable per-shape accent color for multi-shape views (Tailwind hex equivalents). */
export const SHAPE_COLORS: Record<CagedShapeName, { fill: string; ring: string }> = {
  C: { fill: "#f43f5e", ring: "#be123c" }, // rose
  A: { fill: "#f59e0b", ring: "#b45309" }, // amber
  G: { fill: "#10b981", ring: "#047857" }, // emerald
  E: { fill: "#0ea5e9", ring: "#0369a1" }, // sky
  D: { fill: "#8b5cf6", ring: "#6d28d9" }, // violet
};
