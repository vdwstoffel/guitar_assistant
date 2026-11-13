"use client";

/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab's api and model types are only reachable through namespaces that
 * cannot be imported as types across the bundle boundary (as in
 * useAlphaTabPlayback). These `any`s are that interop boundary.
 */
import type { PlaybackHandle } from "@/components/gp/useAlphaTabPlayback";
import { loadAlphaTabWorklet, settlesWithin } from "@/lib/alphaTabWorklet";
import { getSoundBankPreference, soundBankById, subscribeToSoundBankChanges } from "@/lib/soundBank";
import { createCoalescer } from "@/lib/songwriting/coalesce";
import { createSessionTransport } from "@/lib/songwriting/sessionTransport";

/** alphaTab's synth.PlayerState.Playing. */
const PLAYING = 1;
/** How long changes made while playing are held, so a burst of them is one reload. */
const COALESCE_MS = 200;
/** How long the AudioWorklet module may take to load before falling back to ScriptProcessor. */
const WORKLET_TIMEOUT_MS = 6000;

/**
 * Where a hidden player's alphaTab lives: laid out (it has to be, to render —
 * display:none would not play) but off-screen, and out of the flex flow. Off
 * to the left and 1px tall with its overflow clipped, so however long the
 * score grows it never adds a scrollbar. The width stays: alphaTab lays the
 * score out to it.
 */
export const HIDDEN_PLAYER_STYLE = { position: "absolute", top: 0, left: -10000, width: 800, height: 1, overflow: "hidden" } as const;

export interface HiddenScorePlayerOptions<T> {
  container: HTMLElement;
  /** Output device routing, looping and volume (useAlphaTabPlayback). */
  playback: PlaybackHandle;
  /** The newest score, for a freshly built api (or a stop that drops a held change) to load. */
  latest(): T;
  texOf(item: T): string;
  /** What Play waits for besides the synth (e.g. decoded recordings). Default: nothing. */
  canPlay?(): boolean;
  /** How many 100 ms readiness checks a start or resume may wait. Default 50. */
  maxPolls?: number;
  /** For console warnings: "session", "riff". */
  name: string;
  /** The synth has a sound bank, a score and a working output. */
  onReady(ready: boolean): void;
  /**
   * alphaTab's playerReady (its readyForPlayback): after every score's midi
   * and every sound bank is in. alphaTab's own handler for it, subscribed
   * first, has just reset the rendered track's volume to the score's.
   */
  onPlayerReady?(): void;
  /** alphaTab says it is playing (or not). */
  onPlaying(playing: boolean): void;
  /** A start or resume is underway (sessionTransport's `pending`). */
  onPending(pending: boolean): void;
  /** A score is in; `item` is what it was built from. Fired inside `api.tex`, before its midi reaches the synth. */
  onScoreLoaded?(score: any, item: T): void;
  /** alphaTab's playerPositionChanged. */
  onPosition?(e: any): void;
  /**
   * alphaTab's playerFinished (fired at every wrap while looping). Not
   * looping, the player counts as stopped from here: a `changed` made in
   * this callback (or after) loads at once, and a `start` plays it.
   */
  onFinished?(): void;
  /**
   * alphaTab reported an error. `whileLoading`: the newest score has not come
   * in since it was handed over, so it is most likely that score's fault.
   */
  onError?(error: unknown, whileLoading: boolean): void;
}

export interface HiddenScorePlayer<T> {
  /** The live alphaTab api; null before it is built and after dispose. */
  readonly api: any;
  /** alphaTab says it is playing. */
  readonly playing: boolean;
  /** A start or resume is underway. */
  readonly pending: boolean;
  /** What the score the api holds was built from. */
  readonly loaded: T | null;
  /** A new score: loaded at once while stopped; while playing, a burst is coalesced into one reload that carries on playing. */
  changed(item: T): void;
  /** Play now, or as soon as the player (and `canPlay`) is ready. */
  start(): void;
  /**
   * Stop, dropping any pending start; a change held back while playing loads
   * now, without resuming. Stopped from this call on: a `changed` and `start`
   * right after it load and play the new score.
   */
  stop(): void;
  dispose(): void;
}

/**
 * One hidden alphaTab instance that plays generated scores: the engine under
 * Play riff and Play song.
 *
 * - The worklet output's module is loaded before the first play (see
 *   alphaTabWorklet.ts); one that never loads (headless Chromium) or fails
 *   falls back to the ScriptProcessor output after WORKLET_TIMEOUT_MS, before
 *   Play was ever enabled.
 * - The user's sound bank at creation, swapped live after.
 * - A score changed while playing reloads and carries on (sessionTransport
 *   times the resume; coalesce.ts makes a burst of changes one reload).
 * - Never `api.midiLoaded`: it recurses forever in 1.8.1's worker player.
 */
