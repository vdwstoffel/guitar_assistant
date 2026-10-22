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
import { clampCaret, sameCaret, type BeatPos, type Caret } from "@/lib/tabscore/locate";
import { beatAt, isAudible, isPreviewable } from "@/lib/tabscore/caretBeat";
import { comparePos, type Range } from "@/lib/tabscore/selection";
import { selectionRects, type Rect } from "@/lib/tabscore/selectionRects";
import type { Rect as ScreenRect } from "@/lib/tabscore/placeMenu";
import { createPreviewSynth, type PreviewSynth } from "./previewSynth";
import { styleBrokenBars } from "@/lib/tabscore/barStyles";
import { ensureRenderableTuning } from "@/lib/tabscore/tuningGuard";
import { createPlaybackScrollHandler } from "@/lib/tabscore/playbackScroll";
import type { StripMessage } from "@/lib/tabscore/barMessages";
import BarStatusStrip from "./BarStatusStrip";
import { onOwnScrollbar } from "./ownScrollbar";
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
   * Which sound bank the score plays with: a URL under `/soundfont/`. A
   * playback preference only — the written notes and their sounds' pitches
   * are unchanged, only the instrument samples. See `src/lib/soundBank.ts`.
   * Absent means the default bank. A change mid-play reloads the synth and
   * resumes where the pause left off.
   */
  soundBankUrl?: string;

  /**
   * A bar range was selected by dragging across the score, or cleared.
   * Indices are zero-based and inclusive.
   */
  onLoopChange?: (range: { startBar: number; endBar: number } | null) => void;
  /** Playback reached the end (and did not loop). */
  onFinished?: () => void;
  /**
   * A press on the score ended as a plain click (not a loop drag). The caret
   * already moved on mouse-down; this is the release, which is when the
   * editor previews the clicked beat.
   */
  onCaretClick?: () => void;
  /** What the strip under the score says about bars that do not add up; null hides it. */
  barStatus?: StripMessage | null;
  /** The strip's Fix all button. */
  onFixAll?: () => void;
  /** The edit selection, drawn in violet under the caret; null for none. */
  selection?: Range | null;
  /**
   * A left-button Shift+press on a beat: the caret it would put there. The
   * press is swallowed — alphaTab never sees it, so there is no seek, no
   * change to the practice loop and no drag — and nothing else is reported
   * for it (no onCaretChange, no onCaretClick).
   */
  onShiftClick?: (caret: Caret) => void;
  /**
   * The note menu, asked for with the pointer: a right-click on a beat (the
   * caret it would put there, and whether that beat is inside the edit
   * selection), a right-click on empty score, or a plain click — released, not
   * dragged — on the note the caret was on before the press. A right-click
   * moves nothing itself (alphaTab ignores the right button). Given this, the
   * canvas suppresses the browser's own menu for a plain right-click on the
   * score — asking for the note menu, unless the left button is held — and
   * leaves it alone for a modified click, another button, the strip under the
   * score and the panel's scrollbar: the editor's container keeps the
   * browser's menu away there. Both only where the browser has the Popover API
   * (TabEditor's MENU_SUPPORTED): without it there is no note menu, the editor
   * passes no onMenuRequest and keeps nothing away, and the browser's own menu
   * opens over the score as it always did.
   */
  onMenuRequest?: (request: MenuRequest) => void;
  /**
   * The score moved on screen under anything placed against it: the panel
   * scrolled, alphaTab laid the score out again, or the panel changed size —
   * the window, a notice above it, the strip under the score. It is not
   * coalesced and carries no cause: it fires once per scroll event, layout and
   * size change — about once a frame while a scrolled panel lays out again —
   * and once at mount, before the score has any bounds. So keep the handler
   * cheap, and tolerate `barClientRect` being null.
   */
  onViewChange?: () => void;
}

/** How the pointer asked for the note menu (ScoreCanvasProps.onMenuRequest). */
export type MenuRequest =
  | { kind: "beat"; caret: Caret; inSelection: boolean }
  | { kind: "empty" }
  | { kind: "caretNote"; caret: Caret };

