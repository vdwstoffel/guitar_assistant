"use client";

/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { parseTex } from "@/lib/tabscore/parse";
import { clampCaret, type Caret } from "@/lib/tabscore/locate";
import { speedToRate } from "@/lib/playbackSpeed";
import {
  applyAlphaTabSink,
  getAudioSinkPreference,
  routeContextToSink,
  subscribeToAudioSinkChanges,
} from "@/lib/audioSink";

export interface ScoreCanvasProps {
  tex: string;
  caret: Caret;
  onCaretChange: (caret: Caret) => void;
  onPlayingChange?: (playing: boolean) => void;
  /**
   * Practice playback speed as a whole percentage (10-200), the same unit the
   * audio and video players use. Converted to alphaTab's rate multiplier via
   * the shared `speedToRate`, so a tab is slowed down like anything else.
   */
  speed?: number;
  /** Repeat the score on finish. */
  looping?: boolean;
  /**
   * Playback volume of the score itself, 0-1. alphaTab's own unit, where 1
   * is normal — not the 10-200% practice speed beside it.
   */
  volume?: number;
  /**
   * Metronome click volume, 0-1. Zero is how alphaTab turns the click OFF;
   * there is no separate enable flag, which is why the toggle above this
   * just writes zero.
   */
  metronomeVolume?: number;
  /** Count-in tick volume, 0-1. Zero means no count-in, as above. */
  countInVolume?: number;

  /**
   * A bar range was selected by dragging across the score, or cleared.
   * Indices are zero-based and inclusive.
   */
  onLoopChange?: (range: { startBar: number; endBar: number } | null) => void;
  /** Playback reached the end (and did not loop). */
  onFinished?: () => void;
}

export interface ScoreCanvasHandle {
  playPause(): void;
  stop(): void;
  /** Drop any drag-selected practice range. */
  clearLoop(): void;
}

interface OverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const STRINGS = 6;

/** One tone for every beat: see `playClick`. */
const CLICK_HZ = 800;
/** How much quieter the beats after the first are — roughly 7dB down. */
const OFFBEAT_GAIN = 0.45;
/**
 * A count-in volume for alphaTab that makes the phase run without being
 * heard: zero would make it skip the count-in entirely.
 */
const INAUDIBLE = 0.0001;

/**
 * alphaTab's internal `Note.string` is 1 = lowest/bottom string (verified
 * against 1.8.1: `AlphaTexImporter` computes `note.string = tuning.length -
 * (digit - 1)`, so on standard tuning text digit "1" parses to note.string=6
 * with realValue=64=high e; digit "6" parses to note.string=1, realValue=40=
 * low E). Our `Caret.string` — like the AlphaTex text digit itself — is
 * 1 = highest/top string, so the two numbering schemes are inverted.
 */
function noteStringToCaretString(noteString: number, stringCount: number): number {
  return stringCount + 1 - noteString;
}

