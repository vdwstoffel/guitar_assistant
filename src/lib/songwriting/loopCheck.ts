/** The shortest stretch of a take that can be looped (or saved), in seconds. */
export const MIN_LOOP_SECONDS = 0.1;

/**
 * Where in the take (seconds) a loop of `trim` that started at `t0` from
 * `from` (the trim start, or where it was paused) is at `now`, wrapping at
 * the trim's end back to its start.
 */
export function loopPosition(now: number, t0: number, trim: { start: number; end: number }, from = trim.start): number {
  if (now <= t0) return from;
  return trim.start + ((from - trim.start + (now - t0)) % (trim.end - trim.start));
}

/**
 * The loop check: `start…end` of the take on repeat, seamlessly, so a hiccup
 * heard at the join is an edge being off; it starts at `from` (where it was
 * paused) when that is inside the trim. Returns when and where it starts (on
 * `ctx`'s clock, for the playhead) and the function that stops it; null when
 * the stretch is too short to loop.
 */
export function startLoopCheck(
  ctx: AudioContext,
  buffer: AudioBuffer,
  trim: { start: number; end: number },
  from: number = trim.start,
): { t0: number; from: number; stop: () => void } | null {
  const length = trim.end - trim.start;
  if (!(length >= MIN_LOOP_SECONDS)) return null;
  void ctx.resume().catch(() => {});
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.loopStart = trim.start;
  source.loopEnd = trim.end;
  source.connect(ctx.destination);
  const at = from >= trim.start && from < trim.end ? from : trim.start;
  const t0 = ctx.currentTime + 0.05;
  source.start(t0, at);

  return {
    t0,
    from: at,
    stop: () => {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      source.disconnect();
    },
  };
}
