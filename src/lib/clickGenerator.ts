/**
 * Web Audio API click sound generation for count-in
 */

export interface CountInOptions {
  bpm: number;
  timeSignature: string;
  volume?: number; // 0-100
  onBeat?: (beatNumber: number, totalBeats: number) => void;
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}

/**
 * Parse time signature string to get beats per bar
 */
function getBeatsPerBar(timeSignature: string): number {
  const [numerator] = timeSignature.split("/").map(Number);
  return numerator || 4;
}

/**
 * Play a single click sound at the specified time
 */
export function playClick(
  time: number,
  options: { isAccent?: boolean; volume?: number } = {}
): void {
  const ctx = getAudioContext();
  const { isAccent = false, volume = 100 } = options;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  const vol = volume / 100;
  const gainValue = (isAccent ? 2.0 : 1.4) * vol;

  osc.frequency.value = isAccent ? 1000 : 800;
  gain.gain.setValueAtTime(gainValue, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

  osc.start(time);
  osc.stop(time + 0.05);
}

/**
 * Play a count-in sequence (one full bar) and return a promise that resolves when complete
 */
export function playCountIn(options: CountInOptions): Promise<void> {
  const { bpm, timeSignature, volume = 100, onBeat } = options;

  if (bpm <= 0) {
    return Promise.resolve();
  }

  const beats = getBeatsPerBar(timeSignature);
  if (beats <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const ctx = getAudioContext();
    const secondsPerBeat = 60 / bpm;
    const startTime = ctx.currentTime;

    // Schedule all clicks ahead of time for precise timing
    for (let i = 0; i < beats; i++) {
      const beatTime = startTime + i * secondsPerBeat;
      const isAccent = i === 0; // First beat is accented
      playClick(beatTime, { isAccent, volume });

      // Schedule beat callback (approximate, for UI updates)
      if (onBeat) {
        const delay = (beatTime - ctx.currentTime) * 1000;
        setTimeout(() => onBeat(i + 1, beats), Math.max(0, delay));
      }
    }

    // Schedule completion callback
    const totalDuration = beats * secondsPerBeat * 1000;
    setTimeout(() => {
      resolve();
    }, totalDuration);
  });
}

/**
 * Get the duration of a count-in in milliseconds
 */
export function getCountInDuration(bpm: number, timeSignature: string): number {
  if (bpm <= 0) return 0;
  const beats = getBeatsPerBar(timeSignature);
  return (beats * 60 * 1000) / bpm;
}