export function createHiddenScorePlayer<T>(opts: HiddenScorePlayerOptions<T>): HiddenScorePlayer<T> {
  const { container, playback } = opts;
  let destroyed = false;
  let alphaTab: any = null;
  let api: any = null;
  let detachPlayback: (() => void) | null = null;
  let isPlayingNow = false;
  let loadingItem: T | null = null;
  let loadedItem: T | null = null;

  const transport = createSessionTransport({
    isReady: () => !!api?.isReadyForPlayback && (opts.canPlay?.() ?? true),
    play: () => {
      try {
        api?.play();
      } catch {
        /* mid-teardown */
      }
    },
    onPendingChange: (p) => {
      if (!destroyed) opts.onPending(p);
    },
    maxPolls: opts.maxPolls,
  });

  // --- Sound bank: the user's preference at creation, swapped live after.
  // `requested` is the bank last asked of the synth (at creation, or the
  // newest swap); `held` the last one whose bytes it was actually handed.
  // alphaTab's own fetch of the starting bank must report (soundFontLoaded)
  // before a swap may hand it bytes, or the two loads race and the old bank
  // can win.
  let wantedBank = soundBankById(getSoundBankPreference()).url;
  let requestedBank = wantedBank;
  let heldBank = wantedBank;
  let initialBankLoaded = false;
  let swapId = 0;

  const swapBank = (url: string) => {
    const id = ++swapId;
    void fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        // Only the newest swap may land: picks outrun a 14 MB download.
        if (destroyed || !api || id !== swapId) return;
        // loadSoundFont pauses the synth. Its worker handles messages in
        // order, so a play posted after this one runs once the bank is in.
        transport.reload(isPlayingNow);
        api.loadSoundFont(bytes, false);
        heldBank = url;
        transport.kick();
      })
      .catch((err) => {
        if (destroyed || id !== swapId) return;
        // The old bank is still loaded; let a later pick of this one retry.
        requestedBank = heldBank;
        console.warn("Could not load the selected sound bank", err);
      });
  };
  const syncBank = () => {
    if (destroyed || !api || !initialBankLoaded || wantedBank === requestedBank) return;
    requestedBank = wantedBank;
    swapBank(wantedBank);
  };
  const unsubscribeBank = subscribeToSoundBankChanges((id) => {
    wantedBank = soundBankById(id).url;
    syncBank();
  });

  // --- Loading a score. `resume`: carry on playing once it is in.
  const load = (item: T, resume: boolean) => {
    if (destroyed || !api) return;
    // Armed before api.tex: alphaTab generates the midi, and fires midiLoad,
    // synchronously inside it. Loading the midi stops the synth by itself.
    transport.reload(resume);
    loadingItem = item;
    try {
      api.tex(opts.texOf(item));
    } catch (e) {
      console.warn(`[songs] could not load the ${opts.name} score`, e);
      opts.onError?.(e, true);
      transport.kick();
    }
  };
  // Changes made while playing: only the newest of a burst is loaded.
  const coalescer = createCoalescer<T>(COALESCE_MS, (next) => load(next, isPlayingNow));

  const teardown = () => {
    detachPlayback?.();
    detachPlayback = null;
    const old = api;
    api = null;
    if (old) {
      try {
        old.stop();
        old.destroy();
      } catch {
        /* ignore */
      }
    }
  };

  const build = (scriptProcessor: boolean) => {
    const { AlphaTabApi, Settings } = alphaTab;
    const settings = new Settings();
    settings.core.fontDirectory = "/font/";
    settings.player.playerMode = alphaTab.PlayerMode.EnabledSynthesizer;
    requestedBank = heldBank = wantedBank;
    initialBankLoaded = false;
    swapId++; // a swap still downloading was for the api being replaced
    settings.player.soundFont = requestedBank;
    // Nothing on screen follows the playhead. Above all no auto-scroll:
    // alphaTab would scroll the page toward its off-screen cursor.
    settings.player.enableCursor = false;
    settings.player.scrollMode = alphaTab.ScrollMode.Off;
    settings.player.enableUserInteraction = false;
    // Plain http on the LAN is not a secure context: no AudioWorklet there.
    const useWorklet = !scriptProcessor && window.isSecureContext && "AudioWorkletNode" in window;
    if (!useWorklet) settings.player.outputMode = alphaTab.PlayerOutputMode.WebAudioScriptProcessor;

    const self = new AlphaTabApi(container, settings);
    api = self;
    loadedItem = null;
    // Handlers of an api that has since been replaced (see the fallback
    // below) or destroyed must do nothing.
    const live = () => !destroyed && api === self;
    let playerReady = false;
    let outputReady = !useWorklet;
    const updateReady = () => {
      if (live()) opts.onReady(playerReady && outputReady);
    };

    // Applies looping and the master volume, and routes the output device.
    detachPlayback = playback.attach(self, alphaTab);

    self.playerReady.on(() => {
      if (!live()) return;
      playerReady = true;
      updateReady();
      opts.onPlayerReady?.();
    });

    self.playerStateChanged.on((e: any) => {
      if (!live()) return;
      isPlayingNow = e?.state === PLAYING;
      opts.onPlaying(isPlayingNow);
      if (isPlayingNow) transport.confirmPlaying();
    });

    // Fired synchronously by api.tex, before the midi is posted to the synth
    // worker; the transport's first readiness check is a poll later, so the
    // play lands behind the load. Never api.midiLoaded: it recurses forever
    // in 1.8.1's worker player.
    self.midiLoad.on(() => {
      if (live()) transport.kick();
    });

    self.scoreLoaded.on((score: any) => {
      if (!live()) return;
      loadedItem = loadingItem;
      if (loadedItem !== null) opts.onScoreLoaded?.(score, loadedItem);
    });

    self.playerPositionChanged.on((e: any) => {
      if (live()) opts.onPosition?.(e);
    });

    self.playerFinished.on(() => {
      if (!live()) return;
      // Not looping, alphaSynth stops right after it says it finished (its
      // worker posts `finished`, then stops and posts Paused). Count it as
      // stopped now: a score handed over from onFinished then loads at once
      // and its play queues behind that stop, instead of being held as a
      // change made while playing (coalesced) while the play restarts the
      // old score.
      if (!self.isLooping) isPlayingNow = false;
      opts.onFinished?.();
    });

    self.soundFontLoaded.on(() => {
      if (!live()) return;
      initialBankLoaded = true;
      // A pick made while the starting bank was still downloading.
      syncBank();
    });

    self.error.on((e: any) => {
      if (!live()) return;
      console.warn(`[songs] ${opts.name} player error`, e?.error || e?.innerError || e);
      opts.onError?.(e, loadingItem !== loadedItem);
      // A reload that failed before its midiLoad would leave its resume armed.
      transport.kick();
    });

    // The worklet output's module, loaded into the output's own context
    // before the first play: see alphaTabWorklet.ts for why that closes the
    // play/pause race. Play waits for it. A module that never loads (headless
    // Chromium) or fails falls back to the ScriptProcessor output, which
    // starts synchronously; this happens before Play was ever enabled.
    const ctx = self.player?.output?.context;
    if (useWorklet && ctx?.audioWorklet) {
      void settlesWithin(loadAlphaTabWorklet(ctx), WORKLET_TIMEOUT_MS).then((loaded) => {
        if (!live()) return;
        if (loaded) {
          outputReady = true;
          updateReady();
          return;
        }
        console.warn("[songs] the AudioWorklet output did not load; falling back to ScriptProcessor");
        transport.cancel();
        coalescer.cancel();
        isPlayingNow = false;
        opts.onPlaying(false);
        teardown();
        build(true);
      });
    } else {
      outputReady = true;
    }

    load(opts.latest(), false);
  };

  const stop = () => {
    const held = coalescer.pending;
    coalescer.cancel();
    transport.cancel();
    // Stopped as of now, not when the synth's Paused comes back: the worker
    // handles messages in order, so a score loaded and played next lands
    // after this stop (and must not be held back as a change while playing).
    isPlayingNow = false;
    try {
      api?.stop();
    } catch {
      /* ignore */
    }
    // A change held back while playing loads now, without resuming.
    if (held) load(opts.latest(), false);
  };

  const init = async () => {
    const mod = await import("@coderline/alphatab");
    if (destroyed) return;
    alphaTab = mod;
    // Worker/worklet URLs must be explicit — alphaTab otherwise
    // auto-detects from import.meta.url, which points at the bundled chunk.
    if (!mod.Environment.isRunningInWorker) {
      mod.Environment.initializeMain(
        () => new Worker("/alphaTab.worker.mjs", { type: "module" }),
        (audioContext: AudioContext) => loadAlphaTabWorklet(audioContext),
      );
    }
    build(false);
  };

  init().catch((err) => {
    if (!destroyed) console.warn(`[songs] could not start the ${opts.name} player`, err);
  });

  return {
    get api() {
      return api;
    },
    get playing() {
      return isPlayingNow;
    },
    get pending() {
      return transport.pending;
    },
    get loaded() {
      return loadedItem;
    },
    changed(item: T) {
      if (!api) return; // build() loads latest()
      if (isPlayingNow || transport.pending) {
        coalescer.push(item);
      } else {
        coalescer.cancel();
        load(item, false);
      }
    },
    start() {
      if (!api) return;
      transport.start();
    },
    stop,
    dispose() {
      destroyed = true;
      transport.dispose();
      coalescer.cancel();
      unsubscribeBank();
      teardown();
    },
  };
}
