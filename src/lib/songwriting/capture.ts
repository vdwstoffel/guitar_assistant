/**
 * Where the playing starts and stops: the first and last short windows whose
 * RMS comes within `thresholdDb` of the loudest one, padded by `padMs` and
 * kept inside the take. An empty or silent take is kept whole.
 */
export function detectSoundBounds(
  samples: Float32Array,
  sampleRate: number,
  opts: { windowMs?: number; thresholdDb?: number; padMs?: number } = {},
): { start: number; end: number } {
  const { windowMs = 10, thresholdDb = -40, padMs = 30 } = opts;
  const total = samples.length / sampleRate;
  const win = Math.max(1, Math.round((windowMs / 1000) * sampleRate));
  const count = Math.ceil(samples.length / win);
  const rms = new Float64Array(count);
  let loudest = 0;
  for (let w = 0; w < count; w++) {
    const from = w * win;
    const to = Math.min(samples.length, from + win);
    let sum = 0;
    for (let i = from; i < to; i++) sum += samples[i] * samples[i];
    rms[w] = Math.sqrt(sum / (to - from));
    if (rms[w] > loudest) loudest = rms[w];
  }
  if (loudest === 0) return { start: 0, end: total };

  const floor = loudest * Math.pow(10, thresholdDb / 20);
  let first = 0;
  while (rms[first] < floor) first++;
  let last = count - 1;
  while (rms[last] < floor) last--;

  const pad = padMs / 1000;
  return {
    start: Math.max(0, (first * win) / sampleRate - pad),
    end: Math.min(total, Math.min(samples.length, (last + 1) * win) / sampleRate + pad),
  };
}

/** The take as one channel (the average of its channels), always a fresh array. */
export function monoSamples(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0].slice();
  const out = new Float32Array(channels[0].length);
  for (const ch of channels) for (let i = 0; i < out.length; i++) out[i] += ch[i] / channels.length;
  return out;
}
