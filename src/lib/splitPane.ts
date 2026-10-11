/**
 * Where the divider sits between the two halves of the Jam Tracks practice
 * view: the recording on the left, the score on the right.
 *
 * Stored as a fraction of the container rather than a pixel width. The two
 * panes share the whole window, so a fraction keeps the balance you chose
 * when the window itself changes size — a pixel width would quietly hand
 * every pixel of a widened window to one side. (The tab editor's dock in
 * TrackTabsModal stores pixels instead, which is right for a fixed-width
 * panel floating over a page.)
 *
 * Kept in localStorage rather than on the jam track in the database: it is a
 * property of how you are working right now, not of the song, and it should
 * not differ between one track and the next.
 */

/** An even split, which is where the view sat before the divider existed. */
export const DEFAULT_SPLIT = 0.5;

/**
 * The divider stops short of either edge. Left of MIN the transport controls
 * and marker buttons start wrapping into an unusable stack; right of MAX
 * there is not enough width left to lay a staff out on.
 */
export const MIN_SPLIT = 0.25;
export const MAX_SPLIT = 0.75;

const KEY = "jamTracksSplit";

/** A container's horizontal extent — the part of a DOMRect that matters here. */
export interface SplitBounds {
  left: number;
  width: number;
}

export function clampSplit(fraction: unknown): number {
  const n = Number(fraction);
  // Covers NaN and both infinities, and `Number(null)` is 0 rather than NaN,
  // so null has to be rejected before the conversion can rescue it.
  if (fraction === null || fraction === undefined || !Number.isFinite(n)) {
    return DEFAULT_SPLIT;
  }
  return Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, n));
}

/**
 * The split a pointer at `clientX` is asking for, measured against the
 * container the two panes live in.
 */
export function splitFromPointer(clientX: number, bounds: SplitBounds): number {
  // A container that has not been laid out yet measures zero wide; dividing
  // by that gives NaN, and clampSplit would send the divider back to even
  // anyway. Said explicitly so the intent survives a refactor.
  if (!(bounds.width > 0)) return DEFAULT_SPLIT;
  return clampSplit((clientX - bounds.left) / bounds.width);
}

/*
 * Both accessors are wrapped. localStorage throws in a private window and
 * with site data blocked, and on the server it is not defined at all — which
 * throws a ReferenceError rather than returning undefined. An even split is
 * perfectly usable, so none of that is worth reporting.
 */

export function loadSplit(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return DEFAULT_SPLIT;
    return clampSplit(raw);
  } catch {
    return DEFAULT_SPLIT;
  }
}

export function saveSplit(fraction: number): void {
  try {
    localStorage.setItem(KEY, String(clampSplit(fraction)));
  } catch {
    /* the balance just will not survive a reload */
  }
}
