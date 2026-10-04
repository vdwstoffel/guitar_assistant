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
import { useAlphaTabPlayback, SCORE_SURFACE_CSS } from "@/components/gp/useAlphaTabPlayback";

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
  // The element that actually scrolls. alphaTab needs it by reference: left
  // to itself it scrolls `html,body`, and this score sits inside an
  // overflow-auto panel, so the page never moves and the cursor simply
  // walks off the bottom of a tab longer than the panel.
  const scrollRef = useRef<HTMLDivElement>(null);
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

  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  // Everything about PLAYING the score — click, count-in, output device,
  // speed, volumes, drag-across-bars to loop — belongs to the shared hook,
  // which the Guitar Pro player uses too. This component keeps only what is
  // about EDITING one.
  const playback = useAlphaTabPlayback({
    speed,
    looping,
    volume,
    metronomeVolume,
    countInVolume,
    onLoopChange,
  });

  // --- One-time alphaTab setup, following AlphaTexPlayer.tsx:68-165. ---
  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;
    let destroyed = false;
    // Unsubscribed in this effect's cleanup; the sink preference is a
    // module-level subscription that outlives the api otherwise.
    let detachPlayback: (() => void) | null = null;

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
        settings.player.scrollMode = alphaTab.ScrollMode.Continuous;
        settings.player.scrollElement = scrollRef.current!;
        // Keep a little music above the active bar rather than pinning it to
        // the very top edge, so you can see what you have just played.
        settings.player.scrollOffsetY = -40;

        const api = new AlphaTabApi(containerRef.current, settings);
        apiRef.current = api;
        // Playback — the click, the count-in, the output device, the speed
        // and volumes, and drag-across-bars to loop — is the shared hook's.
        // What is left here is the editor: the caret and the AlphaTex model.
        detachPlayback = playback.attach(api, alphaTab);

        api.playerStateChanged.on((e: any) => {
          if (!destroyed) setIsPlaying(e.state === 1); // synth.PlayerState.Playing
        });

        api.playerFinished.on(() => {
          if (!destroyed) onFinishedRef.current?.();
        });

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
          if (!destroyed) positionCaretOverlay();
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

        // The hook has its own beatMouseDown for the drag; this one is the
        // caret's. alphaTab allows both.
        api.beatMouseDown.on((beat: any) => {
          if (destroyed) return;
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
      detachPlayback?.();
      detachPlayback = null;
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
  }, [applyTex, positionCaretOverlay, playback]);

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

  // The hook applies speed, looping and the volumes itself.

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
      clearLoop: () => playback.clearLoop(),
      stop: () => {
        try {
          apiRef.current?.stop();
        } catch {
          /* ignore */
        }
      },
    }),
    [playback],
  );

  return (
    <div
      ref={scrollRef}
      className="relative w-full h-full overflow-auto bg-gray-600 rounded border border-gray-500"
    >
      <style jsx global>{`
        .score-canvas-host {
          ${SCORE_SURFACE_CSS}
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
