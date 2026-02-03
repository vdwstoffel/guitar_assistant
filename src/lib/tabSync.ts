import { TabSyncPoint } from "@/types";

/**
 * Interpolate the tab tick position based on current audio time and sync points.
 * Returns null if no sync points are available.
 */
export function interpolateTickPosition(
  audioTime: number,
  syncPoints: TabSyncPoint[]
): number | null {
  if (syncPoints.length === 0) return null;

  // Sort by audio time (should already be sorted, but ensure)
  const sorted = [...syncPoints].sort((a, b) => a.audioTime - b.audioTime);

  // Before first sync point: extrapolate backwards or clamp to first tick
  if (audioTime <= sorted[0].audioTime) {
    if (sorted.length === 1) {
      return sorted[0].tabTick;
    }
    // Extrapolate backwards using the rate from first two points
    const rate =
      (sorted[1].tabTick - sorted[0].tabTick) /
      (sorted[1].audioTime - sorted[0].audioTime);
    const extrapolated =
      sorted[0].tabTick + rate * (audioTime - sorted[0].audioTime);
    return Math.max(0, extrapolated);
  }

  // After last sync point: extrapolate forwards
  if (audioTime >= sorted[sorted.length - 1].audioTime) {
    if (sorted.length === 1) {
      return sorted[0].tabTick;
    }
    // Extrapolate using rate from last two points
    const last = sorted[sorted.length - 1];
    const secondLast = sorted[sorted.length - 2];
    const rate =
      (last.tabTick - secondLast.tabTick) /
      (last.audioTime - secondLast.audioTime);
    return last.tabTick + rate * (audioTime - last.audioTime);
  }

  // Find bracketing sync points and interpolate
  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i];
    const p2 = sorted[i + 1];

    if (audioTime >= p1.audioTime && audioTime <= p2.audioTime) {
      const progress =
        (audioTime - p1.audioTime) / (p2.audioTime - p1.audioTime);
      return p1.tabTick + progress * (p2.tabTick - p1.tabTick);
    }
  }

  return null;
}

/**
 * Interpolate the audio time based on a tab tick position and sync points.
 * Used for seeking when user clicks on notation.
 * Returns null if no sync points are available.
 */
export function interpolateAudioTime(
  tabTick: number,
  syncPoints: TabSyncPoint[]
): number | null {
  if (syncPoints.length === 0) return null;

  // Sort by tab tick
  const sorted = [...syncPoints].sort((a, b) => a.tabTick - b.tabTick);

  // Before first sync point tick
  if (tabTick <= sorted[0].tabTick) {
    if (sorted.length === 1) {
      return sorted[0].audioTime;
    }
    // Extrapolate backwards
    const rate =
      (sorted[1].audioTime - sorted[0].audioTime) /
      (sorted[1].tabTick - sorted[0].tabTick);
    const extrapolated =
      sorted[0].audioTime + rate * (tabTick - sorted[0].tabTick);
    return Math.max(0, extrapolated);
  }

  // After last sync point tick
  if (tabTick >= sorted[sorted.length - 1].tabTick) {
    if (sorted.length === 1) {
      return sorted[0].audioTime;
    }
    // Extrapolate forwards
    const last = sorted[sorted.length - 1];
    const secondLast = sorted[sorted.length - 2];
    const rate =
      (last.audioTime - secondLast.audioTime) /
      (last.tabTick - secondLast.tabTick);
    return last.audioTime + rate * (tabTick - last.tabTick);
  }

  // Find bracketing sync points and interpolate
  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i];
    const p2 = sorted[i + 1];

    if (tabTick >= p1.tabTick && tabTick <= p2.tabTick) {
      const progress = (tabTick - p1.tabTick) / (p2.tabTick - p1.tabTick);
      return p1.audioTime + progress * (p2.audioTime - p1.audioTime);
    }
  }

  return null;
}

/**
 * Format a bar index for display (1-indexed for users)
 */
export function formatBarIndex(barIndex: number | null): string {
  if (barIndex === null) return "—";
  return `Bar ${barIndex + 1}`;
}

/**
 * Format audio time as mm:ss.ms
 */
export function formatSyncTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(2).padStart(5, "0")}`;
}
