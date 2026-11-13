/**
 * The click heard while recording a riff: one bar counted in, then a click
 * on every beat until Stop. Scheduled ahead on an audio context's clock, so
 * it stays even however busy the page is.
 */

/** Seconds between clicks: one per beat of the time signature's bottom number; `tempo` counts quarter notes. */
export function clickSeconds(tempo: number, tsDen: number): number {
  return ((4 / tsDen) * 60) / tempo;
}

/** The clicks from beat `from` (0 at `t0`) that fall before `until`; each bar's first is accented. */
export function clicksUntil(
  t0: number,
  beatSeconds: number,
  tsNum: number,
  from: number,
  until: number,
): { beat: number; time: number; accent: boolean }[] {
  const out: { beat: number; time: number; accent: boolean }[] = [];
  for (let beat = from; t0 + beat * beatSeconds < until; beat++) {
    out.push({ beat, time: t0 + beat * beatSeconds, accent: beat % tsNum === 0 });
  }
  return out;
}

/** The count-in number showing at `now` (1 to `tsNum`), or null before it starts and once it is over. */
export function countInAt(now: number, t0: number, beatSeconds: number, tsNum: number): number | null {
  if (now < t0) return null;
  const beat = Math.floor((now - t0) / beatSeconds);
  return beat < tsNum ? beat + 1 : null;
}

/** How far ahead of the clock clicks are scheduled, in seconds, and how often. */
const LOOKAHEAD = 0.5;
const SCHEDULE_MS = 100;

function scheduleClick(ctx: AudioContext, out: AudioNode, time: number, accent: boolean) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = accent ? 1000 : 800;
  gain.gain.setValueAtTime(accent ? 0.6 : 0.35, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  osc.connect(gain).connect(out);
  osc.start(time);
  osc.stop(time + 0.05);
}

/**
 * Start clicking on `ctx` a moment from now: `tsNum` beats of count-in, then
 * on until stopped. Returns when the first click sounds (on `ctx`'s clock,
 * for the count-in display) and the function that stops it.
 */
export function startClickTrack(
  ctx: AudioContext,
  { tempo, tsNum, tsDen }: { tempo: number; tsNum: number; tsDen: number },
): { t0: number; beatSeconds: number; stop: () => void } {
  void ctx.resume().catch(() => {});
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const beatSeconds = clickSeconds(tempo, tsDen);
  const t0 = ctx.currentTime + 0.1;
  let next = 0;
  const schedule = () => {
    const now = ctx.currentTime;
    for (const c of clicksUntil(t0, beatSeconds, tsNum, next, now + LOOKAHEAD)) {
      // A timer throttled in a background tab skips the clicks it missed rather than bursting them.
      if (c.time >= now) scheduleClick(ctx, out, c.time, c.accent);
      next = c.beat + 1;
    }
  };
  schedule();
  const timer = window.setInterval(schedule, SCHEDULE_MS);
  return {
    t0,
    beatSeconds,
    stop: () => {
      window.clearInterval(timer);
      out.disconnect(); // also silences the clicks already scheduled
    },
  };
}