const ScoreCanvas = forwardRef<ScoreCanvasHandle, ScoreCanvasProps>(function ScoreCanvas(
  {
    tex,
    caret,
    onCaretChange,
    onPlayingChange,
    speed,
    looping,
    volume,
    metronomeVolume,
    countInVolume,
    onFinished,
    onLoopChange,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);

  // Latest-value refs so long-lived alphaTab event handlers (registered once,
  // in the setup effect below) never close over stale props.
  const texRef = useRef(tex);
  texRef.current = tex;
  const caretRef = useRef(caret);
  caretRef.current = caret;
  const onCaretChangeRef = useRef(onCaretChange);
  onCaretChangeRef.current = onCaretChange;

  // The last tex whose AST parsed successfully, so a bad mid-edit keystroke
  // leaves the previous render on screen instead of blanking the canvas.
  const lastGoodScoreNodeRef = useRef<any>(null);

  // Bookkeeping for a single mousedown gesture.
  const lastClickYRef = useRef<number | null>(null);
  const suppressBeatHandlerRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const [error, setError] = useState<string | null>(null);
  const [overlayRect, setOverlayRect] = useState<OverlayRect | null>(null);

  // --- Behaviour 3: the caret overlay is purely layout-derived, so it must be
  // recomputed both on renderFinished (layout changed) and whenever the caret
  // prop changes without a new render (e.g. arrow-key navigation). Reads
  // `caret` via a ref rather than closing over the prop directly so this stays
  // referentially stable and safe to call from the one-time setup effect
  // below without forcing it to re-run on every caret move. ---
  const positionCaretOverlay = useCallback(() => {
    const api = apiRef.current;
    const score = api?.score;
    const boundsLookup = api?.boundsLookup;
    if (!score || !boundsLookup) {
      setOverlayRect(null);
      return;
    }
    const c = caretRef.current;
    const bar = score.tracks?.[0]?.staves?.[0]?.bars?.[c.barIndex];
    const beat = bar?.voices?.[0]?.beats?.[c.beatIndex];
    const beatBounds = beat ? boundsLookup.findBeat(beat) : null;
    const barBounds = beatBounds?.barBounds;
    if (!beatBounds || !barBounds) {
      setOverlayRect(null);
      return;
    }
    const barVisual = barBounds.visualBounds;
    const beatVisual = beatBounds.visualBounds;
    const rowHeight = barVisual.h / STRINGS;
    const rowIndex = Math.min(Math.max(c.string - 1, 0), STRINGS - 1);
    setOverlayRect({
      left: beatVisual.x,
      top: barVisual.y + rowIndex * rowHeight,
      width: Math.max(beatVisual.w, 4),
      height: rowHeight,
    });
  }, []);

  // --- Behaviour 2: render the current tex unless it fails to parse. Leaving
  // the previous render alone on a parse failure (rather than calling into
  // alphaTab at all) is the whole point — see the report for why this is the
  // single most important behaviour in the task. ---
  const applyTex = useCallback((text: string) => {
    const api = apiRef.current;
    if (!api) return;
    const parsed = parseTex(text);
    if (!parsed.ok || !parsed.score) return;
    lastGoodScoreNodeRef.current = parsed.scoreNode;

    // Force tab-only rendering. alphaTab's default Staff shows BOTH standard
    // notation and tab (verified against 1.8.1: Staff's own field defaults are
    // showStandardNotation=true and showTablature=true), and when both are
    // rendered, BoundsLookup.findBeat() returns whichever staff's bounds were
    // registered first (findBeat is literally `findBeats(beat)[0]`) — the
    // Score-notation renderer runs before the Tab renderer in alphaTab's
    // default stave profile, so an unmodified render would hand behaviour 4
    // the standard-notation staff's bounds, not the tab staff's, breaking the
    // "divide the tab staff's height into six" math. With only the tab staff
    // present there is exactly one BarBounds per beat, so findBeat is
    // unambiguous. This is a deliberate deviation from calling api.tex(text)
    // directly (which parses internally and gives no hook to change this) —
    // full rationale, and how it was verified, is in task-12-report.md.
    for (const track of parsed.score.tracks ?? []) {
      for (const staff of track.staves ?? []) {
        staff.showStandardNotation = false;
        staff.showTablature = true;
      }
    }

    try {
      api.renderScore(parsed.score);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to render tab");
    }
  }, []);

  // --- One-time alphaTab setup, following AlphaTexPlayer.tsx:68-165. ---
  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;
    let destroyed = false;
    // Unsubscribed in this effect's cleanup; the sink preference is a
    // module-level subscription that outlives the api otherwise.
    let unsubscribeSink: (() => void) | null = null;
    let onWindowMouseUp: (() => void) | null = null;

    const init = async () => {
      try {
        setError(null);
        const alphaTab = await import("@coderline/alphatab");
        const { AlphaTabApi, Settings, Environment } = alphaTab;
        if (destroyed || !containerRef.current) return;

        // Worker/worklet URLs must be explicit — alphaTab otherwise
        // auto-detects from import.meta.url, which points at the bundled
        // chunk and breaks.
        if (!Environment.isRunningInWorker) {
          Environment.initializeMain(
            () => new Worker("/alphaTab.worker.mjs", { type: "module" }),
            (ctx: AudioContext) => ctx.audioWorklet.addModule("/alphaTab.worklet.mjs"),
          );
        }

        const settings = new Settings();
        settings.core.fontDirectory = "/font/";
        settings.core.tex = true;
        settings.player.playerMode = alphaTab.PlayerMode.EnabledSynthesizer;
        settings.player.soundFont = "/soundfont/sonivox.sf2";
        settings.player.enableCursor = true;

        const api = new AlphaTabApi(containerRef.current, settings);
        apiRef.current = api;
        try {
          api.playbackSpeed = speedToRate(speedRef.current);
        } catch {
          /* ignore */
        }

        try {
          api.isLooping = !!loopingRef.current;
        } catch {
          /* ignore */
        }

        // Applied at init as well as in the effects below: the effects run
        // before this async setup finishes, so a volume chosen before the
        // api existed would otherwise be silently dropped.
        try {
          if (volumeRef.current !== undefined) api.masterVolume = volumeRef.current;
          applyClickVolumes(api);
        } catch {
          /* ignore */
        }

        api.playerStateChanged.on((e: any) => {
          if (destroyed) return;
          const playing = e.state === 1; // synth.PlayerState.Playing
          setIsPlaying(playing);
          // alphaTab runs the count-in first when countInVolume is above
          // zero, and emits the same metronome events for it. There is no
          // public flag for the phase, so track it here: it ends as soon as
          // the position starts moving.
          if (playing) countingInRef.current = (countInVolumeRef.current ?? 0) > 0;
        });

        api.playerPositionChanged.on((e: any) => {
          if (!destroyed && e?.currentTime > 0) countingInRef.current = false;
        });

        // Every tick is ours. alphaTab plays all of them at one fixed
        // velocity and its synthesiser ignores the beat number the event
        // carries, so there is no way to accent a downbeat through it — and
        // a second, different tone layered on top just sounds like two
        // instruments. Its own click is silenced (see applyClickVolumes) and
        // each tick is played here instead: one sound throughout, the
        // downbeat simply louder.
        api.midiEventsPlayedFilter = [alphaTab.midi.MidiEventType.AlphaTabMetronome];
        api.midiEventsPlayed.on((e: any) => {
          if (destroyed) return;
          for (const midi of e?.events ?? []) {
            if (!midi?.isMetronome) continue;
            // Which volume applies depends on the phase, exactly as it does
            // for alphaTab's own click: zero means the user has this kind of
            // click switched off.
            const level = countingInRef.current
              ? (countInVolumeRef.current ?? 0)
              : (metronomeVolumeRef.current ?? 0);
            if (level > 0) playClick(level, midi.metronomeNumerator === 0);
          }
        });

        api.playerFinished.on(() => {
          if (!destroyed) onFinishedRef.current?.();
        });

        // Respect the app-wide output device, the same way AlphaTexPlayer
        // does. Applied on playerReady (the output does not exist before
        // then) and again whenever the preference changes elsewhere.
        const applySink = () => {
          void applyAlphaTabSink(api.player?.output, getAudioSinkPreference());
        };
        api.playerReady.on(applySink);
        unsubscribeSink = subscribeToAudioSinkChanges(applySink);

        // Both events call positionCaretOverlay. renderFinished fires once
        // the sheet is "layouted and arranged" and, per alphaTab's own docs,
        // boundsLookup should already be populated by then — but verified in
        // the browser (Task 18): on the very first render, reading
        // boundsLookup from this handler still finds beats that don't
        // resolve, so the overlay stayed unset until some later event (e.g.
        // a click) called positionCaretOverlay again after bounds had caught
        // up. postRenderFinished, fired once the rendered output is actually
        // in the DOM, is the hook that reliably has bounds ready. Keeping
        // the renderFinished subscription too is cheap insurance, not a
        // regression risk: positionCaretOverlay is idempotent, so a call
        // from renderFinished is at worst immediately superseded by the
        // postRenderFinished call moments later.
        api.renderFinished.on(() => {
          if (!destroyed) positionCaretOverlay();
        });
        api.postRenderFinished.on(() => {
          if (destroyed) return;
          positionCaretOverlay();
          reapplyLoop();
        });

        api.error.on((e: any) => {
          if (destroyed) return;
          const inner = e?.error || e?.innerError;
          setError(inner?.message || e?.message || "alphaTab error");
        });

        const emitCaret = (bar: any, beat: any, stringNumber: number) => {
          const raw: Caret = { barIndex: bar.index, beatIndex: beat.index, string: stringNumber };
          const scoreNode = lastGoodScoreNodeRef.current;
          onCaretChangeRef.current(scoreNode ? clampCaret(scoreNode, raw) : raw);
        };

        // Behaviour 3/4 — click to place the caret. noteMouseDown fires for
        // the more specific hit (a note itself, not just its beat's column)
        // and carries the Note, which pins the string down exactly; it sets a
        // flag so the beatMouseDown handler below — which may also fire for
        // the same click — doesn't overwrite that precise string with a
        // coarser y-derived guess. Unverified: whether alphaTab fires both
        // events for one click, only one of them, and in which order — this
        // handles every ordering, at worst emitting one redundant (and
        // immediately superseded) caret update. See task-12-report.md.
        api.noteMouseDown.on((note: any) => {
          if (destroyed) return;
          const bar = note?.beat?.voice?.bar;
          if (!bar) return;
          const stringCount = bar.staff?.tuning?.length || STRINGS;
          suppressBeatHandlerRef.current = true;
          emitCaret(bar, note.beat, noteStringToCaretString(note.string, stringCount));
        });

        // Practice-range selection. Dragging across the score selects whole
        // bars to loop; a plain click is untouched and still just moves the
        // caret, so editing inside a looped section does not destroy it.
        const barsOf = () =>
          apiRef.current?.score?.tracks?.[0]?.staves?.[0]?.bars ?? [];

        const highlightBars = (aIndex: number, bIndex: number) => {
          const bars = barsOf();
          const start = Math.min(aIndex, bIndex);
          const end = Math.max(aIndex, bIndex);
          const firstBeat = bars[start]?.voices?.[0]?.beats?.[0];
          const endBeats = bars[end]?.voices?.[0]?.beats;
          const lastBeat = endBeats?.[endBeats.length - 1];
          if (!firstBeat || !lastBeat) return null;
          try {
            apiRef.current?.highlightPlaybackRange(firstBeat, lastBeat);
          } catch {
            return null;
          }
          return { startBar: start, endBar: end };
        };

        // Every edit re-parses the document and calls renderScore with a
        // brand new Score, whose Beats are different objects from the ones the
        // range was built from. The loop deliberately survives editing (you
        // fix a note inside the section you are drilling), so it is re-applied
        // from bar indices after each render rather than left to alphaTab.
        const reapplyLoop = () => {
          const wanted = loopBarsRef.current;
          if (!wanted) return;
          const bars = barsOf();
          if (wanted.startBar >= bars.length) {
            // The bars it covered are gone; drop it rather than guess.
            loopBarsRef.current = null;
            try {
              apiRef.current?.clearPlaybackRangeHighlight();
              if (apiRef.current) apiRef.current.playbackRange = null;
            } catch {
              /* ignore */
            }
            onLoopChangeRef.current?.(null);
            return;
          }
          const end = Math.min(wanted.endBar, bars.length - 1);
          if (!highlightBars(wanted.startBar, end)) return;
          try {
            apiRef.current?.applyPlaybackRangeFromHighlight();
          } catch {
            return;
          }
          if (end !== wanted.endBar) {
            loopBarsRef.current = { startBar: wanted.startBar, endBar: end };
            onLoopChangeRef.current?.(loopBarsRef.current);
          }
        };

        // Ends a drag with whatever bars it last covered. Called from
        // beatMouseUp for a release over the score, and from the window
        // listener below for one that lands anywhere else — alphaTab binds
        // mouseup to its own canvas element, so a release past the right edge
        // of the last bar (the natural way to select "to the end") never
        // reaches it, and without this the drag would hang: its own
        // _isBeatMouseDown stays set, and plain hovering would then keep
        // extending the selection.
        const commitDrag = () => {
          const range = dragPreviewRef.current;
          dragStartBeatRef.current = null;
          dragPreviewRef.current = null;
          if (!draggedRef.current) return false;
          draggedRef.current = false;
          if (!range || !highlightBars(range.startBar, range.endBar)) return false;
          try {
            apiRef.current?.applyPlaybackRangeFromHighlight();
          } catch {
            return false;
          }
          loopBarsRef.current = range;
          onLoopChangeRef.current?.(range);
          return true;
        };

        api.beatMouseMove.on((beat: any) => {
          if (destroyed) return;
          const startBar = dragStartBeatRef.current?.voice?.bar;
          const overBar = beat?.voice?.bar;
          if (!startBar || !overBar) return;
          // Only a genuine drag — moving within the beat it started on is
          // still a click as far as the caret is concerned.
          if (overBar.index === startBar.index && beat === dragStartBeatRef.current) return;
          draggedRef.current = true;
          dragPreviewRef.current = highlightBars(startBar.index, overBar.index);
        });

        api.beatMouseUp.on((beat: any) => {
          if (destroyed) return;
          const startBar = dragStartBeatRef.current?.voice?.bar;
          const overBar = beat?.voice?.bar;
          // Prefer the bar actually released over; fall back to the last one
          // the drag passed through when the release was off a beat.
          if (draggedRef.current && startBar && overBar) {
            dragPreviewRef.current = { startBar: startBar.index, endBar: overBar.index };
            if (overBar.index < startBar.index) {
              dragPreviewRef.current = { startBar: overBar.index, endBar: startBar.index };
            }
          }
          if (commitDrag()) return;
          // A plain click. alphaTab's own handler has already run by now, and
          // for a click (its _selectionEnd is unset, or equals
          // _selectionStart) it sets playbackRange to null. Editing a note
          // inside the section you are drilling is exactly what you do while
          // practising, so put the section back — the toolbar's ✕ is the only
          // way to lose it.
          reapplyLoop();
        });

        // Bubble phase, so alphaTab's capture-phase handler on its own canvas
        // has already committed the drag by the time this runs for a release
        // over the score; commitDrag then no-ops.
        onWindowMouseUp = () => {
          if (!destroyed) commitDrag();
        };
        window.addEventListener("mouseup", onWindowMouseUp);

        api.beatMouseDown.on((beat: any) => {
          if (destroyed) return;
          dragStartBeatRef.current = beat;
          draggedRef.current = false;
          if (suppressBeatHandlerRef.current) {
            suppressBeatHandlerRef.current = false;
            return;
          }
          const bar = beat?.voice?.bar;
          if (!bar) return;
          const barBounds = apiRef.current?.boundsLookup?.findBeat(beat)?.barBounds;
          const y = lastClickYRef.current;
          let stringNumber = caretRef.current.string;
          if (barBounds && y != null) {
            const rowHeight = barBounds.visualBounds.h / STRINGS;
            const row = Math.floor((y - barBounds.visualBounds.y) / rowHeight);
            stringNumber = Math.min(Math.max(row, 0), STRINGS - 1) + 1;
          }
          emitCaret(bar, beat, stringNumber);
        });

        // Capture phase so this always runs before alphaTab's own bubble-
        // phase listener for the same native mousedown, giving the handlers
        // above a fresh click-y and a clean suppress flag for this gesture.
        const onMouseDownCapture = (e: MouseEvent) => {
          suppressBeatHandlerRef.current = false;
          const rect = containerRef.current?.getBoundingClientRect();
          lastClickYRef.current = rect ? e.clientY - rect.top : null;
        };
        containerRef.current.addEventListener("mousedown", onMouseDownCapture, true);
        (api as any).__removeClickCapture = () =>
          containerRef.current?.removeEventListener("mousedown", onMouseDownCapture, true);

        applyTex(texRef.current);
      } catch (err) {
        if (!destroyed) {
          setError(err instanceof Error ? err.message : "Failed to initialize the tab canvas");
        }
      }
    };

    init();

    return () => {
      destroyed = true;
      unsubscribeSink?.();
      unsubscribeSink = null;
      if (onWindowMouseUp) window.removeEventListener("mouseup", onWindowMouseUp);
      onWindowMouseUp = null;
      // The click's own context is separate from alphaTab's output and
      // would otherwise outlive the editor.
      void clickContextRef.current?.close().catch(() => {});
      clickContextRef.current = null;
      const api = apiRef.current;
      if (api) {
        try {
          (api as any).__removeClickCapture?.();
          api.stop();
          api.destroy();
        } catch {
          /* ignore */
        }
        apiRef.current = null;
      }
    };
  }, [applyTex, positionCaretOverlay]);

  // Re-render whenever the tex prop changes. (The very first render happens
  // above, right after setup, via texRef — this effect's own mount-time call
  // is a harmless no-op since the api isn't created yet at that point.)
  useEffect(() => {
    applyTex(tex);
  }, [tex, applyTex]);

  useEffect(() => {
    positionCaretOverlay();
  }, [caret, positionCaretOverlay]);

  useEffect(() => {
    onPlayingChange?.(isPlaying);
  }, [isPlaying, onPlayingChange]);

  // alphaTab is torn down and rebuilt whenever `tex` changes, so the speed has
  // to be (re)applied both at init and whenever it changes on its own.
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const metronomeVolumeRef = useRef(metronomeVolume);
  metronomeVolumeRef.current = metronomeVolume;
  const countInVolumeRef = useRef(countInVolume);
  countInVolumeRef.current = countInVolume;
  // Which phase alphaTab is in, since the two volumes above mean different
  // things during the count-in and during playback, and alphaTab exposes no
  // flag for it.
  const countingInRef = useRef(false);
  const clickContextRef = useRef<AudioContext | null>(null);
  const loopingRef = useRef(looping);
  loopingRef.current = looping;
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const onLoopChangeRef = useRef(onLoopChange);
  onLoopChangeRef.current = onLoopChange;
  // Drag state for practice-range selection. Refs, not state: these change
  // many times per drag and must not re-render the score underneath it.
  const dragStartBeatRef = useRef<any>(null);
  const draggedRef = useRef(false);
  const dragPreviewRef = useRef<{ startBar: number; endBar: number } | null>(null);
  const loopBarsRef = useRef<{ startBar: number; endBar: number } | null>(null);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    try {
      api.playbackSpeed = speedToRate(speed);
    } catch {
      /* ignore — the api may be mid-teardown */
    }
  }, [speed]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    try {
      api.isLooping = !!looping;
    } catch {
      /* ignore */
    }
  }, [looping]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api || volume === undefined) return;
    try {
      api.masterVolume = volume;
    } catch {
      /* ignore — the api may be mid-teardown */
    }
  }, [volume]);

  // Deliberately plain functions on the component, not useCallbacks: they are
  // only ever called from the alphaTab subscriptions set up at mount, which
  // read them through the closure once.

  /**
   * One click, every beat, with the downbeat louder — same tone, same decay,
   * only the gain differs, because two different tones are distracting to
   * play along to.
   */
  const playClick = (level: number, accent: boolean) => {
    try {
      let ctx = clickContextRef.current;
      if (!ctx) {
        ctx = new AudioContext();
        clickContextRef.current = ctx;
        void routeContextToSink(ctx);
      }
      if (ctx.state === "suspended") void ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = CLICK_HZ;
      const at = ctx.currentTime;
      gain.gain.setValueAtTime(level * (accent ? 1 : OFFBEAT_GAIN), at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.05);
      osc.start(at);
      osc.stop(at + 0.05);
    } catch {
      /* no audio output available — the tab itself still plays */
    }
  };

  /**
   * What alphaTab itself gets, which is not what the user chose.
   *
   * Its metronome is silenced outright: every tick is played above instead.
   * The count-in cannot be silenced the same way, because a count-in volume
   * of zero makes alphaTab skip the count-in phase altogether rather than
   * run it quietly — so it gets a whisper, far below anything audible, which
   * is enough to make the phase happen and emit its ticks.
   */
  const applyClickVolumes = (api: any) => {
    api.metronomeVolume = 0;
    api.countInVolume = (countInVolumeRef.current ?? 0) > 0 ? INAUDIBLE : 0;
  };

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    try {
      applyClickVolumes(api);
    } catch {
      /* ignore */
    }
    // applyClickVolumes reads the current values through refs, so the two
    // volumes are the honest dependencies even though it is not one itself.
  }, [metronomeVolume, countInVolume]);

  // --- Behaviour 5 ---
  useImperativeHandle(
    ref,
    () => ({
      playPause: () => {
        const api = apiRef.current;
        if (!api) return;
        try {
          if (isPlayingRef.current) api.pause();
          else api.play();
        } catch {
          /* ignore */
        }
      },
      clearLoop: () => {
        loopBarsRef.current = null;
        try {
          apiRef.current?.clearPlaybackRangeHighlight();
          if (apiRef.current) apiRef.current.playbackRange = null;
        } catch {
          /* ignore */
        }
        onLoopChangeRef.current?.(null);
      },
      stop: () => {
        try {
          apiRef.current?.stop();
        } catch {
          /* ignore */
        }
      },
    }),
    [],
  );

  return (
    <div className="relative w-full h-full overflow-auto bg-gray-600 rounded border border-gray-500">
      <style jsx global>{`
        .score-canvas-host .at-surface {
          width: 100% !important;
          margin: 0 !important;
          background: white !important;
          overflow: hidden;
        }
        .score-canvas-host .at-surface svg {
          display: block;
          width: 100% !important;
          height: auto;
        }
        .score-canvas-host .at-cursor-bar {
          background: rgba(255, 242, 0, 0.25);
        }
        .score-canvas-host .at-beat-cursor {
          background: rgba(64, 64, 255, 0.75);
          width: 3px;
        }
        /*
          The drag-selected practice range. alphaTab positions this overlay
          but gives it no background of its own, so without this rule a
          selected section looked identical to an unselected one — the only
          sign it had worked was the toolbar chip. Blue, to stay distinct
          from the yellow current-bar cursor above, which sits under it.
        */
        .score-canvas-host .at-selection div {
          background: rgba(59, 130, 246, 0.22);
        }
      `}</style>
      <div className="score-canvas-host relative">
        <div ref={containerRef} className="w-full" />
        {overlayRect && (
          <div
            className="absolute pointer-events-none border border-blue-400 bg-blue-500/30"
            style={{
              left: overlayRect.left,
              top: overlayRect.top,
              width: overlayRect.width,
              height: overlayRect.height,
            }}
          />
        )}
      </div>
      {error && (
        <div className="sticky bottom-0 left-0 right-0 bg-gray-900/90 text-red-400 text-xs px-2 py-1 border-t border-gray-500">
          {error}
        </div>
      )}
    </div>
  );
});

export default ScoreCanvas;
