import type { ParseResult } from "./parse";
import { sliceCp } from "./offsets";
import { beatSpliceRange, sameCaret, type Caret } from "./locate";
import type { Range } from "./selection";
import { refuse } from "./apply";
import { barState } from "./barFill";
import { refusedNotice } from "./barMessages";
import { clipOutcomeNotice, type ClipCommand } from "./clipMessages";
import { clipboardChord, closesMenu, matchChord, type ChordCommand, type ChordEvent, type ClipboardChord } from "./keymap";
import { isEditableBar } from "./commands/barEdit";
import { parseBeatText, TIE } from "./commands/beatText";
import { TECHNIQUE_KEYS, TECHNIQUE_LABEL, TECHNIQUES, techniquesAt, type Technique } from "./commands/technique";
import { tieOrigin } from "./commands/tie";
import { TRIPLET, tupletAt } from "./commands/tuplet";
import { NO_NOTE_REASON, NOTHING_TO_PASTE, NOTHING_TO_TIE_NOTICE, PARSE_REASON } from "./menuMessages";

/** What an item runs: a chord command, exactly as its key runs it, or a clipboard command. */
export type MenuAction = { kind: "command"; command: ChordCommand } | { kind: "clipboard"; action: ClipboardChord };

export interface MenuItem {
  /** Unique within its menu: a React key. */
  id: string;
  label: string;
  /** The key that runs the same thing, printed as the ? help prints it ("Ctrl+Shift+V"); null when no key does. */
  keyHint: string | null;
  /** The same key for aria-keyshortcuts ("Control+Shift+V"); null with keyHint. */
  ariaKeys: string | null;
  action: MenuAction;
  enabled: boolean;
  /** Why it is disabled; null when it is enabled. */
  reason: string | null;
  /** A toggle's state: on when running it would take it off. Absent for an item that is not a toggle. */
  pressed?: boolean;
}

export interface MenuGroup {
  label: string;
  items: MenuItem[];
}

export interface MenuInput {
  tex: string;
  parsed: ParseResult;
  caret: Caret;
  /** The selection: with one, the selection menu; with none, the note menu. */
  selection: Range | null;
  /** Whether the page can read the system clipboard, and whether the editor holds a passage of its own. */
  clipboard: { secure: boolean; hasFallbackClip: boolean };
}

// The keys a hint may name, printed as the ? help prints them, in the order a
// hint prefers them: `-` rather than `_` or `[`, `+` rather than `=` or `]`.
const HINT_KEYS: string[][] = [
  ["-"],
  ["+"],
  ["."],
  ["u"],
  ["r"],
  ["i"],
  ["d"],
  ...Object.keys(TECHNIQUE_KEYS).map((key) => [key]),
  ["Delete"],
  ["Shift", "Delete"],
  ["Ctrl", "Shift", "Backspace"],
  ["Shift", "B"],
  ["Insert"],
  ["Ctrl", "X"],
  ["Ctrl", "C"],
  ["Ctrl", "V"],
  ["Ctrl", "Shift", "V"],
];
const MODIFIERS = new Set(["Ctrl", "Shift"]);
/** A key of HINT_KEYS that only exists in its shifted form on a standard layout. */
const SHIFTED = new Set(["+"]);
/** aria-keyshortcuts' names where the printed ones differ (ARIA 1.2: "Plus" for the plus sign). */
const ARIA_NAME: Record<string, string> = { Ctrl: "Control", "+": "Plus" };

/** The keydown a printed chord of HINT_KEYS stands for. */
function keydownOf(keys: string[]): ChordEvent {
  const key = keys.find((k) => !MODIFIERS.has(k))!;
  return {
    key,
    ctrlKey: keys.includes("Ctrl"),
    metaKey: false,
    shiftKey: keys.includes("Shift") || SHIFTED.has(key),
    altKey: false,
  };
}

const sameCommand = (a: ChordCommand, b: ChordCommand): boolean =>
  JSON.stringify(a, Object.keys(a).sort()) === JSON.stringify(b, Object.keys(b).sort());

/**
 * The key for an action, by inverting the keymap: the first of HINT_KEYS that
 * matchChord (or, for the clipboard, clipboardChord) resolves to it. Null when
 * no key runs it — the three bends without a letter, Clear selection.
 */
