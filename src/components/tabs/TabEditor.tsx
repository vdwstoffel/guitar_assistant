"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import ScoreCanvas, { type ScoreCanvasHandle } from "./ScoreCanvas";
import PlaybackSpeedControl from "@/components/PlaybackSpeedControl";
import KeyboardShortcutsHelp from "@/components/KeyboardShortcutsHelp";
import TempoControl from "./TempoControl";
import { TAB_EDITOR_SHORTCUTS } from "./tabEditorShortcuts";
import { readTempo, setTempo } from "@/lib/tabscore/commands/tempo";
import { usePracticeSessionTracker } from "@/hooks/usePracticeSessionTracker";
import type { TrackableItem } from "@/lib/metrics/playedRef";
import { clampPlaybackSpeed } from "@/lib/playbackSpeed";
import SourcePane from "./SourcePane";
import TechniquePalette from "./TechniquePalette";
import TuningControl from "./TuningControl";
import PlaybackMixControl from "./PlaybackMixControl";
import RepeatBarsControl from "./RepeatBarsControl";

import { parseTex } from "@/lib/tabscore/parse";
import { normalizeNewlines } from "@/lib/tabscore/offsets";
import { clampCaret, type Caret } from "@/lib/tabscore/locate";
import { type CommandResult } from "@/lib/tabscore/apply";
import { matchChord } from "@/lib/tabscore/keymap";
import { claimGlobalShortcuts } from "@/lib/globalShortcuts";
import { setFret, clearNote } from "@/lib/tabscore/commands/setFret";
import { scaleDuration, toggleDotted } from "@/lib/tabscore/commands/duration";
import { insertBeat, deleteBeat, addBar, deleteBar } from "@/lib/tabscore/commands/structure";
import { isBarFull } from "@/lib/tabscore/barCapacity";
import { toggleTechnique, type Technique } from "@/lib/tabscore/commands/technique";
import { toggleTie } from "@/lib/tabscore/commands/tie";
import { toggleTuplet, tupletAt, TRIPLET } from "@/lib/tabscore/commands/tuplet";
import {
  subscribeMix,
  getMix,
  getServerMix,
  setMix,
  metronomeVolumeOf,
  countInVolumeOf,
  type MixPrefs,
} from "@/lib/tabscore/mixPrefs";
import { readTuningId, setTuning } from "@/lib/tabscore/commands/tuning";
import {
  toggleRepeatStart,
  toggleRepeatEnd,
  readBarRepeat,
} from "@/lib/tabscore/commands/repeat";
import { moveBeat, moveString } from "@/lib/tabscore/commands/navigate";

export interface TabEditorProps {
  initialTex: string;
  /** Stored practice speed as a whole percentage; null means never set. */
  initialSpeed?: number | null;
  /**
   * The track this tab belongs to, when the editor is opened from a song.
   * Drives practice-session tracking, so playing a tab here counts toward
   * lastPlayedAt the same way playing the audio does. Null from the
   * standalone /tabs route, which is an authoring surface rather than a
   * practice one.
   */
  track?: TrackableItem | null;
  /** Start with the AlphaTex source pane visible. */
  initialShowSource?: boolean;
  /**
   * Persists the whole editable state. Text and speed share one debounce,
   * one unmount flush and one beforeunload guard rather than racing each
   * other down two independent save paths.
   */
  onSave: (patch: { alphatex: string; playbackSpeed: number; tempo?: number }) => Promise<void>;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const HISTORY_LIMIT = 200;
const DIGIT_COMPOSE_MS = 800;
const AUTOSAVE_DELAY_MS = 1000;
const NOTICE_MS = 2500;
const PARSE_ERROR_NOTICE = "Fix the source errors to edit on the canvas";
// A tie sounds the PREVIOUS note on the same string again. With nothing
// earlier on that string alphaTex still accepts `-`, but renders it as an
// open string — so the command refuses, and this says why.
const NOTHING_TO_TIE_NOTICE = "Nothing earlier on this string to tie to";
const INITIAL_CARET: Caret = { barIndex: 0, beatIndex: 0, string: 6 };

const SAVE_LABEL: Record<SaveState, string | null> = {
  idle: null,
  saving: "Saving…",
  saved: "Saved",
  error: "Save failed",
};

/**
 * Orchestrator wiring the pure tabscore commands to ScoreCanvas and
 * SourcePane. `tex` is the single source of truth: canvas commands and
 * source-pane edits both funnel through `commitTex` below, and everything
 * else — the parse result, diagnostics, the caret — re-derives from it each
 * render.
 *
 * The keydown -> command mapping itself lives in `@/lib/tabscore/keymap`
 * (`matchChord`), not here — extracted in review round 3 after three prior
 * rounds of correctness fixes to this exact table were validated only by
 * hand-tracing (see task-14-report.md, "Fix rounds 1-3", and
 * `keymap.test.ts`'s exhaustive cross-product test). This component's job
 * is applying whatever `matchChord` resolves to: guarding it on the current
 * parse result, composing two-digit fret entry, and routing the result
 * through `commitTex`.
 */
export default function TabEditor({
  initialTex,
  initialSpeed,
  track = null,
  initialShowSource = true,
  onSave,
}: TabEditorProps) {
  const [tex, setTex] = useState(() => normalizeNewlines(initialTex));
  const [caret, setCaret] = useState<Caret>(INITIAL_CARET);
  // Read directly only to derive canUndo/canRedo for the toolbar buttons;
  // every other consumer of the undo timeline reads the ref copies below,
  // which are always current even inside a long-lived memoized callback.
  const [history, setHistory] = useState<string[]>(() => [normalizeNewlines(initialTex)]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const scoreCanvasRef = useRef<ScoreCanvasHandle>(null);
  const [speed, setSpeed] = useState(() => clampPlaybackSpeed(initialSpeed));
  const [isPlaying, setIsPlaying] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [looping, setLooping] = useState(false);
  // How loud the score and the click are: a listening preference kept in
  // localStorage, unlike the practice speed, which belongs to the tab. Read
  // through a store so the server's first render and the client's agree —
  // see mixPrefs.ts.
  const mix = useSyncExternalStore(subscribeMix, getMix, getServerMix);

  const updateMix = useCallback((patch: Partial<MixPrefs>) => {
    setMix({ ...getMix(), ...patch });
    containerRef.current?.focus();
  }, []);
  // Bars dragged out on the canvas to drill a section, zero-based inclusive.
  const [loopRange, setLoopRange] = useState<{ startBar: number; endBar: number } | null>(null);
  // How many times the repeat-bars button writes. Not derived from the
  // document: it is the NEXT value to write, which only matters until the
  // button is pressed. Once written, the score itself carries the count.
  const [repeatCount, setRepeatCount] = useState(2);
  const [showSource, setShowSource] = useState(initialShowSource);

  // Carried over from AlphaTexPlayer, which this replaces in the track
  // dialog: without it, practising a tab silently stops counting toward
  // lastPlayedAt and everything built on it (What to Practice Next,
  // in-progress state, revisit-tracks).
  const sessionTracker = usePracticeSessionTracker(track);
  const sessionTrackerRef = useRef(sessionTracker);

  const handlePlayingChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
    if (playing) sessionTrackerRef.current.onPlay();
    else sessionTrackerRef.current.onPause();
  }, []);

