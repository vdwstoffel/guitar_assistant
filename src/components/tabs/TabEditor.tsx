"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";

import ScoreCanvas, { type MenuRequest, type ScoreCanvasHandle } from "./ScoreCanvas";
import NoteMenu, { type NoteMenuHandle } from "./NoteMenu";
import { onOwnScrollbar } from "./ownScrollbar";
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
import TimeSignatureControl from "./TimeSignatureControl";

import { parseTex } from "@/lib/tabscore/parse";
import { normalizeNewlines } from "@/lib/tabscore/offsets";
import { clampCaret, type BeatPos, type Caret } from "@/lib/tabscore/locate";
import { claims, clipboardChord, matchChord, type ChordCommand } from "@/lib/tabscore/keymap";
import { menuItems, menuStaysOpen, type MenuGroup, type MenuItem } from "@/lib/tabscore/menuItems";
import { rangeOf, sizeOf, stillValid } from "@/lib/tabscore/selection";
import { SELECTION_CLEARED, selectionAnnouncement } from "@/lib/tabscore/clipMessages";
import {
  createPreviewScheduler,
  previewAction,
  type PreviewScheduler,
  type PreviewSource,
} from "@/lib/tabscore/notePreview";
import { claimGlobalShortcuts } from "@/lib/globalShortcuts";
import { type Technique } from "@/lib/tabscore/commands/technique";
import { tupletAt, TRIPLET } from "@/lib/tabscore/commands/tuplet";
import { fixAllBars } from "@/lib/tabscore/commands/fixBar";
import { brokenBars } from "@/lib/tabscore/barFill";
import { fixAllNotice, stripMessage } from "@/lib/tabscore/barMessages";
import { NOTHING_TO_PASTE, PARSE_ERROR_NOTICE, pastedFromEditorNotice } from "@/lib/tabscore/menuMessages";
import {
  BAR_NOTICE_MS, copyText, cutText, pasteText, readForPaste, runCommand, type CommandDeps, type DigitBuffer,
} from "@/lib/tabscore/runCommand";
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
  subscribeToSoundBankChanges,
  getSoundBankPreference,
  getServerSoundBank,
  setSoundBankPreference,
  soundBankById,
} from "@/lib/soundBank";
import SoundBankControl from "@/components/SoundBankControl";
import {
  toggleRepeatStart,
  toggleRepeatEnd,
  readBarRepeat,
} from "@/lib/tabscore/commands/repeat";
import {
  readTimeSignature,
  setTimeSignature,
  type TimeSignature,
} from "@/lib/tabscore/commands/timeSignature";

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
// How long the note preview waits after the last keystroke or caret move.
// Long enough that a briskly typed two-digit fret sounds once, and a held
// arrow only where it stops; short enough to feel immediate.
const PREVIEW_DELAY_MS = 150;
const AUTOSAVE_DELAY_MS = 1000;
const NOTICE_MS = 2500;
// How long the selection must stay put before a screen reader hears its size:
// longer than a held arrow key's repeat delay, so holding Shift+→ is said once.
const SELECTION_SPOKEN_MS = 500;
const INITIAL_CARET: Caret = { barIndex: 0, beatIndex: 0, string: 6 };

// The last clip copied or cut, for a browser whose copy and paste events
// carry no clipboardData. Module-level, so it outlives a remount; never the
// source of truth — the system clipboard is, whenever there is one.
let fallbackClip: string | null = null;

// Set when the note menu's Copy or Cut could not reach the system clipboard —
// plain http over the LAN gives the page none, or the browser refused the
// write — so the editor's clip is newer than what the system clipboard
// holds: the next paste here, from the menu or Ctrl+V, takes the editor's
// clip instead of the stale text. A copy or cut anywhere else on the page
// clears it: the system clipboard has the newest passage then. The editor's
// own copy and cut clear it only when they write (writeClip) — a refused one
// writes nothing, and leaves the editor's clip the newer.
let editorClipNewer = false;
const systemClipboardIsNewest = () => {
  editorClipNewer = false;
};

/** A clip onto the clipboard a copy or cut event offers, and into the fallback. */
function writeClip(event: React.ClipboardEvent<HTMLDivElement>, text: string): void {
  fallbackClip = text;
  editorClipNewer = false;
  event.clipboardData?.setData("text/plain", text);
}

/**
 * The note menu's Copy and Cut: the clip into the fallback, and onto the
 * system clipboard where the page may write it — or, where it may not, marked
 * as newer than whatever the system clipboard holds.
 */
function putOnClipboard(text: string): void {
  fallbackClip = text;
  const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
  if (!clipboard?.writeText) {
    editorClipNewer = true;
    return;
  }
  editorClipNewer = false;
  clipboard.writeText(text).catch(() => {
    editorClipNewer = true;
  });
}

/** The page's own clipboard reader, where it has one (a secure context). */
const clipboardReader = (): (() => Promise<string>) | undefined => {
  const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
  return clipboard?.readText ? () => clipboard.readText() : undefined;
};

/** The note menu, as TabEditor holds it. */
interface MenuState {
  /** The note menu, or the selection menu: fixed when it opens. */
  scope: "note" | "selection";
  /** The beat it hangs under: its bar, from the beat's left edge. */
  anchor: BeatPos;
  /**
   * NoteMenu's focusRequest: a new number above 0 moves focus into it (a
   * keyboard open); 0 leaves focus on the editor (a pointer open).
   */
  focus: number;
}

const NO_GROUPS: MenuGroup[] = [];

// The note menu is a popover. A browser without the Popover API (Chrome
// before 114, Safari before 17) gets no menu at all — nothing opens one, the
// ⋯ Menu button is not drawn, and a right-click, the Menu key and Shift+F10
// get the browser's own menu, as before the note menu — rather than a menu
// state that goes open with nothing on screen. Read once, at load: TabEditor
// mounts only in the browser, after a fetch or a click, so no server render
// can disagree.
const MENU_SUPPORTED = typeof HTMLElement !== "undefined" && typeof HTMLElement.prototype.showPopover === "function";