function hintFor(action: MenuAction): string[] | null {
  return (
    HINT_KEYS.find((keys) => {
      const keydown = keydownOf(keys);
      const command = matchChord(keydown);
      if (action.kind === "clipboard") return command === null && clipboardChord(keydown) === action.action;
      return command !== null && sameCommand(command, action.command);
    }) ?? null
  );
}

function item(id: string, label: string, action: MenuAction, reason: string | null, pressed?: boolean): MenuItem {
  const keys = hintFor(action);
  return {
    id,
    label,
    keyHint: keys && keys.join("+"),
    ariaKeys: keys && keys.map((k) => ARIA_NAME[k] ?? k).join("+"),
    action,
    enabled: reason === null,
    reason,
    ...(pressed === undefined ? {} : { pressed }),
  };
}

const run = (command: ChordCommand): MenuAction => ({ kind: "command", command });
const clip = (action: ClipboardChord): MenuAction => ({ kind: "clipboard", action });

/**
 * Cut, Copy, Paste and Paste in front — the same four items in the note menu
 * and the selection menu. `reason` says why a clipboard command cannot act on
 * the bar the menu checks (null when it can). Paste, in front or over, is
 * enabled whenever the bar is, since the clipboard cannot be read ahead —
 * unless the page has no clipboard to read and the editor no passage of its own.
 */
function clipboardItems(reason: (verb: ClipCommand) => string | null, clipboard: MenuInput["clipboard"]): MenuItem[] {
  const paste = reason("paste") ?? (clipboard.secure || clipboard.hasFallbackClip ? null : NOTHING_TO_PASTE);
  return [
    item("cut", "Cut", clip("cut"), reason("cut")),
    item("copy", "Copy", clip("copy"), reason("copy")),
    item("paste", "Paste", clip("paste"), paste),
    item("pasteInsert", "Paste in front", clip("pasteInsert"), paste),
  ];
}

/**
 * What the note menu holds at the caret, or the selection menu over a
 * selection: the groups, each item with its key, whether it is enabled — and
 * if not, why — and a toggle's pressed state. Decided by cheap checks on the
 * text and its parse, never by running a command; the command itself still
 * decides when it runs, and says why when it refuses.
 *
 * The checks: every item is disabled while the tab does not parse. An item
 * that rewrites beats needs the bar it starts in to be one the commands read
 * (isEditableBar) — the caret's bar, or the selection's first — and names the
 * bar if not; Delete beat, Delete bar, Insert beat and Remove do not read it.
 * A technique and Clear need a note on the caret's string; Tie needs what
 * toggleTie needs (an earlier note to tie to, or, to untie, a fret it can
 * name); Fix bar is there only when the caret's bar does not add up. Paste is
 * enabled whenever the bar is, since the clipboard cannot be read ahead —
 * unless the page has no clipboard to read and the editor no passage of its
 * own.
 */