export interface ScoreCanvasHandle {
  playPause(): void;
  stop(): void;
  /** Drop any drag-selected practice range. */
  clearLoop(): void;
  /**
   * Play the newest candidate beat that has something to sound, on the note
   * preview's own synth. Does nothing while the score is playing or counting
   * in, or for a document that is not one track, staff and voice.
   */
  previewBeat(candidatesNewestFirst: Caret[]): void;
  /** Silence a preview that is still sounding. */
  stopPreview(): void;
  /**
   * The bar of the beat at `at`, on screen: from that beat's left edge to the
   * bar's right edge, the bar's full height. Null before a render, or for a
   * beat the score does not draw.
   */
  barClientRect(at: BeatPos): ScreenRect | null;
  /**
   * The part of the score panel that shows music, on screen: inside the
   * scroller, above the sticky strip under the score, within the window.
   */
  scoreClientRect(): ScreenRect | null;
  /** Scroll the panel at once so the bar is in view — its top, when it is taller than the panel. */
  scrollBarIntoView(barIndex: number): void;
}

interface OverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const STRINGS = 6;

// One copy of each, shared by the score and the note preview's synth.
const SOUND_FONT_URL = "/soundfont/sonivox.sf2";
const WORKLET_URL = "/alphaTab.worklet.mjs";

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
    soundBankUrl,
    onFinished,
    onLoopChange,
    onCaretClick,
    barStatus = null,
    onFixAll,
    selection = null,
    onShiftClick,
    onMenuRequest,
    onViewChange,
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
  // The alphaTab module, kept from init: applyTex builds model styles with it.
  const alphaTabRef = useRef<any>(null);
  // The note preview's own synth: a second worker and AudioContext beside the
  // score's, so a preview never touches the score's state, loop or events.
  const previewSynthRef = useRef<PreviewSynth | null>(null);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  // The bank actually loaded in the score's synth right now: the swap effect
  // below compares against it, and the soundFontLoaded handler consults the
  // resume flag. (The picker in TabEditor owns the *preference*; this is what
  // survived on the synth.)
  const bankUrlRef = useRef(soundBankUrl ?? SOUND_FONT_URL);
  const resumeAfterBankRef = useRef(false);
  // alphaTab's own load of the bank chosen at init is async; a swap may not
  // hand it bytes before that load has reported, or the two loads race and the
  // default bank can win. The swap effect parks the newest URL here until the
  // first soundFontLoaded arrives.
  const initialBankLoadedRef = useRef(false);
  const pendingBankUrlRef = useRef<string | null>(null);
  // Guards against two bank fetches finishing out of order: only the newest
  // swap may hand its bytes to the synth.
  const soundFontSwapIdRef = useRef(0);

  // Latest-value refs so long-lived alphaTab event handlers (registered once,
  // in the setup effect below) never close over stale props.
  const texRef = useRef(tex);
  texRef.current = tex;
  const caretRef = useRef(caret);
  caretRef.current = caret;
  const onCaretChangeRef = useRef(onCaretChange);
  onCaretChangeRef.current = onCaretChange;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const onShiftClickRef = useRef(onShiftClick);
  onShiftClickRef.current = onShiftClick;
  const onMenuRequestRef = useRef(onMenuRequest);
  onMenuRequestRef.current = onMenuRequest;
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;
  const onCaretClickRef = useRef(onCaretClick);
  onCaretClickRef.current = onCaretClick;
  // The sticky strip under the score, while there is one.
  const footerRef = useRef<HTMLDivElement>(null);

  // The last tex whose AST parsed successfully, so a bad mid-edit keystroke
  // leaves the previous render on screen instead of blanking the canvas.
  const lastGoodScoreNodeRef = useRef<any>(null);

  // Bookkeeping for a single mousedown gesture.
  const lastClickYRef = useRef<number | null>(null);
  const suppressBeatHandlerRef = useRef(false);
  // A plain left press: the caret before it, and the caret it landed on.
  const pressRef = useRef<{ before: Caret; landed: Caret | null } | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const [error, setError] = useState<string | null>(null);
  const [overlayRect, setOverlayRect] = useState<OverlayRect | null>(null);
  const [selectionBoxes, setSelectionBoxes] = useState<Rect[]>([]);

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
    const beat = beatAt(score, c);
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

  // The selection's rectangles, from the same bounds as the caret and at the
  // same moments: after every render (a resize renders too) and whenever the
  // selection changes. While the bounds are still the last render's (null from
  // selectionRects) a new render is on its way and will call this again: boxes
  // drawn for this same range stay — Delete and Ctrl+X keep their selection, and
  // must not blink — and any others go rather than stand where the old render
  // put other beats. Nothing to draw, and nothing drawn, leaves the state alone.
  const drawnRangeRef = useRef<Range | null>(null);
  const positionSelectionOverlay = useCallback(() => {
    const api = apiRef.current;
    const range = selectionRef.current;
    const rects = api?.score && api?.boundsLookup && range ? selectionRects(api.score, api.boundsLookup, range) : [];
    const drawn = drawnRangeRef.current;
    if (rects === null && range && drawn && comparePos(range.from, drawn.from) === 0 && comparePos(range.to, drawn.to) === 0) {
      return;
    }
    const next = rects ?? [];
    drawnRangeRef.current = next.length > 0 ? range : null;
    setSelectionBoxes((prev) => (prev.length === 0 && next.length === 0 ? prev : next));
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

    // Tab-only rendering above removes the one renderer that tolerates an
    // empty staff tuning, so a hand-typed tab without a `\tuning` line used
    // to blank the canvas with 'reading staves'. Fill the tuning (and place
    // bare-pitch notes on strings) before rendering — see tuningGuard.ts.
    try {
      if (alphaTabRef.current) ensureRenderableTuning(alphaTabRef.current, parsed.score);
    } catch (e) {
      console.warn("[tabs] could not apply the tuning guard", e);
    }

    // Bars that do not add up, in colour (barStyles.ts). Applied to this
    // fresh Score every time, so a fixed bar is drawn plain on the next render.
    // A hint, so never a reason not to draw the score at all.
    try {
      if (alphaTabRef.current) styleBrokenBars(alphaTabRef.current, parsed.score, api.settings.display.resources);
    } catch (e) {
      console.warn("[tabs] could not colour the bars that do not add up", e);
    }

    try {
      api.renderScore(parsed.score);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to render tab");
    }
  }, []);

  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  // The playback hook reports a press that ended as a plain click, not a
  // drag, on its release. A press moves the caret at once, so by now the caret
  // is wherever the press landed: whether it landed on the note the caret was
  // on before it is the press's own record (pressRef). That second click on
  // the caret's note asks for the note menu; the release is then passed on
  // for the preview, as every click's is.
  const handleClick = useCallback(() => {
    const press = pressRef.current;
    pressRef.current = null;
    if (press?.landed && sameCaret(press.before, press.landed)) {
      onMenuRequestRef.current?.({ kind: "caretNote", caret: press.landed });
    }
    onCaretClickRef.current?.();
  }, []);

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
    onClick: handleClick,
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
        alphaTabRef.current = alphaTab;

        // Worker/worklet URLs must be explicit — alphaTab otherwise
        // auto-detects from import.meta.url, which points at the bundled
        // chunk and breaks.
        if (!Environment.isRunningInWorker) {
          Environment.initializeMain(
            () => new Worker("/alphaTab.worker.mjs", { type: "module" }),
            (ctx: AudioContext) => ctx.audioWorklet.addModule(WORKLET_URL),
          );
        }

        const settings = new Settings();
        settings.core.fontDirectory = "/font/";
        settings.core.tex = true;
        settings.player.playerMode = alphaTab.PlayerMode.EnabledSynthesizer;
        settings.player.soundFont = bankUrlRef.current;
        settings.player.enableCursor = true;
        // Continuous: scroll only when a new system (line) starts playing —
        // one glide per line boundary, at settings.player.scrollSpeed.
        // Smooth was tried first and rejected: it scrolls the whole system
        // height across the system's full duration starting at its first
        // beat, so on slow music the active bar drifts out of picture while
        // you play it (measured 2026-10-21: Y 224 -> 114 on a 60 BPM line).
        settings.player.scrollMode = alphaTab.ScrollMode.Continuous;
        settings.player.scrollElement = scrollRef.current!;
        // Keep a little music above the active bar rather than pinning it to
        // the very top edge, so you can see what you have just played.
        settings.player.scrollOffsetY = -40;

        const api = new AlphaTabApi(containerRef.current, settings);
        // Jasper's scroll-blocking rule (2026-10-21): alphaTab's own speed is
        // kept; scrolling is allowed only to bring the next line up, and a
        // line already at the viewport top never scrolls further — the score
        // can't slide out from under the playhead.
        api.customScrollHandler = createPlaybackScrollHandler(api);
        apiRef.current = api;
        // Playback — the click, the count-in, the output device, the speed
        // and volumes, and drag-across-bars to loop — is the shared hook's.
        // What is left here is the editor: the caret and the AlphaTex model.
        detachPlayback = playback.attach(api, alphaTab);
        previewSynthRef.current = createPreviewSynth(alphaTab, {
          scoreOutput: api.player?.output,
          mainSettings: settings,
          soundFontUrl: bankUrlRef.current,
          workletUrl: WORKLET_URL,
          volume: volumeRef.current ?? 1,
        });

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
          if (destroyed) return;
          positionCaretOverlay();
          positionSelectionOverlay();
        });
        api.postRenderFinished.on(() => {
          if (destroyed) return;
          positionCaretOverlay();
          positionSelectionOverlay();
          onViewChangeRef.current?.();
        });

        api.error.on((e: any) => {
          if (destroyed) return;
          const inner = e?.error || e?.innerError;
          setError(inner?.message || e?.message || "alphaTab error");
        });

        // alphaTab's own load of the init bank fires soundFontLoaded; mark it
        // done and replay any bank the picker asked for while that fetch was
        // still in flight (see the swap effect below). A swap's bytes land
        // later and fire it again.
        api.soundFontLoaded.on(() => {
          if (destroyed) return;
          initialBankLoadedRef.current = true;
          const pending = pendingBankUrlRef.current;
          if (pending && pending !== bankUrlRef.current) {
            pendingBankUrlRef.current = null;
            bankUrlRef.current = pending;
            applySoundBankSwap(api, pending);
          }
        });

        // Swapping a bank stops the synth (loadSoundFont stops playback);
        // readyForPlayback fires once the new bank's presets are loaded into
        // the synthesizer, which is when picking up where the stop left off
        // sounds with the new bank — the sequencer kept its tick position.
        api.player?.readyForPlayback.on(() => {
          if (destroyed || !resumeAfterBankRef.current) return;
          resumeAfterBankRef.current = false;
          try {
            api.play();
          } catch {
            /* the practice state already reflects the stop */
          }
        });
        // A bank that failed to load leaves the old presets in place; drop the
        // pending resume so a later readyForPlayback cannot restart playback on
        // its own, and let the error surface like any other player failure.
        api.player?.soundFontLoadFailed.on((e: any) => {
          if (destroyed) return;
          resumeAfterBankRef.current = false;
          const inner = e?.error || e?.innerError;
          setError(inner?.message || e?.message || "Could not load the selected sound bank");
        });

        const caretFor = (bar: any, beat: any, stringNumber: number): Caret => {
          const raw: Caret = { barIndex: bar.index, beatIndex: beat.index, string: stringNumber };
          const scoreNode = lastGoodScoreNodeRef.current;
          return scoreNode ? clampCaret(scoreNode, raw) : raw;
        };
        const emitCaret = (bar: any, beat: any, stringNumber: number) => {
          const next = caretFor(bar, beat, stringNumber);
          if (pressRef.current) pressRef.current.landed = next;
          onCaretChangeRef.current(next);
        };
        // The string row under a press's height within its bar: six equal
        // rows of the tab staff, top string first.
        const stringAt = (barBounds: any, y: number | null): number => {
          if (!barBounds || y == null) return caretRef.current.string;
          const rowHeight = barBounds.visualBounds.h / STRINGS;
          const row = Math.floor((y - barBounds.visualBounds.y) / rowHeight);
          return Math.min(Math.max(row, 0), STRINGS - 1) + 1;
        };
        // The caret a pointer event is over — the beat there, and the string
        // row at its height — hit-tested the way alphaTab does, against the
        // surface. Null where there is no beat (empty score, or no layout yet).
        // The Shift+press and the right-click both ask here, so they always
        // agree on what is under the pointer.
        const caretAtPointer = (e: MouseEvent): Caret | null => {
          const lookup = apiRef.current?.boundsLookup;
          const surface: HTMLElement | null = apiRef.current?.canvasElement?.element ?? containerRef.current;
          const box = surface?.getBoundingClientRect();
          if (!lookup || !box) return null;
          const y = e.clientY - box.top;
          const beat = lookup.getBeatAtPos(e.clientX - box.left, y);
          const bar = beat?.voice?.bar;
          if (!bar) return null;
          return caretFor(bar, beat, stringAt(lookup.findBeat(beat)?.barBounds, y));
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
          emitCaret(bar, beat, stringAt(barBounds, lastClickYRef.current));
        });

        // A left Shift+press extends the edit selection and is nothing else.
        // Handled whole here, in the capture phase on alphaTab's container:
        // stopping it before it reaches alphaTab's own capture listener on
        // the surface inside means no seek, no change to the practice loop
        // or its highlight, and no drag; preventing its default keeps the
        // page's text selection where it was. It is hit-tested the way
        // alphaTab does, against the surface (caretAtPointer). A press on no
        // beat does nothing.
        const onShiftPress = (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          const c = caretAtPointer(e);
          if (c) onShiftClickRef.current?.(c);
        };

        // Capture phase on the container, so this always runs before alphaTab's
        // own capture listener on the surface inside it for the same native
        // mousedown, giving the handlers above a fresh click-y and a clean
        // suppress flag for this gesture.
        const onMouseDownCapture = (e: MouseEvent) => {
          pressRef.current = null;
          if (e.button === 0 && e.shiftKey && onShiftClickRef.current) {
            onShiftPress(e);
            return;
          }
          suppressBeatHandlerRef.current = false;
          const rect = containerRef.current?.getBoundingClientRect();
          lastClickYRef.current = rect ? e.clientY - rect.top : null;
          // A plain left press: what the caret was before it, for its release.
          if (e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
            pressRef.current = { before: caretRef.current, landed: null };
          }
        };
        containerRef.current.addEventListener("mousedown", onMouseDownCapture, true);

        // A plain right-click on the score asks for the note menu: at the beat
        // it lands on (caretAtPointer, as for the Shift+press), or on empty
        // score at the caret. Linux and macOS fire contextmenu on the press,
        // Windows on the release; the menu is the editor's own (TabEditor keeps
        // it open past the release). Shift and the other modifiers ask for
        // nothing, and neither does a right-click on the strip under the score.
        const onContextMenu = (e: MouseEvent) => {
          const ask = onMenuRequestRef.current;
          if (!ask || e.button !== 2 || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
          if (footerRef.current?.contains(e.target as Node)) return;
          // A right-click on the panel's own scrollbar is not on the score.
          if (onOwnScrollbar(e.target, e)) return;
          e.preventDefault();
          // A right button pressed while the left is held (dragging out a practice loop) is no request.
          if (e.buttons & 1) return;
          const caret = caretAtPointer(e);
          if (!caret) {
            ask({ kind: "empty" });
            return;
          }
          const range = selectionRef.current;
          const inSelection = !!range && comparePos(range.from, caret) <= 0 && comparePos(caret, range.to) <= 0;
          ask({ kind: "beat", caret, inSelection });
        };
        const scroller = scrollRef.current;
        scroller?.addEventListener("contextmenu", onContextMenu);
        (api as any).__removeClickCapture = () => {
          containerRef.current?.removeEventListener("mousedown", onMouseDownCapture, true);
          scroller?.removeEventListener("contextmenu", onContextMenu);
        };

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
      previewSynthRef.current?.destroy();
      previewSynthRef.current = null;
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
  }, [applyTex, positionCaretOverlay, positionSelectionOverlay, playback]);

  // --- Swapping the sound bank while the api is alive. The bank a score
  // starts with is picked at init (settings.player.soundFont); this applies
  // every later change to the live synth: fetch the file, hand alphaTab the
  // bytes (append=false replaces the loaded bank), and let the readyForPlayback
  // handler above resume whatever playback the load stopped. The preview synth
  // follows the same choice so a clicked note sounds like the song it sits in.
  const applySoundBankSwap = useCallback((api: any, url: string) => {
    const id = ++soundFontSwapIdRef.current;
    void fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        // A superseded swap (the picker moved on mid-fetch) must not land out
        // of order behind the newer one.
        const live = apiRef.current;
        if (!live || id !== soundFontSwapIdRef.current) return;
        resumeAfterBankRef.current = isPlayingRef.current;
        previewSynthRef.current?.setSoundFontUrl(url);
        live.loadSoundFont(bytes, false);
      })
      .catch((err) => {
        if (id !== soundFontSwapIdRef.current) return;
        // The old bank is still loaded and playable; say so instead of
        // pretending the picker took effect. The preference itself stays on
        // the new choice — the picker is what the person asked for, and the
        // next load will try it again.
        console.warn("Could not load the selected sound bank", err);
      });
  }, []);

  useEffect(() => {
    const url = soundBankUrl ?? SOUND_FONT_URL;
    if (url === bankUrlRef.current) return;
    const api = apiRef.current;
    if (!api) {
      // Init has not built the api yet: its settings line reads bankUrlRef at
      // creation, so pointing it here makes the first load use the new bank.
      bankUrlRef.current = url;
      return;
    }
    if (!initialBankLoadedRef.current) {
      // alphaTab's own load of the init bank is still in flight. Handing it
      // replacement bytes now would race its XHR — whichever lands last
      // wins, and that could be the old bank. Park the request; the
      // soundFontLoaded handler below replays it once the first load reports.
      pendingBankUrlRef.current = url;
      return;
    }
    bankUrlRef.current = url;
    applySoundBankSwap(api, url);
  }, [soundBankUrl, applySoundBankSwap]);

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
    positionSelectionOverlay();
  }, [selection, positionSelectionOverlay]);

  useEffect(() => {
    onPlayingChange?.(isPlaying);
  }, [isPlaying, onPlayingChange]);

  useEffect(() => {
    previewSynthRef.current?.setVolume(volume ?? 1);
  }, [volume]);

  // The panel changing size moves the score on screen without a scroll: the
  // window, a notice appearing above the panel, the strip under the score
  // coming or going or wrapping. Observed again whenever the strip mounts or
  // unmounts; observing reports once at the start, which covers that change.
  const hasFooter = !!(barStatus || error);
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => onViewChangeRef.current?.());
    observer.observe(scroller);
    if (hasFooter && footerRef.current) observer.observe(footerRef.current);
    return () => observer.disconnect();
  }, [hasFooter]);

  const barClientRect = useCallback((at: BeatPos): ScreenRect | null => {
    const api = apiRef.current;
    const host = containerRef.current?.getBoundingClientRect();
    const beat = api?.score ? beatAt(api.score, { barIndex: at.barIndex, beatIndex: at.beatIndex, string: 1 }) : null;
    const bounds = beat ? api.boundsLookup?.findBeat(beat) : null;
    const bar = bounds?.barBounds?.visualBounds;
    if (!host || !bar) return null;
    const left = host.left + bounds.visualBounds.x;
    return {
      left,
      top: host.top + bar.y,
      width: Math.max(host.left + bar.x + bar.w - left, 0),
      height: Math.max(bar.h, 0),
    };
  }, []);

  const scoreClientRect = useCallback((): ScreenRect | null => {
    const scroller = scrollRef.current;
    if (!scroller) return null;
    const box = scroller.getBoundingClientRect();
    const left = Math.max(box.left + scroller.clientLeft, 0);
    const top = Math.max(box.top + scroller.clientTop, 0);
    const right = Math.min(box.left + scroller.clientLeft + scroller.clientWidth, window.innerWidth);
    const strip = footerRef.current?.getBoundingClientRect().top ?? Infinity;
    const bottom = Math.min(box.top + scroller.clientTop + scroller.clientHeight, strip, window.innerHeight);
    return { left, top, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0) };
  }, []);

  // The hook applies speed, looping and the volumes itself.

  // --- Behaviour 5 ---
  useImperativeHandle(
    ref,
    () => ({
      playPause: () => {
        const api = apiRef.current;
        if (!api) return;
        try {
          if (isPlayingRef.current) {
            api.pause();
          } else {
            // A preview still ringing would sound over the count-in.
            previewSynthRef.current?.stop();
            api.play();
          }
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
      previewBeat: (candidatesNewestFirst: Caret[]) => {
        const api = apiRef.current;
        const synth = previewSynthRef.current;
        // alphaTab reports Playing from the moment play() starts the count-in,
        // so this also covers the count-in.
        if (!api || !synth || isPlayingRef.current) return;
        // Always the Score just rendered: a Beat kept from before an edit is
        // accepted by alphaTab and would preview the old notes.
        const score = api.score;
        for (const candidate of candidatesNewestFirst) {
          if (!isPreviewable(score, candidate.barIndex)) continue;
          const beat = beatAt(score, candidate);
          if (beat && isAudible(beat)) {
            synth.play(beat);
            return;
          }
        }
      },
      stopPreview: () => previewSynthRef.current?.stop(),
      barClientRect,
      scoreClientRect,
      scrollBarIntoView: (barIndex: number) => {
        const scroller = scrollRef.current;
        const bar = barClientRect({ barIndex, beatIndex: 0 });
        const view = scoreClientRect();
        if (!scroller || !bar || !view) return;
        const MARGIN = 8;
        if (bar.top < view.top) {
          scroller.scrollTop -= view.top - bar.top + MARGIN;
        } else if (bar.top + bar.height > view.top + view.height) {
          scroller.scrollTop += Math.min(bar.top + bar.height - (view.top + view.height) + MARGIN, bar.top - view.top - MARGIN);
        }
      },
    }),
    [playback, barClientRect, scoreClientRect],
  );

  return (
    <div
      ref={scrollRef}
      onScroll={() => onViewChangeRef.current?.()}
      className="relative w-full h-full overflow-auto bg-gray-600 rounded border border-gray-500"
    >
      <style jsx global>{`
        .score-canvas-host {
          ${SCORE_SURFACE_CSS}
        }
      `}</style>
      {/*
        isolate makes this host a stacking context of its own. Without it,
        alphaTab's z-indexed nodes (rendered chunks 1, cursors 1000) and the
        sticky footer below share one stacking context — whichever ancestor
        makes it — where z-index 1 beats the footer's auto, so the score paints
        over the footer wherever the two overlap: staff lines through the
        strip, and a Fix all that cannot be clicked. With it, those z-indexes
        order only the score's own layers, and the footer, later in the
        document, paints over the whole host.
      */}
      <div className="score-canvas-host relative isolate">
        <div ref={containerRef} className="w-full" />
        {/* The edit selection: violet, so it is not the caret or the practice loop (blue), the playback bar (yellow) or a broken bar (red, amber). Drawn first, under the caret. */}
        {selectionBoxes.map((box, i) => (
          <div
            key={i}
            data-testid="edit-selection"
            className="absolute pointer-events-none"
            style={{
              left: box.left,
              top: box.top,
              width: box.width,
              height: box.height,
              backgroundColor: "rgba(139, 92, 246, 0.25)",
              border: "1px solid rgb(139, 92, 246)",
            }}
          />
        ))}
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
      {/*
        One sticky footer for both strips, so they stack rather than overlap.
        It stays in the flow after the score, so at the end of the scroll the
        last staff sits above it, never under it.
      */}
      {(barStatus || error) && (
        <div ref={footerRef} className="sticky bottom-0 left-0 right-0">
          {barStatus && <BarStatusStrip message={barStatus} onFixAll={onFixAll} />}
          {error && (
            <div className="bg-gray-900/90 text-red-400 text-xs px-2 py-1 border-t border-gray-500">{error}</div>
          )}
        </div>
      )}
    </div>
  );
});

export default ScoreCanvas;