  const handleFinished = useCallback(() => {
    sessionTrackerRef.current.onFinish();
  }, []);
  // Mirrors texRef's purpose: performSave is created once and must read the
  // latest speed, not the one that existed at mount.
  const speedRef = useRef(speed);
  const lastHandledSpeedRef = useRef(clampPlaybackSpeed(initialSpeed));
  // Important, found in Task 18's browser walkthrough: nothing ever called
  // .focus() on the tabIndex={0} container below, so a click updated the
  // caret's logical position (via ScoreCanvas's onCaretChange) but never
  // made the container the active element — the very next keystroke had
  // nowhere to go. See the onMouseDown on that div for the fix.
  const containerRef = useRef<HTMLDivElement>(null);

  // Latest-value refs so the keydown handler (created once, see the bottom
  // of this file) and the debounced timers never close over stale state.
  // Synced in the effect below rather than unconditionally in the render
  // body: eslint-plugin-react-hooks 7's `react-hooks/refs` rule treats a
  // top-level `ref.current = x` in a render body as a render-purity
  // violation. (ScoreCanvas.tsx uses that same placement for the same
  // pattern and isn't flagged, but only because that rule's component
  // detection doesn't currently look inside a forwardRef(...) wrapper — not
  // because the placement is sound.) Every consumer of these refs here is
  // an event handler or another effect, never the render body itself, so
  // moving the writes into an effect (which always runs after the commit
  // those handlers/effects follow) costs nothing.
  const texRef = useRef(tex);
  const caretRef = useRef(caret);
  const historyRef = useRef<string[]>([tex]);
  const historyIndexRef = useRef(0);
  const onSaveRef = useRef(onSave);

  const digitBufferRef = useRef<{ digits: string; at: number } | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The last `tex` the autosave effect below actually scheduled a save
  // for — NOT a one-shot "have I mounted yet" boolean. See that effect's
  // comment for why the distinction matters under Strict Mode.
  const lastHandledTexRef = useRef(tex);

  // Shared once per render: SourcePane's diagnostics, TechniquePalette's
  // disabled state, and the keyboard guard below all read this one result
  // instead of each calling parseTex again (~2.7ms on a 300-bar document —
  // fine once per render, wasteful several times).
  const parsed = useMemo(() => parseTex(tex), [tex]);
  // The notated tempo lives in the document, so it is derived rather than
  // held in state — editing it is an ordinary, undoable text edit. null means
  // the tab has no \tempo directive, and the control disables itself rather
  // than failing silently on every press.
  const tempo = useMemo(
    () => (parsed.ok ? readTempo(tex, parsed.scoreNode) : null),
    [tex, parsed],
  );
  // Also derived from the document rather than held in state, for the same
  // reason as the tempo: it IS a directive in the text. null means the tab
  // carries a tuning no preset names, which the control shows as "Custom".
  const tuningId = useMemo(
    () => (parsed.ok ? readTuningId(tex, parsed.scoreNode) : null),
    [tex, parsed],
  );
  // Synced in the effect below with the rest, not during render: the
  // handlers that read them only ever fire from a click, long after it.
  const repeatCountRef = useRef(repeatCount);
  const barRepeatRef = useRef<{ open: boolean; count: number | null }>({
    open: false,
    count: null,
  });
  const shownRepeatCountRef = useRef(repeatCount);
  const tempoRef = useRef(tempo);
  const parsedRef = useRef(parsed);

