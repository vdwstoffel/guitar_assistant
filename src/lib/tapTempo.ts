/**
 * Tap tempo detection utility
 * Calculates BPM from tap intervals
 */

const MAX_TAPS = 8;
const RESET_TIMEOUT_MS = 2000;

export interface TapTempo {
  tap: () => number | null;
  getBpm: () => number | null;
  reset: () => void;
  getTapCount: () => number;
}

/**
 * Create a tap tempo detector instance
 */
export function createTapTempo(): TapTempo {
  let timestamps: number[] = [];
  let lastTapTime = 0;

  function tap(): number | null {
    const now = performance.now();

    // Reset if too much time has passed since last tap
    if (now - lastTapTime > RESET_TIMEOUT_MS && timestamps.length > 0) {
      timestamps = [];
    }

    lastTapTime = now;
    timestamps.push(now);

    // Keep only the last MAX_TAPS timestamps
    if (timestamps.length > MAX_TAPS) {
      timestamps.shift();
    }

    return getBpm();
  }

  function getBpm(): number | null {
    // Need at least 2 taps to calculate BPM
    if (timestamps.length < 2) {
      return null;
    }

    // Calculate intervals between consecutive taps
    const intervals: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    // Calculate average interval
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    // Convert to BPM (60000 ms per minute)
    const bpm = Math.round(60000 / avgInterval);

    // Clamp to reasonable BPM range
    if (bpm < 20 || bpm > 300) {
      return null;
    }

    return bpm;
  }

  function reset(): void {
    timestamps = [];
    lastTapTime = 0;
  }

  function getTapCount(): number {
    return timestamps.length;
  }

  return {
    tap,
    getBpm,
    reset,
    getTapCount,
  };
}