/**
 * Drop a text selection outside the editor — a heading, a notice, Ctrl+A
 * outside the score. It survives a press on the score, whose default alphaTab
 * prevents, and the browser aims copy, cut and paste at it rather than at the
 * focused editor, whose handlers then never run. A selection inside the editor
 * (the score's own text) is left alone.
 */
function dropStraySelection(editor: HTMLElement | null): void {
  const selection = window.getSelection();
  if (editor && selection && selection.rangeCount > 0 && !editor.contains(selection.anchorNode)) selection.removeAllRanges();
}

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
 * `keymap.test.ts`'s exhaustive cross-product test). Running what it
 * resolves to lives elsewhere too: the parse guard, two-digit fret entry,
 * the dispatch, its notices and its preview are `@/lib/tabscore/runCommand`,
 * which a key and a toolbar button go through alike. This component supplies
 * its dependencies (`commandDeps`) — the refs it reads, and the callbacks,
 * `commitTex` among them, through which it acts.
 */
const SOURCE_WIDTH_KEY = "tabEditorSourceWidth";
const SOURCE_WIDTH_DEFAULT = 420;
const clampSourceWidth = (w: number) =>
  Math.max(240, Math.min(w, Math.floor(window.innerWidth * 0.7)));
function loadSourceWidth(): number {
  try {
    const n = Number(localStorage.getItem(SOURCE_WIDTH_KEY));
    return Number.isFinite(n) && n > 0 ? n : SOURCE_WIDTH_DEFAULT;
  } catch {
    return SOURCE_WIDTH_DEFAULT;
  }
}

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
  // The selection's fixed end. It runs from here to the caret (its head), in
  // either direction; null is no selection. Positions, never alphaTab Beats:
  // every edit renders a fresh Score.
  const [selectionAnchor, setSelectionAnchor] = useState<BeatPos | null>(null);
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
  // Which sound bank playback uses — the same kind of listening preference
  // as the mix, kept in localStorage and shared with the GP player through
  // src/lib/soundBank.ts. It changes only the samples the synth sounds with,
  // never the tab's text.
  const soundBankId = useSyncExternalStore(subscribeToSoundBankChanges, getSoundBankPreference, getServerSoundBank);
  const handleSoundBankChange = useCallback((id: string) => {
    setSoundBankPreference(id);
    containerRef.current?.focus();
  }, []);
  // Bars dragged out on the canvas to drill a section, zero-based inclusive.
  const [loopRange, setLoopRange] = useState<{ startBar: number; endBar: number } | null>(null);
  // How many times the repeat-bars button writes. Not derived from the
  // document: it is the NEXT value to write, which only matters until the
  // button is pressed. Once written, the score itself carries the count.
  const [repeatCount, setRepeatCount] = useState(2);
  const [showSource, setShowSource] = useState(initialShowSource);
  const [sourceWidth, setSourceWidth] = useState(loadSourceWidth);
  const startSourceResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sourceWidth;
    let width = startWidth;
    const onMove = (m: PointerEvent) => {
      // The pane is on the right, so dragging left widens it.
      width = clampSourceWidth(startWidth + (startX - m.clientX));
      setSourceWidth(width);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      try {
        localStorage.setItem(SOURCE_WIDTH_KEY, String(width));
      } catch {
        /* storage unavailable: the width just won't be remembered */
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Carried over from AlphaTexPlayer, which this replaces in the track
  // dialog: without it, practising a tab silently stops counting toward
  // lastPlayedAt and everything built on it (What to Practice Next,
  // in-progress state, revisit-tracks).
  const sessionTracker = usePracticeSessionTracker(track);
  const sessionTrackerRef = useRef(sessionTracker);

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

  const digitBufferRef = useRef<DigitBuffer | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The last `tex` the autosave effect below actually scheduled a save
  // for — NOT a one-shot "have I mounted yet" boolean. See that effect's
  // comment for why the distinction matters under Strict Mode.
  const lastHandledTexRef = useRef(tex);

  // Shared once per render: SourcePane's diagnostics, TechniquePalette's
  // disabled state, the note menu's items, and runCommand's parse guard
  // (through commandDeps.parsedOk, which reads it from parsedRef) all read
  // this one result instead of each calling parseTex again (~2.7ms on a
  // 300-bar document — fine once per render, wasteful several times).
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
  const previewNotesRef = useRef(mix.previewNotes);
  const showHelpRef = useRef(showHelp);
  const selectionAnchorRef = useRef<BeatPos | null>(null);
  // Set by a keydown that pastes — Ctrl+V and Shift+Insert over the music,
  // Ctrl+Shift+V in front of it (the paste event itself cannot say which) —
  // and taken by the paste event it brings. A paste with none is not from the
  // keys: Linux fires one for a middle-click, carrying whatever text was last
  // selected anywhere. Cleared when a key comes up, so it never outlives the
  // keydown that set it.
  const pasteArmRef = useRef<{ inserts: boolean } | null>(null);

  useEffect(() => {
    texRef.current = tex;
    caretRef.current = caret;
    onSaveRef.current = onSave;
    speedRef.current = speed;
    parsedRef.current = parsed;
    tempoRef.current = tempo;
    repeatCountRef.current = repeatCount;
    sessionTrackerRef.current = sessionTracker;
    previewNotesRef.current = mix.previewNotes;
    showHelpRef.current = showHelp;
  });

  const showNotice = useCallback((message: string, ms: number = NOTICE_MS) => {
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), ms);
  }, []);

  // The note menu. This state is the one truth about it: NoteMenu only
  // mirrors it, with showPopover() and hidePopover(), and nothing in the
  // browser opens or closes it on its own (popover="manual"). Open is
  // `menu`; shown is open with its bar in the score panel — what Escape and
  // the ⋯ button's aria-expanded mean by open. `menuRef` is mirrored eagerly
  // beside its setter, for the handlers that read it; `menuShownRef` changes
  // only through NoteMenu's report (onShownChange), in the commit that shows
  // or hides the menu.
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<MenuState | null>(null);
  const [menuShown, setMenuShown] = useState(false);
  const menuShownRef = useRef(false);
  const noteMenuRef = useRef<NoteMenuHandle>(null);
  // The menu's id, for the ⋯ Menu button's aria-controls.
  const menuId = useId();
  // Whether the press now under way closed a menu that showed: a press on an
  // opener — the ⋯ button, the caret's own note — then closes it, and does
  // not open it again on release.
  const closedByPressRef = useRef(false);
  const focusSeqRef = useRef(0);
  // Whether the editor holds a passage of its own, for the menu's Paste.
  const [hasClip, setHasClip] = useState(() => fallbackClip !== null);

  const showMenu = useCallback((next: MenuState) => {
    if (!MENU_SUPPORTED) return;
    digitBufferRef.current = null;
    menuRef.current = next;
    setMenu(next);
  }, []);

  // Every close hands the keyboard back to the editor if the menu had it.
  // Shown is left to NoteMenu's report, which says false in the commit that
  // closes the menu: a close and a re-open in one keydown (the Menu key or
  // Shift+F10 inside a keyboard-opened menu) never hides it, so NoteMenu
  // reports nothing, and a false written here would stay on a menu that shows.
  const closeMenu = useCallback(() => {
    if (!menuRef.current) return;
    const hadFocus = noteMenuRef.current?.contains(document.activeElement) ?? false;
    menuRef.current = null;
    setMenu(null);
    if (hadFocus) containerRef.current?.focus();
  }, []);

  const handleMenuShown = useCallback((shown: boolean) => {
    menuShownRef.current = shown;
    setMenuShown(shown);
  }, []);

  // The menu at the caret's bar, scrolled into view: the selection menu over a
  // selection, else the note menu. `focus` is its focus request: a new number
  // moves focus inside (opened from the keyboard), 0 leaves it on the editor
  // (opened with the pointer). Where there is no menu (MENU_SUPPORTED),
  // nothing — not even the scroll.
  const openAtCaret = useCallback(
    (focus: number) => {
      if (!MENU_SUPPORTED) return;
      const c = caretRef.current;
      scoreCanvasRef.current?.scrollBarIntoView(c.barIndex);
      showMenu({ scope: selectionAnchorRef.current ? "selection" : "note", anchor: c, focus });
    },
    [showMenu],
  );

  // Enter, the Menu key and Shift+F10 (runCommand's openMenu): the menu at
  // the caret, with focus inside — or, while a menu opened with the mouse
  // shows, focus into that one, not a new one.
  const openMenuFromKeys = useCallback(() => {
    const current = menuRef.current;
    if (current && menuShownRef.current) {
      showMenu({ ...current, focus: ++focusSeqRef.current });
      return;
    }
    openAtCaret(++focusSeqRef.current);
  }, [showMenu, openAtCaret]);

  // The score starting to play closes the menu — from Space, the Play button
  // or wherever.
  const handlePlayingChange = useCallback(
    (playing: boolean) => {
      setIsPlaying(playing);
      if (playing) {
        sessionTrackerRef.current.onPlay();
        closeMenu();
      } else {
        sessionTrackerRef.current.onPause();
      }
    },
    [closeMenu],
  );

  // The note preview. One scheduler per mounted editor: each request
  // restarts its wait and queues the caret as a candidate; when it fires,
  // ScoreCanvas plays the newest candidate that has something to sound.
  // Built in an effect rather than a useState initializer: `onFire` reads
  // refs, and react-hooks/refs rejects that during render. So Strict Mode's
  // mount, cleanup, mount just builds a fresh one, and everything it reads
  // when it fires is a ref. The optional chaining where it is used makes the
  // window before the effect harmless: a request there is dropped.
  const previewSchedulerRef = useRef<PreviewScheduler | null>(null);
  useEffect(() => {
    const scheduler = createPreviewScheduler({
      delayMs: PREVIEW_DELAY_MS,
      onFire: (candidates) => {
        if (!previewNotesRef.current || !parsedRef.current.ok) return;
        scoreCanvasRef.current?.previewBeat(candidates);
      },
    });
    previewSchedulerRef.current = scheduler;
    return () => {
      scheduler.cancel();
      previewSchedulerRef.current = null;
    };
  }, []);

  // Every preview decision goes through here, called from each handler that
  // can start or stop one — never from an effect watching `caret`, because
  // the re-clamp effect below moves the caret after undo and Source edits,
  // which must not preview.
  const notePreview = useCallback(
    (prev: Caret, next: Caret, source: PreviewSource) => {
      const action = previewAction(prev, next, source);
      if (action === "request") {
        previewSchedulerRef.current?.request(next);
      } else if (action === "cancel") {
        previewSchedulerRef.current?.cancel();
        scoreCanvasRef.current?.stopPreview();
      }
    },
    [],
  );

  // What the inputs that are not note entry do — Stop, the Source pane, the
  // tempo, tuning and repeat-sign controls, switching Notes off: drop a
  // pending preview and stop one that is sounding.
  const cancelPreview = useCallback(() => {
    notePreview(caretRef.current, caretRef.current, { kind: "excluded" });
  }, [notePreview]);

  // Behaviour 1 (state) + Behaviour 5 (undo history). One path for every
  // source of a `tex` change — a canvas command's result and SourcePane's
  // onChange both call this — so undo never silently discards text typed
  // into the source pane between two canvas commands. Reads and writes refs
  // directly rather than a functional setState updater: React may invoke a
  // functional updater twice under StrictMode, which would double-push
  // history.
  //
  // Every commit also sets the selection: none unless the command passes one
  // — Delete keeps its selection, a paste or duplicate selects what it wrote
  // — so no other edit, from the Source pane or the toolbar, can leave a
  // selection pointing at music that moved.
  const commitTex = useCallback((nextText: string, nextCaret?: Caret, nextAnchor: BeatPos | null = null) => {
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
    selectionAnchorRef.current = nextAnchor;
    setSelectionAnchor(nextAnchor);
  }, []);

  const setAnchor = useCallback((anchor: BeatPos | null) => {
    selectionAnchorRef.current = anchor;
    setSelectionAnchor(anchor);
  }, []);

  const undo = useCallback(() => {
    // Minor (review round 3): clear unconditionally, even on the no-op
    // (idx <= 0) path — pressing undo at all is a signal the user has moved
    // on from composing a fret digit, whether or not there was anything to
    // undo. Without this, "1", Ctrl+Z, "2" within 800ms composed "12" onto
    // whatever the undo landed on, instead of the "2" the user actually
    // typed.
    digitBufferRef.current = null;
    setAnchor(null);
    // And the note menu closes, however undo was asked for — its key, the
    // menu, or the toolbar button, clicked or pressed from the keyboard — as
    // the menu's close table says (closesMenu): the music under it may move.
    closeMenu();
    notePreview(caretRef.current, caretRef.current, { kind: "command", command: "undo", accepted: true });
    const idx = historyIndexRef.current;
    if (idx <= 0) return;
    const nextText = historyRef.current[idx - 1];
    historyIndexRef.current = idx - 1;
    texRef.current = nextText;
    setHistoryIndex(idx - 1);
    setTex(nextText);
  }, [closeMenu, notePreview, setAnchor]);

  const redo = useCallback(() => {
    digitBufferRef.current = null; // see undo's comment above
    setAnchor(null);
    closeMenu(); // see undo's, too
    notePreview(caretRef.current, caretRef.current, { kind: "command", command: "redo", accepted: true });
    const idx = historyIndexRef.current;
    const h = historyRef.current;
    if (idx >= h.length - 1) return;
    const nextText = h[idx + 1];
    historyIndexRef.current = idx + 1;
    texRef.current = nextText;
    setHistoryIndex(idx + 1);
    setTex(nextText);
  }, [closeMenu, notePreview, setAnchor]);

  // Behaviour 3's "clear the buffer on any caret move," shared by arrow-key
  // navigation and canvas clicks (ScoreCanvas's onCaretChange) alike.
  const moveCaret = useCallback((next: Caret) => {
    digitBufferRef.current = null;
    caretRef.current = next;
    setCaret(next);
  }, []);

  // What runCommand reads and does, from this editor's refs and callbacks.
  // Every getter reads a ref, so the one object stays current; it changes
  // only if a callback does, and none of them ever does.
  const commandDeps = useMemo<CommandDeps>(
    () => ({
      text: () => texRef.current,
      caret: () => caretRef.current,
      anchor: () => selectionAnchorRef.current,
      parsedOk: () => parsedRef.current.ok,
      digits: () => digitBufferRef.current,
      setDigits: (buffer) => {
        digitBufferRef.current = buffer;
      },
      now: () => Date.now(),
      commit: commitTex,
      moveCaret,
      setAnchor,
      notice: showNotice,
      preview: notePreview,
      undo,
      redo,
      playPause: () => scoreCanvasRef.current?.playPause(),
      toggleHelp: () => setShowHelp((prev) => !prev),
      openMenu: openMenuFromKeys,
    }),
    [commitTex, moveCaret, setAnchor, showNotice, notePreview, undo, redo, openMenuFromKeys],
  );

  // A chord command from a key, a toolbar button or a menu item: one way to
  // run it (runCommand.ts), so the three cannot drift apart. Then the menu
  // closes or stays open by spec §1's table (menuStaysOpen).
  const run = useCallback(
    (command: ChordCommand) => {
      const before = caretRef.current;
      runCommand(command, commandDeps);
      const open = menuRef.current;
      const selecting = selectionAnchorRef.current !== null;
      if (open && !menuStaysOpen(command.kind, open.scope, before, caretRef.current, selecting)) closeMenu();
    },
    [commandDeps, closeMenu],
  );

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
    // A selection that no longer names beats is dropped, never clamped into
    // a different range. Checked against the caret as it was, not the clamped
    // one: the clamp pulls a stranded head back into the score, which would
    // clamp the selection along with it.
    const anchor = selectionAnchorRef.current;
    if (anchor && !stillValid(parsed.scoreNode, rangeOf(anchor, c))) setAnchor(null);
  }, [parsed, setAnchor]);

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
    setAnchor(null);
    notePreview(caretRef.current, caretRef.current, { kind: "command", command: "playPause", accepted: true });
    scoreCanvasRef.current?.playPause();
    // Keep focus on the canvas so Space stays meaningful after a click;
    // otherwise focus sits on the button and Space just re-presses it.
    containerRef.current?.focus();
  }, [notePreview, setAnchor]);

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
        repeat: event.repeat,
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
    cancelPreview();
    scoreCanvasRef.current?.stop();
    containerRef.current?.focus();
  }, [cancelPreview]);

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

  // Editing the written tempo is an ordinary document edit: it goes through
  // commitTex, so it lands in undo history and the autosave like any other.
  const handleTempoChange = useCallback((bpm: number) => {
    cancelPreview();
    const result = setTempo(texRef.current, bpm, caretRef.current);
    if (result) commitTex(result.text, result.caret);
  }, [commitTex, cancelPreview]);

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
      cancelPreview();
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
    [commitTex, cancelPreview],
  );

  const handleToggleRepeatStart = useCallback(() => {
    cancelPreview();
    const result = toggleRepeatStart(texRef.current, caretRef.current, caretRef.current.barIndex);
    if (result) commitTex(result.text, result.caret);
    containerRef.current?.focus();
  }, [commitTex, cancelPreview]);

  const handleToggleRepeatEnd = useCallback(() => {
    cancelPreview();
    const result = toggleRepeatEnd(
      texRef.current,
      caretRef.current,
      caretRef.current.barIndex,
      shownRepeatCountRef.current,
    );
    if (result) commitTex(result.text, result.caret);
    containerRef.current?.focus();
  }, [commitTex, cancelPreview]);

  // Like the repeat signs, a time signature goes on the caret's bar — and,
  // as in written music, holds from there until the next bar that changes it.
  const timeSignature = useMemo(
    () => (parsed.ok ? readTimeSignature(parsed.score, caret.barIndex) : null),
    [parsed, caret.barIndex],
  );

  const handleTimeSignatureChange = useCallback((next: TimeSignature) => {
    cancelPreview();
    const result = setTimeSignature(texRef.current, caretRef.current, caretRef.current.barIndex, next);
    if (result) commitTex(result.text, result.caret);
    containerRef.current?.focus();
  }, [commitTex, cancelPreview]);

  const handleTuningChange = useCallback((presetId: string) => {
    cancelPreview();
    const result = setTuning(texRef.current, presetId, caretRef.current);
    if (result) commitTex(result.text, result.caret);
    containerRef.current?.focus();
  }, [commitTex, cancelPreview]);

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
      // A Source-pane edit closes the menu: the music under it may have moved.
      // So do undo and redo — they close it themselves, however they are
      // asked for — the only other ways a document can stop parsing, so the
      // menu never stays over a tab that no longer parses.
      closeMenu();
      cancelPreview();
      // Belt-and-suspenders: a textarea's onChange value is already
      // LF-normalised per spec, but this exact CRLF/offset hazard has
      // already bitten this codebase three times (see
      // task-13-fix-report.md) — closing it at every boundary that writes
      // `tex` costs one idempotent replace.
      commitTex(normalizeNewlines(nextTex));
    },
    [commitTex, cancelPreview, closeMenu],
  );

  // Whether the caret's beat is already in a triplet, so the button reads
  // as a toggle rather than leaving the user guessing.
  const tuplet = useMemo(
    () => (parsed.ok && parsed.scoreNode ? tupletAt(tex, parsed.scoreNode, caret) : null),
    [tex, parsed, caret],
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
      const chord = {
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        repeat: event.repeat,
      };
      // The clipboard keys are left to bubble below, never preventDefault()ed:
      // the browser turns them into the copy, cut and paste events handled
      // further down. Before it does, a text selection elsewhere on the page,
      // which would take those events instead, goes; and a paste key arms the
      // paste event it brings, saying whether it pastes in front (Ctrl+Shift+V),
      // which the event cannot say.
      const clipboard = clipboardChord(chord);
      if (clipboard) {
        dropStraySelection(containerRef.current);
        if (clipboard === "paste" || clipboard === "pasteInsert") {
          pasteArmRef.current = { inserts: clipboard === "pasteInsert" };
        }
      }
      const command = matchChord(chord);
      // Without the Popover API there is no note menu (MENU_SUPPORTED): Enter,
      // the Menu key and Shift+F10 are not the editor's then, and go on to the
      // browser — the Menu key and Shift+F10 to its own menu — as before the
      // note menu.
      if (command?.kind === "openMenu" && !MENU_SUPPORTED) return;
      // Not one of ours — let it bubble (Tab, Ctrl+C/X/V, or any unbound
      // chord). Nor is Escape unless it has the menu to close or a selection
      // to clear: with neither, or with the shortcuts panel open, it still
      // reaches whatever listens on the window — the panel closes on it.
      const selecting = selectionAnchorRef.current !== null;
      const menuShowing = menuShownRef.current;
      if (!command || !claims(command, { selecting, helpOpen: showHelpRef.current, menuShown: menuShowing })) return;

      event.preventDefault();
      event.stopPropagation();
      // Escape with the menu showing closes the menu, and only the menu: a
      // second Escape clears the selection.
      if (command.kind === "clearSelection" && menuShowing) {
        closeMenu();
        return;
      }
      // A held Enter, Menu key or Shift+F10 opens the menu once: its repeats
      // are claimed above, so the browser's own menu never opens, and dropped.
      if (command.kind === "openMenu" && event.repeat) return;
      run(command);
    },
    [run, closeMenu],
  );

  // A plain press on the score — a click, or the start of a practice-loop
  // drag — moves the caret and ends any edit selection: the two never mix.
  const handleCanvasCaret = useCallback(
    (next: Caret) => {
      setAnchor(null);
      moveCaret(next);
    },
    [moveCaret, setAnchor],
  );

  // A Shift+click extends the selection to the clicked beat, starting one at
  // the caret if there is none. ScoreCanvas swallows the press, so the
  // playback hook never sees it — no seek, no practice-loop change, no
  // onCaretClick — which also means it never reaches the container's
  // onMouseDown: focus comes back here, and the preview is asked for here.
  // A Shift+press on no beat never gets here, and so does nothing.
  const handleShiftClick = useCallback(
    (next: Caret) => {
      containerRef.current?.focus();
      digitBufferRef.current = null;
      if (!parsedRef.current.ok) {
        showNotice(PARSE_ERROR_NOTICE);
        return;
      }
      const c = caretRef.current;
      if (!selectionAnchorRef.current) setAnchor({ barIndex: c.barIndex, beatIndex: c.beatIndex });
      moveCaret(next);
      notePreview(c, next, { kind: "click", dragged: false });
    },
    [moveCaret, notePreview, setAnchor, showNotice],
  );

  // Ctrl+C, Ctrl+X and Ctrl+V reach the editor as the browser's own copy,
  // cut and paste events — their keydowns are left alone (keymap.ts) — so a
  // clip goes through the real clipboard as AlphaTex text, and pastes into
  // the Source pane or another tab as well as back here. What each one does
  // is runCommand.ts's copyText, cutText and pasteText, which the note menu
  // runs too; these only take the text from the event or put it there.
  const handleCopy = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      const text = copyText(commandDeps);
      if (text === null) return;
      writeClip(event, text);
      setHasClip(true);
    },
    [commandDeps],
  );

  const handleCut = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      const text = cutText(commandDeps);
      if (text === null) return;
      writeClip(event, text);
      setHasClip(true);
    },
    [commandDeps],
  );

  // Ctrl+V (or Shift+Insert) pastes over what is there, Ctrl+Shift+V in front
  // of it — the keydown said which. This only takes the passage from the
  // event, or from the editor's last clip where the event carries no
  // clipboardData or where that clip is newer than the system clipboard
  // (editorClipNewer), and hands it to pasteText (runCommand.ts), which does
  // the rest: the parse guard, the line ends, where it lands, the notice and
  // the preview. Then it closes the note menu, as the menu's own Paste does.
  //
  // A paste no key armed is ignored, unsaid: a middle-click, whose paste
  // Linux fills with whatever text was last selected anywhere (the Source
  // pane, say), would otherwise write over the music at the caret, and save.
  // The browser's own menu's Paste is ignored with it; on this element it
  // offers none.
  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      const arm = pasteArmRef.current;
      pasteArmRef.current = null;
      if (!arm) return;
      // The editor's own clip when it is newer than the system clipboard (a
      // menu Copy over plain http), else what the event carries.
      const raw =
        editorClipNewer && fallbackClip !== null
          ? fallbackClip
          : event.clipboardData
            ? event.clipboardData.getData("text/plain")
            : (fallbackClip ?? "");
      pasteText(commandDeps, raw, arm.inserts);
      closeMenu();
    },
    [commandDeps, closeMenu],
  );

  // The menu's own items. A command runs exactly as its key runs it (run),
  // which then closes the menu or keeps it (menuStaysOpen). Copy and Cut put
  // the clip on the system clipboard where the page may, and keep the menu
  // open; Paste and Paste in front close it, then read the system clipboard —
  // which may wait on a permission prompt, so pasteText reads the document
  // as it is when the text arrives.
  const runMenuItem = useCallback(
    (item: MenuItem) => {
      const { action } = item;
      if (action.kind === "command") {
        run(action.command);
        return;
      }
      if (action.action === "copy" || action.action === "cut") {
        const text = (action.action === "copy" ? copyText : cutText)(commandDeps);
        if (text === null) return;
        putOnClipboard(text);
        setHasClip(true);
        return;
      }
      // Paste or Paste in front.
      closeMenu();
      const inserts = action.action === "pasteInsert";
      void readForPaste({ readText: clipboardReader(), editorClip: fallbackClip, editorClipNewer }).then((found) => {
        if (!found) {
          showNotice(NOTHING_TO_PASTE, BAR_NOTICE_MS);
          return;
        }
        pasteText(commandDeps, found.raw, inserts, found.blocked ? pastedFromEditorNotice : undefined);
      });
    },
    [run, commandDeps, closeMenu, showNotice],
  );

  // Where the menu goes: its anchor beat's bar, and the score panel.
  const locateMenu = useCallback(() => {
    const at = menuRef.current?.anchor;
    const canvas = scoreCanvasRef.current;
    const anchor = at && canvas ? canvas.barClientRect(at) : null;
    const bounds = canvas ? canvas.scoreClientRect() : null;
    return anchor && bounds ? { anchor, bounds } : null;
  }, []);

  const focusEditor = useCallback(() => containerRef.current?.focus(), []);

  const handleViewChange = useCallback(() => noteMenuRef.current?.reposition(), []);

  // The pointer's ways in. A right-click on a beat inside the selection keeps
  // it and opens the selection menu there; on any other beat it moves the
  // caret there (string from the click), ends the selection, and opens the
  // note menu and plays it, as a left click plays it; on empty score, the
  // menu opens at the caret, scrolled into view. A click on the caret's own
  // note opens the note menu — unless that press just closed it, which makes
  // the click a toggle. (ScoreCanvas asks only where there is a menu:
  // MENU_SUPPORTED.)
  const handleMenuRequest = useCallback(
    (request: MenuRequest) => {
      if (request.kind === "caretNote") {
        if (closedByPressRef.current) return;
        showMenu({ scope: "note", anchor: request.caret, focus: 0 });
        return;
      }
      if (request.kind === "beat") {
        if (!request.inSelection) {
          setAnchor(null);
          moveCaret(request.caret);
          notePreview(request.caret, request.caret, { kind: "click", dragged: false });
        }
        showMenu({ scope: request.inSelection ? "selection" : "note", anchor: request.caret, focus: 0 });
        return;
      }
      openAtCaret(0);
    },
    [moveCaret, notePreview, setAnchor, showMenu, openAtCaret],
  );

  // The ⋯ Menu button toggles the menu at the caret's bar, scrolled into view.
  // Clicked, focus stays on the editor; activated from the keyboard (a click
  // with no pointer behind it), focus moves into the menu.
  const handleMenuButton = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const byPointer = event.detail !== 0;
      if (byPointer && closedByPressRef.current) return;
      if (menuShownRef.current) {
        closeMenu();
        return;
      }
      openAtCaret(byPointer ? 0 : ++focusSeqRef.current);
    },
    [closeMenu, openAtCaret],
  );

  // A press anywhere outside the menu closes it — the capture phase, so it
  // sees every press first, Shift+presses ScoreCanvas swallows included —
  // and records whether this press closed a menu that showed. The record is
  // reset first, by every press, so none outlives the press that made it.
  useEffect(() => {
    const onPress = (event: MouseEvent) => {
      closedByPressRef.current = false;
      const target = event.target as Node | null;
      // A press on the score panel's own scrollbar scrolls; it is not a press on anything.
      if (containerRef.current?.contains(target) && onOwnScrollbar(target, event)) return;
      if (!menuRef.current || noteMenuRef.current?.contains(target)) return;
      closedByPressRef.current = menuShownRef.current;
      closeMenu();
    };
    document.addEventListener("mousedown", onPress, true);
    return () => document.removeEventListener("mousedown", onPress, true);
  }, [closeMenu]);

  // A copy or cut anywhere else on the page puts the newest passage on the
  // system clipboard. The editor's own copy and cut say for themselves
  // (writeClip): a refused one writes nothing, and must not clear the mark.
  useEffect(() => {
    const onCopyOrCut = (event: ClipboardEvent) => {
      if (containerRef.current?.contains(event.target as Node | null)) return;
      systemClipboardIsNewest();
    };
    document.addEventListener("copy", onCopyOrCut);
    document.addEventListener("cut", onCopyOrCut);
    return () => {
      document.removeEventListener("copy", onCopyOrCut);
      document.removeEventListener("cut", onCopyOrCut);
    };
  }, []);

  // The selection ScoreCanvas draws: anchor to caret. Memoised, so a render
  // that changes neither hands it the same object and its overlay effect
  // does not re-run.
  const selection = useMemo(() => (selectionAnchor ? rangeOf(selectionAnchor, caret) : null), [selectionAnchor, caret]);

  // What the menu holds, worked out only while it is open. `menu` in the deps
  // is load-bearing for placement too, not only for its scope: a close and a
  // re-open in one commit (the Menu key or Shift+F10 inside a keyboard-opened
  // menu) never takes NoteMenu's `open` to false, so NoteMenu places itself
  // again — at the new anchor — only because the new state brings new groups.
  const menuGroups = useMemo(
    () =>
      menu
        ? menuItems({
            tex,
            parsed,
            caret,
            selection: menu.scope === "selection" ? selection : null,
            clipboard: { secure: clipboardReader() !== undefined, hasFallbackClip: hasClip },
          })
        : NO_GROUPS,
    [menu, tex, parsed, caret, selection, hasClip],
  );

  // What a screen reader hears about the selection: its size once it has
  // stayed put for a moment — so a held Shift+→ is said where it stops, not
  // at every step — and, once there was one, that it was cleared. The words
  // are set from a timer each change restarts, never during the effect.
  const [selectionSpoken, setSelectionSpoken] = useState("");
  useEffect(() => {
    const size = selection && parsed.ok ? sizeOf(parsed.scoreNode, selection) : null;
    const words = selection && size && size.beats > 0 ? selectionAnnouncement(size, selection.from.barIndex) : null;
    const timer = setTimeout(
      () => setSelectionSpoken((said) => words ?? (said === "" ? "" : SELECTION_CLEARED)),
      SELECTION_SPOKEN_MS,
    );
    return () => clearTimeout(timer);
  }, [selection, parsed]);

  // A key coming up ends any paste arm its keydown set (pasteArmRef).
  const handleCanvasKeyUp = useCallback(() => {
    pasteArmRef.current = null;
  }, []);

  // Focus leaving the editor for another control — Shift+Tab to the toolbar,
  // say — closes the note menu: the keys, Escape among them, no longer reach
  // it. Focus moving into the menu stays inside this container, and the
  // window losing focus names no next element: neither closes it.
  const handleCanvasBlur = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      const next = event.relatedTarget;
      if (next instanceof Node && !event.currentTarget.contains(next)) closeMenu();
    },
    [closeMenu],
  );

  // A plain left press anywhere on the score ends the edit selection — on a
  // beat, which also moves the caret (handleCanvasCaret), or on empty space:
  // below the last system, the title, the grey panel. A Shift+press on a beat
  // never gets here (ScoreCanvas swallows it); a Shift+press elsewhere, a
  // middle press and a press on the panel's scrollbar keep it, and so does a
  // right press — on a beat outside the selection the note menu's request
  // (handleMenuRequest) ends it.
  const handleCanvasMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      containerRef.current?.focus();
      if (event.button === 0 && !event.shiftKey && !onOwnScrollbar(event.target, event.nativeEvent)) setAnchor(null);
    },
    [setAnchor],
  );

  // A press on the score moved the caret at mouse-down (handleCanvasCaret,
  // through ScoreCanvas's onCaretChange). The playback hook reports the
  // release only when the press did not become a drag, so dragging out a
  // practice loop never previews — however long the press was held first.
  const handleCaretClick = useCallback(() => {
    const c = caretRef.current;
    notePreview(c, c, { kind: "click", dragged: false });
  }, [notePreview]);

  // The bars that do not add up, from the parse every render already has, and
  // what the strip under the score says about them. Hidden while the source
  // does not parse: the canvas keeps its last good render and its colours.
  const broken = useMemo(() => (parsed.ok ? brokenBars(parsed.score) : []), [parsed]);
  const barStatus = useMemo(
    () => (parsed.ok ? stripMessage(caret.barIndex, broken) : null),
    [parsed.ok, broken, caret.barIndex],
  );

  // The strip's Fix all: every broken bar it can fix, as one undo step. The
  // button never takes focus (BarStatusStrip); like the transport, this hands
  // the keyboard back to the canvas, so Space and Enter keep going to the
  // editor. It closes the note menu first, as Shift+B does (closesMenu): it
  // changes the bars under the menu, and may trim away the beat the menu
  // hangs from. (A click has closed it already, with its press; this is for
  // Enter on the button, reached with Tab.)
  const handleFixAll = useCallback(() => {
    closeMenu();
    digitBufferRef.current = null;
    cancelPreview();
    if (parsedRef.current.ok) {
      const { result, fixed, skipped } = fixAllBars(texRef.current, caretRef.current);
      if (result) commitTex(result.text, result.caret);
      const message = fixAllNotice(fixed, skipped);
      if (message) showNotice(message, BAR_NOTICE_MS);
    }
    containerRef.current?.focus();
  }, [commitTex, showNotice, cancelPreview, closeMenu]);

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
        <SoundBankControl bankId={soundBankId} onChange={handleSoundBankChange} />
        <PlaybackSpeedControl speed={speed} onChange={setSpeed} />
        <button
          type="button"
          onClick={() => updateMix({ mixOpen: !mix.mixOpen })}
          title={mix.mixOpen ? "Hide volume and click controls" : "Show volume and click controls"}
          aria-label="Volume and click controls"
          aria-pressed={mix.mixOpen}
          className={`px-2 py-1 text-xs rounded border focus:outline-none focus:border-blue-500 ${
            mix.mixOpen
              ? "bg-gray-500 border-gray-400 text-white"
              : "bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white"
          }`}
        >
          🔊 Mix
        </button>
        {mix.mixOpen && (
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
            previewNotes={mix.previewNotes}
            onPreviewNotesToggle={() => {
              const next = !mix.previewNotes;
              updateMix({ previewNotes: next });
              // Off means silence now, not after a ringing whole note ends.
              if (!next) cancelPreview();
            }}
          />
        )}
        {/* Undo/redo moved to the writing row below: they act on what you
            press there, and every control removed from this row is vertical
            space the score gets back — a full-width mix slider plus an undo
            pair was enough to wrap this whole row onto two lines. */}
      </div>

      {/* Writing row: what you press while writing notes — the note menu,
          beats and bars, repeats and the time signature, undo/redo for exactly those presses, and
          at the right edge the panel toggles. Undo/redo and the Source /
          Shortcuts / save-status group used to sit in the settings row and
          pushed it onto a second line even on a full-width window; every
          sub-row they cost is height taken straight off the score. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {MENU_SUPPORTED && (
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuShown}
            aria-controls={menuId}
            onClick={handleMenuButton}
            title="Note menu: every command for the note at the caret (Enter, or right-click a beat)"
            className={`px-2 py-1 text-xs rounded border focus:outline-none focus:border-blue-500 ${
              menuShown
                ? "bg-gray-500 border-gray-400 text-white"
                : "bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white"
            }`}
          >
            ⋯ Menu
          </button>
        )}
        <div className="flex items-center gap-1">
          {(
            [
              ["+ Beat", "Insert a beat after the caret (Insert)", "insertBeat"],
              ["− Beat", "Delete the beat at the caret, or the selected beats (Shift+Delete)", "deleteBeat"],
              ["+ Bar", "Add a bar at the end (Ctrl+Enter)", "addBar"],
              ["− Bar", "Delete the bar at the caret (Ctrl+Shift+Backspace)", "deleteBar"],
            ] as const
          ).map(([label, title, kind]) => (
            <button
              key={label}
              type="button"
              disabled={!parsed.ok}
              onClick={() => run({ kind })}
              title={title}
              className="px-2 py-1 text-xs rounded bg-gray-600 border border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-600 disabled:hover:text-gray-300"
            >
              {label}
            </button>
          ))}
        </div>
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
        <TimeSignatureControl
          barIndex={caret.barIndex}
          value={timeSignature}
          onChange={handleTimeSignatureChange}
          disabled={!parsed.ok}
        />
        <span className="w-px self-stretch bg-gray-700" aria-hidden />
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={!parsed.ok}
            onClick={() => run({ kind: "toggleTie" })}
            title="Tie to the previous note on this string (i)"
            className="px-2 py-1 text-xs rounded bg-gray-600 border border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-600 disabled:hover:text-gray-300"
          >
            Tie<span className="ml-1 text-gray-500">i</span>
          </button>
          <button
            type="button"
            disabled={!parsed.ok}
            onClick={() => run({ kind: "toggleTuplet" })}
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
          <TechniquePalette
            disabled={!parsed.ok}
            onSelect={(technique: Technique) => run({ kind: "toggleTechnique", technique })}
          />
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
            // Opening the panel closes the note menu, as `?` does: a click's
            // press has already closed it; pressed from the keyboard, this does.
            onClick={() => {
              closeMenu();
              setShowHelp(true);
            }}
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
      </div>

      {displayedNotice && (
        <div
          role="status"
          className="text-xs text-amber-400 bg-gray-800 border border-amber-500/40 rounded px-2 py-1"
        >
          {displayedNotice}
        </div>
      )}
      {/* The selection's size, for a screen reader: always present, so a change to it is announced. */}
      <div data-testid="selection-announcement" className="sr-only" aria-live="polite" aria-atomic="true">
        {selectionSpoken}
      </div>

      {/*
        Invariant load-bearing for BOTH keyboard and mouse isolation:
        onKeyDown and onMouseDown below must stay on a div whose only
        descendants are ScoreCanvas and the note menu — a popover, drawn in
        the top layer, kept in here so its keys and clipboard events reach
        this div's handlers; its root stops presses from reaching
        onMouseDown. SourcePane is a SIBLING, not nested
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
          onKeyUp={handleCanvasKeyUp}
          onBlur={handleCanvasBlur}
          onCopy={handleCopy}
          onCut={handleCut}
          onPaste={handlePaste}
          // Important, Task 18: a click alone never focused this element —
          // tabIndex makes it focusable, not auto-focused on click, and
          // nothing else here called .focus(). onMouseDown (not onClick) so
          // focus lands before any keystroke can follow the same gesture;
          // the containerRef, not e.currentTarget, so this keeps working if
          // the handler is ever attached somewhere other than the element
          // that actually holds the tabIndex. No preventDefault: that would
          // break text selection and alphaTab's own mouse handling (see
          // ScoreCanvas's noteMouseDown/beatMouseDown). A plain left press
          // also ends the edit selection (handleCanvasMouseDown).
          onMouseDown={handleCanvasMouseDown}
          // The middle button's release is what pastes on Linux: its default
          // goes, a second guard beside handlePaste's arm.
          onMouseUp={(e) => {
            if (e.button === 1) e.preventDefault();
          }}
          // The browser's own context menu never opens over the editor: a
          // right-click on the score opens the note menu (ScoreCanvas), and
          // the Menu key's own event, which Windows sends after the keydown
          // that opened the note menu, must not open a second one. Where
          // there is no note menu (MENU_SUPPORTED), the browser's opens as
          // it always did.
          onContextMenu={MENU_SUPPORTED ? (e) => e.preventDefault() : undefined}
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
            onCaretChange={handleCanvasCaret}
            onPlayingChange={handlePlayingChange}
            onFinished={handleFinished}
            speed={speed}
            looping={looping}
            volume={mix.volume}
            metronomeVolume={metronomeVolumeOf(mix)}
            countInVolume={countInVolumeOf(mix)}
            soundBankUrl={soundBankById(soundBankId).url}
            onLoopChange={handleLoopChange}
            onCaretClick={handleCaretClick}
            barStatus={barStatus}
            onFixAll={handleFixAll}
            selection={selection}
            onShiftClick={handleShiftClick}
            onMenuRequest={MENU_SUPPORTED ? handleMenuRequest : undefined}
            onViewChange={handleViewChange}
          />
          <NoteMenu
            ref={noteMenuRef}
            id={menuId}
            open={menu !== null}
            focusRequest={menu?.focus ?? 0}
            groups={menuGroups}
            locate={locateMenu}
            onShownChange={handleMenuShown}
            onRun={runMenuItem}
            onClose={closeMenu}
            focusEditor={focusEditor}
          />
        </div>
        {showSource && (
          <div className="relative shrink-0 min-h-0" style={{ width: sourceWidth }}>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize the source pane"
              title="Drag to resize the source pane"
              onPointerDown={startSourceResize}
              className="absolute -left-1.5 top-0 bottom-0 w-1.5 z-10 cursor-col-resize rounded hover:bg-blue-500/60 active:bg-blue-500"
            />
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