export function menuItems(input: MenuInput): MenuGroup[] {
  const { tex, parsed, caret, selection, clipboard } = input;
  const ok = parsed.ok && parsed.scoreNode !== null;
  const bar = selection ? selection.from.barIndex : caret.barIndex;
  const editable = ok && isEditableBar(tex, parsed, bar);
  const clipReason = (verb: ClipCommand) => (!ok ? PARSE_REASON : editable ? null : clipOutcomeNotice(verb, refuse(bar)));
  const parses = ok ? null : PARSE_REASON;

  if (selection) {
    return [
      {
        label: "Edit",
        items: [
          item("clear", "Clear", run({ kind: "clearNote" }), clipReason("clear")),
          item("remove", "Remove", run({ kind: "deleteBeat" }), parses),
          ...clipboardItems(clipReason, clipboard),
          item("duplicate", "Duplicate", run({ kind: "duplicate" }), clipReason("duplicate")),
        ],
      },
      { label: "Selection", items: [item("clearSelection", "Clear selection", run({ kind: "clearSelection" }), parses)] },
    ];
  }

  // Why an item that rewrites the caret's beat cannot: the parse first, then the bar. The bar gate
  // is deliberately stricter than the keys: `i`, the technique keys and Delete still act in a bar the
  // commands cannot read. The menu holds them back there to protect a bar whose text and model
  // disagree (`*N`, `\voice`), where those keys act on the wrong beat.
  const change = !ok ? PARSE_REASON : editable ? null : refusedNotice(bar, "change");
  const range = ok ? beatSpliceRange(tex, parsed.scoreNode, caret) : null;
  const note = range ? (parseBeatText(sliceCp(tex, range.cpStart, range.cpEnd))?.notes.find((n) => n.string === caret.string) ?? null) : null;
  const onNote = change ?? (note ? null : NO_NOTE_REASON);
  const pressed: ReadonlySet<Technique> = ok ? techniquesAt(tex, parsed.scoreNode, caret) : new Set();
  const tied = note?.fret === TIE;
  let tie = change;
  if (tie === null) {
    const origin = tieOrigin(tex, parsed.scoreNode, caret).kind;
    if (tied) tie = origin === "blocked" ? refusedNotice(bar, "change") : null;
    else tie = origin === "none" ? NOTHING_TO_TIE_NOTICE : null;
  }
  const state = ok && parsed.score ? barState(parsed.score, bar).kind : "exact";
  const broken = state === "short" || state === "long";

  return [
    {
      label: "Length",
      items: [
        item("shorter", "Shorter", run({ kind: "scaleDuration", direction: "halve" }), change),
        item("longer", "Longer", run({ kind: "scaleDuration", direction: "double" }), change),
        item("dotted", "Dotted", run({ kind: "toggleDotted" }), change),
        item("triplet", "Triplet", run({ kind: "toggleTuplet" }), change, ok && tupletAt(tex, parsed.scoreNode, caret) === TRIPLET),
        item("rest", "Rest", run({ kind: "makeRest" }), change),
      ],
    },
    {
      label: "Techniques",
      items: TECHNIQUES.map((technique) =>
        item(technique, TECHNIQUE_LABEL[technique], run({ kind: "toggleTechnique", technique }), onNote, pressed.has(technique)),
      ),
    },
    { label: "Tie", items: [item("tie", "Tie", run({ kind: "toggleTie" }), tie, tied)] },
    {
      label: "Edit",
      items: [
        ...clipboardItems(clipReason, clipboard),
        item("duplicate", "Duplicate bar", run({ kind: "duplicate" }), clipReason("duplicate")),
        item("clear", "Clear", run({ kind: "clearNote" }), onNote),
        item("deleteBeat", "Delete beat", run({ kind: "deleteBeat" }), parses),
        item("deleteBar", "Delete bar", run({ kind: "deleteBar" }), parses),
      ],
    },
    {
      label: "Bar",
      items: [
        ...(broken ? [item("fixBar", "Fix bar", run({ kind: "fixBar" }), editable ? null : refusedNotice(bar, "fix"))] : []),
        item("insertBeat", "Insert beat", run({ kind: "insertBeat" }), parses),
      ],
    },
  ];
}

/**
 * Where an arrow key moves focus in the menu, by item index across all its
 * groups (`sizes` is each group's item count): Down and Up to the next and
 * previous item, Home and End to the first and last, Right and Left to the
 * first item of the next and previous group — all wrapping round. From no
 * item (-1), Down, Right and Home go to the first item, Up and End to the
 * last item, and Left to the last group's first item. Null for any other key.
 */
export function menuStep(sizes: number[], index: number, key: string): number | null {
  const total = sizes.reduce((sum, n) => sum + n, 0);
  if (total === 0) return null;
  const starts = sizes.map((_, g) => sizes.slice(0, g).reduce((sum, n) => sum + n, 0)).filter((_, g) => sizes[g] > 0);
  const group = index < 0 ? -1 : starts.filter((start) => start <= index).length - 1;
  switch (key) {
    case "ArrowDown":
      return index < 0 ? 0 : (index + 1) % total;
    case "ArrowUp":
      return index < 0 ? total - 1 : (index - 1 + total) % total;
    case "Home":
      return 0;
    case "End":
      return total - 1;
    case "ArrowRight":
      return index < 0 ? 0 : starts[(group + 1) % starts.length];
    case "ArrowLeft":
      return index < 0 ? starts[starts.length - 1] : starts[(group - 1 + starts.length) % starts.length];
    default:
      return null;
  }
}

/**
 * Whether an open menu stays open after a command ran (spec §1's table): not
 * after one that closes it whatever it did (closesMenu), nor after one that
 * moved the caret — its bar, beat or string, compared by value — nor when a
 * selection came or went under a menu made for the other (a fret typed over a
 * selection clears it first). Every other command leaves it open, so edits
 * stack on one note.
 */
export function menuStaysOpen(
  kind: ChordCommand["kind"],
  scope: "note" | "selection",
  before: Caret,
  after: Caret,
  selecting: boolean,
): boolean {
  return !closesMenu(kind) && sameCaret(before, after) && selecting === (scope === "selection");
}
