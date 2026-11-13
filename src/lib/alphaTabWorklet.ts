/**
 * Loading alphaTab's AudioWorklet module once per audio context.
 *
 * alphaTab 1.8.1's worklet output starts its audio source only after the
 * worklet factory's promise settles (`AlphaSynthAudioWorkletOutput.play`), but
 * stops it synchronously on pause. A pause that arrives before that promise
 * has settled calls `stop()` on a source that never started and throws
 * `InvalidStateError` — and the factory runs on every play, so a fresh
 * `addModule` per play leaves that window open every time playback starts.
 *
 * With one cached promise per context, loaded before the first play, every
 * play's continuation is a microtask on an already-settled promise: it runs
 * before the next message from the synth worker can deliver a pause, so the
 * source is always started by the time anything can stop it.
 */

export const ALPHATAB_WORKLET_URL = "/alphaTab.worklet.mjs";

/** The slice of an audio context this needs, so tests can stand in for one. */
export interface WorkletContext {
  audioWorklet: { addModule(url: string): Promise<void> };
}

const loads = new WeakMap<WorkletContext, Promise<void>>();

/** The worklet factory for `Environment.initializeMain`: one `addModule` per context, ever. */
export function loadAlphaTabWorklet(ctx: WorkletContext, url: string = ALPHATAB_WORKLET_URL): Promise<void> {
  let load = loads.get(ctx);
  if (!load) {
    load = ctx.audioWorklet.addModule(url);
    loads.set(ctx, load);
  }
  return load;
}

/**
 * Whether `promise` resolves within `ms`: false for a rejection or a timeout.
 * A worklet module that never loads (seen in headless Chromium, where even an
 * empty processor never registers) would otherwise leave Play waiting forever.
 */
export function settlesWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    promise.then(
      () => {
        clearTimeout(timer);
        resolve(true);
      },
      () => {
        clearTimeout(timer);
        resolve(false);
      },
    );
  });
}
