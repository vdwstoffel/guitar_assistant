/* eslint-disable @typescript-eslint/no-explicit-any --
 * The note preview drives alphaTab's own worker synth directly. Three of the
 * classes it needs (AlphaSynthWebWorkerApi and the two Web Audio outputs) are
 * runtime exports marked @internal and absent from alphaTab.d.ts in 1.8.1, so
 * the members used are declared locally below; everything else is the same
 * `any` interop boundary as the rest of the editor.
 */
import {
  getAudioSinkPreference,
  routeAlphaTabOutput,
  shouldApplySink,
  subscribeToAudioSinkChanges,
} from "@/lib/audioSink";

/** Plays one beat of a tab, separately from the score's own player. */
export interface PreviewSynth {
  play(beat: any): void;
  stop(): void;
  /** 0-1, alphaTab's unit. Stored; applied by the next `play`. */
  setVolume(volume: number): void;
  /**
   * Swap the sound bank this preview sounds with — the same picker the score
   * uses, so a preview and the song it sits beside never sound different.
   * Keeps the current bank until the new one is in hand; a bank that cannot
   * be fetched leaves the preview on the old one.
   */
  setSoundFontUrl(url: string): void;
  destroy(): void;
}

export interface PreviewSynthOptions {
  /** The score player's output (`api.player.output`), to use the same output class. */
  scoreOutput: unknown;
  /** The score api's settings, which the one-beat MIDI is generated with. */
  mainSettings: unknown;
  soundFontUrl: string;
  /** The AudioWorklet module the score's initializeMain factory loads. */
  workletUrl: string;
  volume: number;
}

/** The members of alphaTab's internal worker synth this file uses. */
interface WorkerSynth {
  masterVolume: number;
  playbackSpeed: number;
  metronomeVolume: number;
  countInVolume: number;
  isLooping: boolean;
  loadSoundFont(data: Uint8Array, append: boolean): void;
  loadMidiFile(midi: unknown): void;
  play(): boolean;
  stop(): void;
  destroy(): void;
  soundFontLoaded: { on(handler: () => void): void };
  soundFontLoadFailed: { on(handler: (error: unknown) => void): void };
}

/**
 * A second alphaTab synth, owned by the editor, that plays one beat at a time.
 *
 * Not alphaTab's own `api.playBeat`: in 1.8.1 that is silent (it loads the
 * one-beat file into a paused synth, which renders nothing) and, during
 * playback, pauses the song. A separate worker and AudioContext play beside
 * the score without touching its state, position, loop or events.
 *
 * Must be called after `Environment.initializeMain`: the synth creates its
 * worker, and its output its worklet nodes, through the factories it sets.
 *
 * Returns null when this alphaTab build lacks a class it relies on; previews
 * then never sound, and editing is unaffected.
 */