  useEffect(() => {
    texRef.current = tex;
    caretRef.current = caret;
    onSaveRef.current = onSave;
    speedRef.current = speed;
    parsedRef.current = parsed;
    tempoRef.current = tempo;
    repeatCountRef.current = repeatCount;
    sessionTrackerRef.current = sessionTracker;
  });

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

  // Behaviour 1 (state) + Behaviour 5 (undo history). One path for every
  // source of a `tex` change — a canvas command's result and SourcePane's
  // onChange both call this — so undo never silently discards text typed
  // into the source pane between two canvas commands. Reads and writes refs
  // directly rather than a functional setState updater: React may invoke a
  // functional updater twice under StrictMode, which would double-push
  // history.
  const commitTex = useCallback((nextText: string, nextCaret?: Caret) => {
    const prevText = texRef.current;
    if (nextText !== prevText) {
      const base = historyRef.current.slice(0, historyIndexRef.current + 1);
      let nextHistory = [...base, nextText];
      if (nextHistory.length > HISTORY_LIMIT) {
        nextHistory = nextHistory.slice(nextHistory.length - HISTORY_LIMIT);
      }
      const nextIndex = nextHistory.length - 1;
      historyRef.current = nextHistory;
      historyIndexRef.current = nextIndex;
      texRef.current = nextText;
      setHistory(nextHistory);
      setHistoryIndex(nextIndex);
      setTex(nextText);
    }
    if (nextCaret) {
      caretRef.current = nextCaret;
      setCaret(nextCaret);
    }
  }, []);

  const undo = useCallback(() => {
    // Minor (review round 3): clear unconditionally, even on the no-op
    // (idx <= 0) path — pressing undo at all is a signal the user has moved
    // on from composing a fret digit, whether or not there was anything to
    // undo. Without this, "1", Ctrl+Z, "2" within 800ms composed "12" onto
    // whatever the undo landed on, instead of the "2" the user actually
    // typed.
    digitBufferRef.current = null;
    const idx = historyIndexRef.current;
    if (idx <= 0) return;
    const nextText = historyRef.current[idx - 1];
    historyIndexRef.current = idx - 1;
    texRef.current = nextText;
    setHistoryIndex(idx - 1);
    setTex(nextText);
  }, []);

  const redo = useCallback(() => {
    digitBufferRef.current = null; // see undo's comment above
    const idx = historyIndexRef.current;
    const h = historyRef.current;
    if (idx >= h.length - 1) return;
    const nextText = h[idx + 1];
    historyIndexRef.current = idx + 1;
    texRef.current = nextText;
    setHistoryIndex(idx + 1);
    setTex(nextText);
  }, []);

  // Behaviour 3's "clear the buffer on any caret move," shared by arrow-key
  // navigation and canvas clicks (ScoreCanvas's onCaretChange) alike.
  const moveCaret = useCallback((next: Caret) => {
    digitBufferRef.current = null;
    caretRef.current = next;
    setCaret(next);
  }, []);

  // Re-clamp the caret whenever the document reparses successfully. A
  // SourcePane edit can shrink the document below wherever the caret was
  // sitting; the next canvas keystroke should target a real position, not a
  // stale one.
  useEffect(() => {
    if (!parsed.ok || !parsed.scoreNode) return;
    const c = caretRef.current;
    const clamped = clampCaret(parsed.scoreNode, c);
    if (
      clamped.barIndex !== c.barIndex ||
      clamped.beatIndex !== c.beatIndex ||
      clamped.string !== c.string
    ) {
      caretRef.current = clamped;
      setCaret(clamped);
    }
  }, [parsed]);

  // Transport. The handle methods have existed since Task 12; until now
  // nothing called stop() at all and playPause() was reachable only via
  // Space, which no on-screen control advertised.
  // While this editor is on screen it owns the keyboard shortcuts that
  // BottomPlayer binds to `window` — Space above all. The container handler
  // below only fires when the canvas has focus, so without this, pressing
  // Space straight after opening the editor, or after any toolbar click,
  // started the TRACK playing instead of the tab.
  useEffect(() => claimGlobalShortcuts(), []);

  const handlePlayPause = useCallback(() => {
    scoreCanvasRef.current?.playPause();
    // Keep focus on the canvas so Space stays meaningful after a click;
    // otherwise focus sits on the button and Space just re-presses it.
    containerRef.current?.focus();
  }, []);

  // The other half of that: with the player stood down, something still has
  // to act on Space when focus is elsewhere in the editor. Bound in the
  // bubble phase, so the container handler below — which stops propagation —
  // keeps its claim whenever the canvas does have focus.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      // Space types a space in the source pane and the tempo box.
      if (el?.closest("input, textarea, [contenteditable]")) return;
      // Only transport. Everything else the keymap resolves is about the
      // caret, which has no meaning when the canvas is not focused.
      if (matchChord({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
      })?.kind !== "playPause") {
        return;
      }
      event.preventDefault();
      handlePlayPause();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const handleStop = useCallback(() => {
    scoreCanvasRef.current?.stop();
    containerRef.current?.focus();
  }, []);

  // Dragging out a section is only ever done in order to drill it, so it
  // turns Repeat on by itself; clearing the section leaves Repeat alone,
  // since by then it is an ordinary whole-score repeat the user can see.
  const handleLoopChange = useCallback(
    (range: { startBar: number; endBar: number } | null) => {
      setLoopRange(range);
      if (range) setLooping(true);
    },
    [],
  );

  const handleClearLoop = useCallback(() => {
    scoreCanvasRef.current?.clearLoop();
    containerRef.current?.focus();
  }, []);

  // Structure, exposed as buttons because the only way to reach these was
  // Insert / Ctrl+Enter / Shift+Delete / Ctrl+Shift+Backspace, and nothing
  // on screen said so — a filled bar looked like the end of the tab.
  const runStructural = useCallback(
    (fn: (text: string, caret: Caret) => CommandResult | null) => {
      if (!parsedRef.current.ok) {
        showNotice(PARSE_ERROR_NOTICE);
        return;
      }
      const result = fn(texRef.current, caretRef.current);
      if (result) commitTex(result.text, result.caret);
    },
    [commitTex, showNotice],
  );

  // Editing the written tempo is an ordinary document edit: it goes through
  // commitTex, so it lands in undo history and the autosave like any other.
  const handleTempoChange = useCallback((bpm: number) => {
    const result = setTempo(texRef.current, bpm, caretRef.current);
    if (result) commitTex(result.text, result.caret);
  }, [commitTex]);

  // Repeat signs go on the bar the caret is in — start and end are marked
  // separately, so there is nothing to select in between. The drag-selected
  // range stays what it is: a practice loop, not notation.
  const barRepeat = useMemo(
    () =>
      parsed.ok && parsed.scoreNode
        ? readBarRepeat(tex, parsed.scoreNode, caret.barIndex)
        : { open: false, count: null },
    [tex, parsed, caret.barIndex],
  );

  // Once a bar closes a repeat, its count lives in the score — show that
  // rather than a stale local value, so the button reads as a toggle.
  const shownRepeatCount = barRepeat.count ?? repeatCount;

  // Its own effect rather than the shared sweep above, which runs before
  // these are computed. The handlers reading them only fire from a click.
  useEffect(() => {
    barRepeatRef.current = barRepeat;
    shownRepeatCountRef.current = shownRepeatCount;
  });

  const handleRepeatCountChange = useCallback(
    (next: number) => {
      setRepeatCount(next);
      // Already marked: rewrite in place, so changing 2 to 4 is one action
      // rather than un-marking and re-marking.
      if (barRepeatRef.current.count === null) return;
      const result = toggleRepeatEnd(
        texRef.current,
        caretRef.current,
        caretRef.current.barIndex,
        next,
      );
      if (result) commitTex(result.text, result.caret);
    },
    [commitTex],
  );

  const handleToggleRepeatStart = useCallback(() => {
    const result = toggleRepeatStart(texRef.current, caretRef.current, caretRef.current.barIndex);
    if (result) commitTex(result.text, result.caret);
    containerRef.current?.focus();
  }, [commitTex]);

  const handleToggleRepeatEnd = useCallback(() => {
    const result = toggleRepeatEnd(
      texRef.current,
      caretRef.current,
      caretRef.current.barIndex,
      shownRepeatCountRef.current,
    );
    if (result) commitTex(result.text, result.caret);
    containerRef.current?.focus();
  }, [commitTex]);

  const handleTuningChange = useCallback((presetId: string) => {
    const result = setTuning(texRef.current, presetId, caretRef.current);
    if (result) commitTex(result.text, result.caret);
    containerRef.current?.focus();
  }, [commitTex]);