export function createPreviewSynth(alphaTab: any, opts: PreviewSynthOptions): PreviewSynth | null {
  const WorkerApi = alphaTab?.synth?.AlphaSynthWebWorkerApi;
  const WorkletOutput = alphaTab?.synth?.AlphaSynthAudioWorkletOutput;
  const ScriptOutput = alphaTab?.synth?.AlphaSynthScriptProcessorOutput;
  const MidiFile = alphaTab?.midi?.MidiFile;
  const MidiHandler = alphaTab?.midi?.AlphaSynthMidiFileHandler;
  const MidiGenerator = alphaTab?.midi?.MidiFileGenerator;
  const Settings = alphaTab?.Settings;
  const legato = alphaTab?.model?.SlideOutType?.Legato;
  const classes = [WorkerApi, WorkletOutput, ScriptOutput, MidiFile, MidiHandler, MidiGenerator, Settings];
  if (classes.some((cls) => typeof cls !== "function") || typeof legato !== "number") {
    console.warn("Note preview is off: this alphaTab build lacks the synth classes it needs.");
    return null;
  }

  let destroyed = false;
  let soundFontReady = false;
  let primed = false;
  let volume = opts.volume;
  // The bank currently loaded into this synth, and how many swaps are queued
  // ahead of it: a fetch can finish out of order, so only the newest request
  // may tell the synth what to load.
  let loadedUrl = opts.soundFontUrl;
  let soundFontRequestId = 0;
  let warned = false;
  const warnOnce = (message: string, error?: unknown) => {
    if (warned) return;
    warned = true;
    console.warn(message, error);
  };

  // Setup acquires an AudioContext (the output opens one as the synth is
  // created), a worker and a subscription, and any step can throw: a worker
  // that cannot start, a member a later alphaTab renamed, storage that cannot
  // be read. Uncaught, that would escape into ScoreCanvas's init() and stop
  // the tab from rendering. Previews must never get in the way of editing, so
  // a failure releases what was acquired and the editor goes without them.
  let output: any = null;
  let synth: WorkerSynth | null = null;
  let unsubscribeSink = () => {};

  // On the app-wide output device like the score: setSinkId on this synth's
  // own context when it is set up, whenever the preference changes, and before
  // each preview. Each pair is switched once: remembered as soon as the switch
  // starts, so repeats while it is in flight do nothing, and forgotten if it
  // fails (a headset that is not connected yet), so the next call retries it.
  let lastRoute: { output: unknown; pref: string } | null = null;
  const route = () => {
    if (destroyed) return;
    const pref = getAudioSinkPreference();
    if (!shouldApplySink(lastRoute, output, pref)) return;
    const attempt = { output, pref };
    lastRoute = attempt;
    void routeAlphaTabOutput(output, pref).then((applied) => {
      // Not if a newer switch has started since: lastRoute describes that one.
      if (!applied && lastRoute === attempt) lastRoute = null;
    });
  };

  // Fetch a bank and hand its bytes to the synth. The worker reads `.length`
  // off what it is given, so this needs bytes rather than a bare ArrayBuffer;
  // a bank the score has just fetched comes from the HTTP cache. `id` guards
  // the order: when the picker moves on mid-fetch, a superseded swap must not
  // land after the newer one, and only the newest request may report failure.
  const loadBank = (url: string) => {
    const id = ++soundFontRequestId;
    void fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (destroyed || id !== soundFontRequestId || !synth) return;
        loadedUrl = url;
        synth.loadSoundFont(bytes, false);
      })
      .catch((error) => {
        if (!destroyed && id === soundFontRequestId) {
          warnOnce("Note preview is off: its soundfont could not be fetched.", error);
        }
      });
  };

  try {
    // The same output class as the score's player. Without a score output to
    // copy, alphaTab's own rule: an AudioWorklet in a secure context, else a
    // ScriptProcessor.
    const useWorklet = opts.scoreOutput
      ? opts.scoreOutput instanceof WorkletOutput
      : typeof window !== "undefined" && window.isSecureContext === true && "AudioWorkletNode" in window;
    const settings = new Settings();
    output = useWorklet ? new WorkletOutput(settings) : new ScriptOutput();
    synth = new WorkerApi(output, settings) as WorkerSynth;
    synth.playbackSpeed = 1; // the written tempo, whatever the practice speed
    synth.metronomeVolume = 0;
    synth.countInVolume = 0;
    synth.isLooping = false;

    synth.soundFontLoaded.on(() => {
      if (!destroyed) soundFontReady = true;
    });
    synth.soundFontLoadFailed.on((error) => {
      if (!destroyed) warnOnce("Note preview is off: its soundfont failed to load.", error);
    });
    // The worker reads `.length` off what it is given, so it needs bytes rather
    // than a bare ArrayBuffer. The score has just fetched the same file, so this
    // comes from the HTTP cache.
    loadBank(opts.soundFontUrl);

    // The first worklet module load on a fresh AudioContext takes ~50 ms. Doing
    // it now, on the preview's own context, keeps it out of the first real
    // preview. Nothing is played, so nothing can sound when the editor opens.
    const context = output.context as AudioContext | null | undefined;
    const priming: Promise<unknown> =
      useWorklet && context?.audioWorklet
        ? context.audioWorklet.addModule(opts.workletUrl).catch(() => undefined)
        : Promise.resolve();
    void priming.then(() => {
      if (!destroyed) primed = true;
    });

    route();
    unsubscribeSink = subscribeToAudioSinkChanges(route);
  } catch (error) {
    destroyed = true;
    try {
      // Once the synth exists it owns the output: its destroy() has the worker
      // close the output's AudioContext. Destroying the output directly would
      // leave a worker that can still tell it to play, and the output's
      // activate() opens a new context when its own is gone.
      if (synth) synth.destroy();
      else output?.destroy?.();
    } catch {
      /* best effort */
    }
    unsubscribeSink();
    warnOnce("Note preview is off: it could not be set up.", error);
    return null;
  }

  /**
   * A one-beat MIDI file, made the way alphaTab's own `playBeat` makes it
   * (public/alphaTab.core.mjs:52745-52751). alphaTab skips the note-on for the
   * note a legato slide lands on, as it does for a tied note; but a slide
   * target is a fret that was typed, so the preview sounds it by hiding the
   * link for this one synchronous call. No render can see the model meanwhile.
   */
  const oneBeatMidi = (beat: any) => {
    const hidden: Array<{ note: any; origin: any }> = [];
    for (const note of beat.notes ?? []) {
      if (note.slideOrigin && note.slideOrigin.slideOutType === legato) {
        hidden.push({ note, origin: note.slideOrigin });
        note.slideOrigin = null;
      }
    }
    try {
      const midi = new MidiFile();
      const handler = new MidiHandler(midi);
      new MidiGenerator(beat.voice.bar.staff.track.score, opts.mainSettings, handler).generateSingleBeat(beat);
      return midi;
    } finally {
      for (const { note, origin } of hidden) note.slideOrigin = origin;
    }
  };

  let reportedFailure = false;

  return {
    play(beat) {
      if (destroyed || !soundFontReady || !primed || !beat) return;
      try {
        route(); // a no-op unless the last switch failed
        const midi = oneBeatMidi(beat);
        // Posted before the load, every time: worker messages are handled in
        // order, so each preview gets exactly the level it was asked with.
        synth.masterVolume = volume;
        synth.loadMidiFile(midi);
        synth.play();
      } catch (error) {
        if (!reportedFailure) {
          reportedFailure = true;
          console.warn("Note preview failed", error);
        }
      }
    },
    stop() {
      if (destroyed || !soundFontReady || !primed) return;
      try {
        synth.stop();
      } catch {
        /* ignore */
      }
    },
    setVolume(next) {
      if (!destroyed) volume = next;
    },
    setSoundFontUrl(url) {
      if (destroyed || url === loadedUrl) return;
      loadBank(url);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribeSink();
      try {
        synth.destroy();
      } catch {
        /* ignore */
      }
    },
  };
}