  // The one place that actually calls onSave. Always reads the LATEST text
  // via texRef, never a closed-over `tex` — that's what makes it safe to
  // reuse unchanged from the unmount/beforeunload flush below, whose own
  // closures are created once, at mount (empty/stable deps), and would
  // otherwise see only the `tex` that existed then, forever.
  const performSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setSaveState("saving");
    onSaveRef
      .current({
        alphatex: texRef.current,
        playbackSpeed: speedRef.current,
        ...(tempoRef.current !== null ? { tempo: tempoRef.current } : {}),
      })
      .then(() => setSaveState("saved"))
      .catch(() => setSaveState("error"));
  }, []);

  // Behaviour 6: debounced autosave, ~1s after the last change. Skips
  // scheduling when `tex` hasn't actually changed since the last time this
  // effect acted, so loading a document doesn't immediately re-save it
  // unchanged. Deliberately does NOT gate on `parsed.ok` — the spec calls
  // for saving even an unparseable draft, since losing work is worse.
  //
  // Minor (review round 3): a plain "have I mounted yet" boolean, flipped
  // inside this same effect body, is NOT Strict-Mode-safe — dev-mode
  // double-invokes a fresh mount's effects (mount, cleanup, mount again,
  // for the SAME `tex`), and a one-shot flag is already consumed by the
  // first of those two invocations, so the second sees the flag already
  // flipped and incorrectly schedules a save of the still-untouched,
  // just-loaded document. Comparing against `lastHandledTexRef` instead —
  // the actual VALUE last acted on, only updated on the non-skipped path —
  // has no such state to desync: both synthetic invocations see the same
  // `tex` they're already recorded against and both skip, while a later,
  // real edit (including one that happens to revert back to the original
  // text) is still correctly seen as different from whatever this effect
  // most recently handled.
  useEffect(() => {
    if (tex === lastHandledTexRef.current && speed === lastHandledSpeedRef.current) {
      return;
    }
    lastHandledTexRef.current = tex;
    lastHandledSpeedRef.current = speed;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(performSave, AUTOSAVE_DELAY_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [tex, speed, performSave]);

  // CRITICAL (review round 1): the cleanup above cancels a pending timer on
  // every `tex` change (correct there — a fresh one is about to be scheduled
  // for the new text) AND on unmount (wrong there — cancelling with no
  // flush silently discards up to ~1s of unsaved edits: an SPA route change,
  // a tab close, or a parent remounting this component via a changed `key`).
  // This SEPARATE effect exists solely to flush a still-pending save at the
  // two points the effect above cannot tell apart from an ordinary debounce
  // restart. Its deps array is `[performSave]`, not `[]`, to satisfy
  // exhaustive-deps honestly — but `performSave` never changes identity
  // (its own deps are `[]`), so in effect this still only runs once, at
  // mount, and only cleans up once, at true unmount, exactly as a
  // mount-scoped effect would.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!saveTimerRef.current) return; // nothing pending — nothing to warn about
      performSave();
      // Best effort only: beforeunload cannot await the request this starts
      // firing, and the browser may abort it the instant the page actually
      // unloads. Prompting to confirm is the only way to give it a real
      // chance to finish — by giving the user the option to stay.
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (saveTimerRef.current) performSave();
    };
  }, [performSave]);

  const handleSourceChange = useCallback(
    (nextTex: string) => {
      // Belt-and-suspenders: a textarea's onChange value is already
      // LF-normalised per spec, but this exact CRLF/offset hazard has
      // already bitten this codebase three times (see
      // task-13-fix-report.md) — closing it at every boundary that writes
      // `tex` costs one idempotent replace.
      commitTex(normalizeNewlines(nextTex));
    },
    [commitTex],
  );

  // Whether the caret's beat is already in a triplet, so the button reads
  // as a toggle rather than leaving the user guessing.
  const tuplet = useMemo(
    () => (parsed.ok && parsed.scoreNode ? tupletAt(tex, parsed.scoreNode, caret) : null),
    [tex, parsed, caret],
  );

  const handleTupletSelect = useCallback(() => {
    digitBufferRef.current = null;
    if (!parsedRef.current.ok) {
      showNotice(PARSE_ERROR_NOTICE);
      return;
    }
    const result = toggleTuplet(texRef.current, caretRef.current, TRIPLET);
    if (result) commitTex(result.text, result.caret);
  }, [commitTex, showNotice]);

  const handleTieSelect = useCallback(() => {
    digitBufferRef.current = null;
    if (!parsedRef.current.ok) {
      showNotice(PARSE_ERROR_NOTICE);
      return;
    }
    const result = toggleTie(texRef.current, caretRef.current);
    if (result) commitTex(result.text, result.caret);
    else showNotice(NOTHING_TO_TIE_NOTICE);
  }, [commitTex, showNotice]);

  const handleTechniqueSelect = useCallback(
    (technique: Technique) => {
      digitBufferRef.current = null;
      const result = toggleTechnique(texRef.current, caretRef.current, technique);
      if (result) commitTex(result.text, result.caret);
    },
    [commitTex],
  );

  // Behaviours 2 + 4. Bound on this component's own container below, NOT
  // `window`: BottomPlayer.tsx already owns a window-level Space (play/
  // pause) and ArrowLeft (seek) handler, so a second window-level binding
  // here would double-fire both. stopPropagation (in addition to
  // preventDefault, which only suppresses the browser's own default action)
  // keeps every handled key scoped to this container instead of continuing
  // to bubble up to that handler.
  const handleCanvasKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const command = matchChord({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
      });
      if (!command) return; // Not one of ours — let it bubble (Tab, or any unbound chord).

      event.preventDefault();
      event.stopPropagation();

      // Exempt from the parsing guard below: undo/redo replay committed
      // history snapshots — never the current, possibly-broken, text — and
      // playback controls whatever ScoreCanvas last rendered successfully.
      // Neither reads the current (possibly stale/absent) AST, so neither
      // is subject to the "stale AST" hazard the guard exists to prevent.
      if (command.kind === "undo") {
        undo();
        return;
      }
      if (command.kind === "redo") {
        redo();
        return;
      }
      if (command.kind === "playPause") {
        digitBufferRef.current = null; // see undo's comment above
        scoreCanvasRef.current?.playPause();
        return;
      }
      // Also exempt, and for a stronger reason than the three above: the
      // help panel reads nothing from the document. Gating it on a parsing
      // document would hide the shortcut list exactly when a confused user
      // most needs it.
      if (command.kind === "showHelp") {
        digitBufferRef.current = null;
        setShowHelp((prev) => !prev);
        return;
      }

      // Behaviour 4 / Review Focus item 5, this task's namesake: every
      // remaining command reads or writes through the current AST —
      // moveBeat/moveString included, since a caret silently frozen in
      // place while the document doesn't parse is the same "feels broken"
      // failure as a rejected edit.
      if (!parsedRef.current.ok) {
        digitBufferRef.current = null;
        showNotice(PARSE_ERROR_NOTICE);
        return;
      }

      const text = texRef.current;
      const c = caretRef.current;
      const applyResult = (result: CommandResult | null) => {
        if (result) commitTex(result.text, result.caret);
      };

      if (command.kind === "setFret") {
        // Behaviour 3: two-digit fret entry. The first digit always applies
        // on its own; a second digit within the window on the same caret
        // (never moved in between — see moveCaret) composes with it. A
        // third rapid digit would need 3+ characters, which can never be a
        // valid fret (max 24), so it starts fresh instead of composing
        // rather than silently failing.
        const now = Date.now();
        const buf = digitBufferRef.current;
        const digit = String(command.digit);
        const digits =
          buf && buf.digits.length < 2 && now - buf.at <= DIGIT_COMPOSE_MS
            ? buf.digits + digit
            : digit;
        digitBufferRef.current = { digits, at: now };
        applyResult(setFret(text, c, Number(digits)));
        return;
      }
      if (command.kind === "moveBeat") {
        const moved = moveBeat(text, c, command.delta);
        // moveBeat deliberately stops at the document's edges. Stopping is
        // right going backwards, but going forwards it dead-ends note entry:
        // the natural flow is type, right, type, right, and at the last beat
        // that simply stopped with nothing on screen explaining why. Extend
        // instead, so the score grows as you write it.
        const atEnd =
          command.delta === 1 &&
          moved.barIndex === c.barIndex &&
          moved.beatIndex === c.beatIndex;
        if (atEnd) {
          // Parse `text` freshly rather than reading parsedRef: commitTex
          // updates texRef eagerly but parsedRef only after the next render,
          // so while typing at speed the memoised parse can be one edit
          // behind — and "is this bar full?" would then be answered about
          // the previous state.
          const fresh = parseTex(text);
          const full = fresh.ok && isBarFull(fresh.score, c.barIndex);
          // A bar that already holds its time signature's worth should roll
          // over rather than keep accepting beats past the bar line.
          const grown = full ? addBar(text, c) : insertBeat(text, c);
          if (grown) {
            // Same reason moveCaret clears it: the caret is moving, so a
            // half-typed fret must not compose with the next digit. Without
            // this, typing 7 → 9 composed "79", which exceeds fret 24, and
            // setFret rejected it — the keystroke vanished with no feedback.
            digitBufferRef.current = null;
            commitTex(grown.text, grown.caret);
            return;
          }
        }
        moveCaret(moved);
        return;
      }
      if (command.kind === "moveString") {
        moveCaret(moveString(c, command.delta));
        return;
      }

      // Every remaining command is a discrete action, not a composition —
      // clear the buffer once, up front, rather than repeating it per case.
      digitBufferRef.current = null;
      switch (command.kind) {
        case "clearNote":
          applyResult(clearNote(text, c));
          return;
        case "insertBeat":
          applyResult(insertBeat(text, c));
          return;
        case "deleteBeat":
          applyResult(deleteBeat(text, c));
          return;
        case "addBar":
          applyResult(addBar(text, c));
          return;
        case "deleteBar":
          applyResult(deleteBar(text, c));
          return;
        case "scaleDuration":
          applyResult(scaleDuration(text, c, command.direction));
          return;
        case "toggleDotted":
          applyResult(toggleDotted(text, c));
          return;
        case "toggleTechnique":
          applyResult(toggleTechnique(text, c, command.technique));
          return;
        case "toggleTuplet":
          applyResult(toggleTuplet(text, c, TRIPLET));
          return;
        case "toggleTie": {
          // Not applyResult: a null here has a specific, actionable cause —
          // there is no earlier note on this string — and saying so beats
          // the generic "that did nothing".
          const tied = toggleTie(text, c);
          if (tied) commitTex(tied.text, tied.caret);
          else showNotice(NOTHING_TO_TIE_NOTICE);
          return;
        }
        default: {
          // Exhaustiveness check: a compile error here means a new
          // ChordCommand kind was added to keymap.ts without being handled
          // above (undo/redo/playPause/setFret/moveBeat/moveString are
          // narrowed out by the early returns above this switch).
          const exhaustiveCheck: never = command;
          return exhaustiveCheck;
        }
      }
    },
    [commitTex, moveCaret, showNotice, undo, redo],
  );

  const saveLabel = SAVE_LABEL[saveState];
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  // Derived at render time rather than cleared via an effect keyed on
  // parsed.ok: the parse-error banner should disappear the instant the
  // document parses again, and computing that as a display-time filter needs
  // no effect at all (its pending auto-clear timeout, set by showNotice,
  // still fires harmlessly later — notice is already masked by then).
  //
  // The mask applies to THAT message only. Every other notice reports a
  // command that declined to act on a document which parses perfectly well
  // — the tie with nothing to tie to — and a blanket `parsed.ok ? null`
  // swallowed all of them, so the key looked simply broken.
  const displayedNotice =
    notice === PARSE_ERROR_NOTICE && parsed.ok ? null : notice;

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      {/*
        Clicking any toolbar button moves focus to that button, and the
        keyboard model lives on the canvas below — so after pressing, say,
        Palm mute, the arrow keys and fret digits silently stopped working
        until the user clicked the score again. Returning focus here covers
        every control at once (techniques, undo/redo, transport, the speed
        presets and tempo steppers) rather than each handler remembering.

        onMouseUp, not onFocus/onClick: it fires only for pointer use, so
        Tab-key navigation through the toolbar is left alone. Text inputs are
        excluded or the tempo and speed boxes could never be typed into, and
        so is `select` — pulling focus away from a <select> on mouseup closes
        its dropdown the instant it opens, which made the tuning picker look
        broken.
      */}
      <div
        className="flex flex-col gap-1.5"
        onMouseUp={(e) => {
          const el = e.target as HTMLElement | null;
          if (el?.closest("input, textarea, select")) return;
          containerRef.current?.focus();
        }}
      >
      {/*
        Two rows, not one: play/tempo/tuning/speed are settings you reach for
        between takes, while beats, bars, repeats and techniques are what you
        press while writing. Crammed onto one line the fourteen technique
        buttons wrapped into a narrow four-row block wedged against the right
        edge — the layout the user called cluttered.
      */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!parsed.ok}
            onClick={handlePlayPause}
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="px-2 py-1 text-xs rounded bg-gray-600 border border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-600 disabled:hover:text-gray-300"
          >
            {isPlaying ? "⏸ Pause" : "▶ Play"}
          </button>
          <button
            type="button"
            disabled={!parsed.ok}
            onClick={handleStop}
            title="Stop"
            aria-label="Stop"
            className="px-2 py-1 text-xs rounded bg-gray-600 border border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-600 disabled:hover:text-gray-300"
          >
            ⏹ Stop
          </button>
          <button
            type="button"
            onClick={() => setLooping((prev) => !prev)}
            title={looping ? "Repeat on" : "Repeat off"}
            aria-label="Repeat"
            aria-pressed={looping}
            className={`px-2 py-1 text-xs rounded border focus:outline-none focus:border-blue-500 ${
              looping
                ? "bg-green-700 border-green-600 text-white hover:bg-green-600"
                : "bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white"
            }`}
          >
            ⟳ Repeat
          </button>
          {loopRange && (
            <span className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-900/60 border border-blue-700 text-blue-200">
              {loopRange.startBar === loopRange.endBar
                ? `Bar ${loopRange.startBar + 1}`
                : `Bars ${loopRange.startBar + 1}–${loopRange.endBar + 1}`}
              <button
                type="button"
                onClick={handleClearLoop}
                title="Clear practice section"
                aria-label="Clear practice section"
                className="text-blue-300 hover:text-white leading-none"
              >
                ✕
              </button>
            </span>
          )}
        </div>
        <TempoControl tempo={tempo} onChange={handleTempoChange} disabled={!parsed.ok} />
        <TuningControl tuningId={tuningId} onChange={handleTuningChange} disabled={!parsed.ok} />
        <PlaybackSpeedControl speed={speed} onChange={setSpeed} />
        <PlaybackMixControl
          volume={mix.volume}
          onVolumeChange={(volume) => updateMix({ volume })}
          metronome={mix.metronome}
          metronomeOn={mix.metronomeOn}
          onMetronomeToggle={() => updateMix({ metronomeOn: !mix.metronomeOn })}
          // Dragging the slider to the bottom is a mute, not an "off" — the
          // toggle owns that, and a stored zero would leave the slider with
          // nothing to restore. See mixPrefs.ts.
          onMetronomeChange={(metronome) => updateMix({ metronome: Math.max(0.05, metronome) })}
          countIn={mix.countIn}
          onCountInToggle={() => updateMix({ countIn: !mix.countIn })}
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canUndo}
            onClick={undo}
            title="Undo (Ctrl+Z)"
            className="px-2 py-1 text-xs rounded bg-gray-600 border border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-600 disabled:hover:text-gray-300"
          >
            ↶ Undo
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={redo}
            title="Redo (Ctrl+Shift+Z)"
            className="px-2 py-1 text-xs rounded bg-gray-600 border border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-600 disabled:hover:text-gray-300"
          >
            ↷ Redo
          </button>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowSource((prev) => !prev)}
            title={showSource ? "Hide the AlphaTex source" : "Show the AlphaTex source"}
            aria-label="Toggle source"
            aria-pressed={showSource}
            className={`px-2 py-1 text-xs rounded border focus:outline-none focus:border-blue-500 ${
              showSource
                ? "bg-gray-500 border-gray-400 text-white"
                : "bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white"
            }`}
          >
            {"</>"} Source
          </button>
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            className="px-2 py-1 text-xs rounded bg-gray-600 border border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white focus:outline-none focus:border-blue-500"
          >
            ? Shortcuts
          </button>
          <div className="flex items-center gap-2 text-xs pl-1" aria-live="polite">
            {saveLabel && (
              <span className={saveState === "error" ? "text-red-400" : "text-gray-400"}>
                {saveLabel}
              </span>
            )}
            {saveState === "error" && (
              <button
                type="button"
                onClick={performSave}
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <div className="flex items-center gap-1">
          {(
            [
              ["+ Beat", "Insert a beat after the caret (Insert, or → at the end)", insertBeat],
              ["− Beat", "Delete the beat at the caret (Shift+Delete)", deleteBeat],
              ["+ Bar", "Add a bar at the end (Ctrl+Enter)", addBar],
              ["− Bar", "Delete the bar at the caret (Ctrl+Shift+Backspace)", deleteBar],
            ] as const
          ).map(([label, title, fn]) => (
            <button
              key={label}
              type="button"
              disabled={!parsed.ok}
              onClick={() => runStructural(fn)}
              title={title}
              className="px-2 py-1 text-xs rounded bg-gray-600 border border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-600 disabled:hover:text-gray-300"
            >
              {label}
            </button>
          ))}
        </div>
        <RepeatBarsControl
          barIndex={caret.barIndex}
          startOn={barRepeat.open}
          endCount={barRepeat.count}
          count={shownRepeatCount}
          onCountChange={handleRepeatCountChange}
          onToggleStart={handleToggleRepeatStart}
          onToggleEnd={handleToggleRepeatEnd}
          disabled={!parsed.ok}
        />
        <span className="w-px self-stretch bg-gray-700" aria-hidden />
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={!parsed.ok}
            onClick={handleTieSelect}
            title="Tie to the previous note on this string (i)"
            className="px-2 py-1 text-xs rounded bg-gray-600 border border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-600 disabled:hover:text-gray-300"
          >
            Tie<span className="ml-1 text-gray-500">i</span>
          </button>
          <button
            type="button"
            disabled={!parsed.ok}
            onClick={handleTupletSelect}
            aria-pressed={tuplet === TRIPLET}
            title="Triplet — make this beat and the next two one group (u)"
            className={`px-2 py-1 text-xs rounded border focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed ${
              tuplet === TRIPLET
                ? "bg-purple-800 border-purple-600 text-white hover:bg-purple-700"
                : "bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white"
            }`}
          >
            Triplet<span className="ml-1 text-gray-500">u</span>
          </button>
          <TechniquePalette disabled={!parsed.ok} onSelect={handleTechniqueSelect} />
        </div>
      </div>
      </div>

      {displayedNotice && (
        <div
          role="status"
          className="text-xs text-amber-400 bg-gray-800 border border-amber-500/40 rounded px-2 py-1"
        >
          {displayedNotice}
        </div>
      )}

      {/*
        Invariant load-bearing for BOTH keyboard and mouse isolation:
        onKeyDown and onMouseDown below must stay on a div whose only
        descendant is ScoreCanvas. SourcePane is a SIBLING, not nested
        inside it — an event targeting its <textarea> bubbles up through
        SourcePane's own wrapper and never enters this div's subtree, so
        neither handler can fire for it (structural, not timing-dependent:
        React's synthetic dispatch walks the same ancestor chain a native
        bubble would). Typing "3" or pressing Backspace in the source pane
        edits the textarea normally, never setFret/clearNote on the canvas;
        clicking into the textarea leaves focus there, never stealing it
        via containerRef.current.focus() below. Moving SourcePane inside
        this div would silently break both guarantees at once.
      */}
      <div className="flex flex-1 min-h-0 gap-3">
        <div
          ref={containerRef}
          role="group"
          aria-label="Tab canvas"
          tabIndex={0}
          onKeyDown={handleCanvasKeyDown}
          // Important, Task 18: a click alone never focused this element —
          // tabIndex makes it focusable, not auto-focused on click, and
          // nothing else here called .focus(). onMouseDown (not onClick) so
          // focus lands before any keystroke can follow the same gesture;
          // the containerRef, not e.currentTarget, so this keeps working if
          // the handler is ever attached somewhere other than the element
          // that actually holds the tabIndex. No preventDefault: that would
          // break text selection and alphaTab's own mouse handling (see
          // ScoreCanvas's noteMouseDown/beatMouseDown).
          onMouseDown={() => containerRef.current?.focus()}
          // Minor (review round 3): `focus:outline-none` alone removed the
          // browser default with nothing standing in for it — a keyboard-
          // driven region with no visible focus affordance is unusable,
          // since there was no way to tell it had focus (and would accept
          // the whole chord table above) versus not. `ring` rather than
          // `border` so the indicator doesn't add to the box's layout size.
          // Now that a click actually calls .focus() above, this is what
          // makes that visible.
          className="flex-1 min-w-0 min-h-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <ScoreCanvas
            ref={scoreCanvasRef}
            tex={tex}
            caret={caret}
            onCaretChange={moveCaret}
            onPlayingChange={handlePlayingChange}
            onFinished={handleFinished}
            speed={speed}
            looping={looping}
            volume={mix.volume}
            metronomeVolume={metronomeVolumeOf(mix)}
            countInVolume={countInVolumeOf(mix)}
            onLoopChange={handleLoopChange}
          />
        </div>
        {showSource && (
          <div className="w-[420px] shrink-0 min-h-0">
            <SourcePane tex={tex} diagnostics={parsed.diagnostics} onChange={handleSourceChange} />
          </div>
        )}
      </div>
      <KeyboardShortcutsHelp
        isOpen={showHelp}
        onClose={() => {
          setShowHelp(false);
          // Send focus back to the canvas, or the keyboard would be dead
          // until the user clicks — the same trap the transport buttons hit.
          containerRef.current?.focus();
        }}
        groups={TAB_EDITOR_SHORTCUTS}
        title="Tab editor shortcuts"
      />
    </div>
  );
}
