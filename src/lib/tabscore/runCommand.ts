import { parseTex } from "./parse";
import { normalizeNewlines } from "./offsets";
import type { BeatPos, Caret } from "./locate";
import type { CommandResult, EditOutcome } from "./apply";
import { actsOnSelection, type ChordCommand } from "./keymap";
import type { PreviewSource } from "./notePreview";
import {
  barRange, extendByBeat, extendToBarEdge, isWholeBars, rangeOf, selectAll, sizeOf, type Range, type RangeSize,
} from "./selection";
import { copyRange, readClip } from "./clip";
import { clearRange, removeRange } from "./commands/rangeEdit";
import { pasteInsert, pasteOverwrite } from "./commands/paste";
import { duplicate } from "./commands/duplicate";
import {
  clipOutcomeNotice, copiedNotice, cutNotice, duplicatedNotice, NOT_A_PASSAGE_NOTICE, pastedNotice, type ClipCommand,
} from "./clipMessages";
import { setFret, clearNote } from "./commands/setFret";
import { scaleDuration, toggleDotted } from "./commands/duration";
import { insertBeat, deleteBeat, addBar, deleteBar, extendScore } from "./commands/structure";
import { toggleTechnique } from "./commands/technique";
import { tieRefusal, toggleTie } from "./commands/tie";
import { toggleTuplet, TRIPLET } from "./commands/tuplet";
import { makeRest } from "./commands/rest";
import { fixBar } from "./commands/fixBar";
import { moveBeat, moveString } from "./commands/navigate";
import { outcomeNotice, refusedNotice, type OutcomeCommand } from "./barMessages";
import { removalNotice, type RemovalCommand } from "./removalNotice";
import { durationNotice, type DurationCommand } from "./durationNotice";
import { NOTHING_TO_TIE_NOTICE, PARSE_ERROR_NOTICE } from "./menuMessages";

// The bar commands' notices say what changed and how to undo it, which takes
// longer to read than "that did nothing".
export const BAR_NOTICE_MS = 4000;
const DIGIT_COMPOSE_MS = 800;

/** Two-digit fret entry: the digits typed so far on this caret, and when. */
export interface DigitBuffer {
  digits: string;
  at: number;
}

/**
 * What running a command needs from the editor, passed in so that a key, a
 * toolbar button and a menu item all go through the one dispatch below, and
 * so that it runs under vitest. Every getter answers with the editor's value
 * at the moment it is called: commit and moveCaret update what text() and
 * caret() say at once, as TabEditor's refs do.
 */
export interface CommandDeps {
  text(): string;
  caret(): Caret;
  /** The selection's fixed end — its head is the caret — or null for none. */
  anchor(): BeatPos | null;
  /** Whether the text parses, as of the editor's last render. */
  parsedOk(): boolean;
  digits(): DigitBuffer | null;
  setDigits(buffer: DigitBuffer | null): void;
  now(): number;
  /** An edit: the new text, the caret after it, and the selection after it — none unless one is passed. */
  commit(text: string, caret?: Caret, anchor?: BeatPos | null): void;
  moveCaret(caret: Caret): void;
  setAnchor(anchor: BeatPos | null): void;
  /** A notice above the score, for `ms` or the editor's own default. */
  notice(message: string, ms?: number): void;
  preview(prev: Caret, next: Caret, source: PreviewSource): void;
  undo(): void;
  redo(): void;
  playPause(): void;
  toggleHelp(): void;
  /** Enter, the Menu key and Shift+F10: the note menu at the caret. */
  openMenu(): void;
}

/**
 * Run a chord command as its key always has, wherever it comes from: a
 * keydown the editor claimed, a toolbar button, a note-menu item. Everything
 * after the match is here, once — the selection rule, the commands exempt
 * from the parse guard, the guard, the dispatch, the notices and feature 1's
 * preview — so the three can never drift apart again.
 */
export function runCommand(command: ChordCommand, deps: CommandDeps): void {
  // A command that does not act on the selection clears it first, then acts
  // at the caret as it always has.
  if (deps.anchor() !== null && !actsOnSelection(command.kind)) deps.setAnchor(null);

  // Exempt from the parsing guard below: undo/redo replay committed
  // history snapshots — never the current, possibly-broken, text — and
  // playback controls whatever ScoreCanvas last rendered successfully.
  // Neither reads the current (possibly stale/absent) AST, so neither
  // is subject to the "stale AST" hazard the guard exists to prevent.
  if (command.kind === "undo") {
    deps.undo();
    return;
  }
  if (command.kind === "redo") {
    deps.redo();
    return;
  }
  if (command.kind === "playPause") {
    const c0 = deps.caret();
    deps.setDigits(null); // see undo's comment in TabEditor
    deps.preview(c0, c0, { kind: "command", command: "playPause", accepted: true });
    deps.playPause();
    return;
  }
  // Also exempt, and for a stronger reason than the three above: the
  // help panel reads nothing from the document. Gating it on a parsing
  // document would hide the shortcut list exactly when a confused user
  // most needs it.
  if (command.kind === "showHelp") {
    deps.setDigits(null);
    deps.toggleHelp();
    return;
  }
  // So is the note menu: it reads the document only to grey out what cannot
  // run, so on a tab that does not parse it opens with every item disabled
  // and says why, rather than not opening at all.
  if (command.kind === "openMenu") {
    deps.setDigits(null);
    deps.openMenu();
    return;
  }

  // Behaviour 4 / Review Focus item 5: every remaining command reads or
  // writes through the current AST — moveBeat/moveString included, since a
  // caret silently frozen in place while the document doesn't parse is the
  // same "feels broken" failure as a rejected edit.
  if (!deps.parsedOk()) {
    deps.setDigits(null);
    deps.notice(PARSE_ERROR_NOTICE);
    return;
  }

  const text = deps.text();
  const c = deps.caret();
  const applyResult = (result: CommandResult | null) => {
    if (result) deps.commit(result.text, result.caret);
    deps.preview(c, result ? result.caret : c, {
      kind: "command",
      command: command.kind,
      accepted: result !== null,
    });
  };
  // `r` and Shift+B also say why they did nothing, and what a fix changed.
  const applyOutcome = (kind: OutcomeCommand, outcome: EditOutcome) => {
    applyResult(outcome.kind === "ok" ? outcome.result : null);
    const message = outcomeNotice(outcome, c.barIndex, kind);
    if (message) deps.notice(message, BAR_NOTICE_MS);
  };
  // `+`/`-` and `.` leave alone what they could only change by guessing
  // at a beat they cannot read — in the caret's bar, or the beat after the
  // edit that must keep its duration. Say so, as `r` and Shift+B do,
  // rather than seem to ignore the key; at the shortest or longest value
  // there is nothing to do, and that stays quiet (durationNotice decides).
  const applyDuration = (kind: DurationCommand, result: CommandResult | null) => {
    applyResult(result);
    const message = result ? null : durationNotice(kind, text, c);
    if (message) deps.notice(message, BAR_NOTICE_MS);
  };
  // Delete, Shift+Delete and Ctrl+Shift+Backspace leave alone what they
  // could only change by guessing at a beat they cannot read — the ties
  // after a note that goes, the duration of the beat after a beat or bar
  // that goes. Say so rather than seem to ignore the key; with nothing to
  // delete (an empty string, a bar's only beat) they stay quiet.
  const applyRemoval = (kind: RemovalCommand, result: CommandResult | null) => {
    applyResult(result);
    const message = result ? null : removalNotice(kind, text, c);
    if (message) deps.notice(message, BAR_NOTICE_MS);
  };

  if (command.kind === "setFret") {
    // Behaviour 3: two-digit fret entry. The first digit always applies
    // on its own; a second digit within the window on the same caret
    // (never moved in between — see TabEditor's moveCaret) composes with
    // it. A third rapid digit would need 3+ characters, which can never be
    // a valid fret (max 24), so it starts fresh instead of composing
    // rather than silently failing.
    const now = deps.now();
    const buf = deps.digits();
    const digit = String(command.digit);
    const digits = buf && buf.digits.length < 2 && now - buf.at <= DIGIT_COMPOSE_MS ? buf.digits + digit : digit;
    deps.setDigits({ digits, at: now });
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
    const atEnd = command.delta === 1 && moved.barIndex === c.barIndex && moved.beatIndex === c.beatIndex;
    if (atEnd) {
      // `text` is the editor's latest text, which commit updates eagerly,
      // and extendScore parses it itself rather than trusting the editor's
      // parse — that is only refreshed after the next render, so while
      // typing at speed it can be one edit behind and "is this bar short?"
      // would be answered about the previous state. A bar that is not short
      // rolls over to a new bar instead of taking beats past the bar line; a
      // short one takes another beat.
      const grown = extendScore(text, c);
      if (grown) {
        // Same reason moveCaret clears it: the caret is moving, so a
        // half-typed fret must not compose with the next digit. Without
        // this, typing 7 → 9 composed "79", which exceeds fret 24, and
        // setFret rejected it — the keystroke vanished with no feedback.
        deps.setDigits(null);
        deps.commit(grown.text, grown.caret);
        deps.preview(c, grown.caret, { kind: "extend" });
        return;
      }
    }
    deps.moveCaret(moved);
    deps.preview(c, moved, { kind: "command", command: "moveBeat", accepted: true });
    return;
  }
  if (command.kind === "moveString") {
    const next = moveString(c, command.delta);
    deps.moveCaret(next);
    deps.preview(c, next, { kind: "command", command: "moveString", accepted: true });
    return;
  }
  if (command.kind === "extendSelection" || command.kind === "extendSelectionToBar") {
    // Parsed afresh, as moveBeat does: the editor's parse can be one edit
    // behind. Never grows the score at its end, unlike a plain →.
    const { scoreNode } = parseTex(text);
    const head =
      command.kind === "extendSelection"
        ? extendByBeat(scoreNode, c, command.delta)
        : extendToBarEdge(scoreNode, c, command.delta);
    if (!deps.anchor()) deps.setAnchor({ barIndex: c.barIndex, beatIndex: c.beatIndex });
    deps.moveCaret(head);
    deps.preview(c, head, { kind: "command", command: command.kind, accepted: true });
    return;
  }

  // Every remaining command is a discrete action, not a composition —
  // clear the buffer once, up front, rather than repeating it per case.
  deps.setDigits(null);

  // Delete, Shift+Delete and d over a selection; refusals say why and
  // change nothing, the selection included.
  const anchor = deps.anchor();
  const range = anchor && rangeOf(anchor, c);
  const applyRangeEdit = (clipCommand: ClipCommand, outcome: EditOutcome, keep: BeatPos | null) => {
    if (outcome.kind === "ok") deps.commit(outcome.result.text, outcome.result.caret, keep);
    deps.preview(c, outcome.kind === "ok" ? outcome.result.caret : c, {
      kind: "command",
      command: command.kind,
      accepted: outcome.kind === "ok",
    });
    const message = clipOutcomeNotice(clipCommand, outcome);
    if (message) deps.notice(message, BAR_NOTICE_MS);
  };
  if (range && command.kind === "clearNote") {
    applyRangeEdit("clear", clearRange(text, c, range), anchor);
    return;
  }
  if (range && command.kind === "deleteBeat") {
    // Whole bars go as bars, and a refusal then says bars, not beats.
    const bars = isWholeBars(parseTex(text).scoreNode, range);
    applyRangeEdit(bars ? "removeBars" : "remove", removeRange(text, c, range), null);
    return;
  }
  switch (command.kind) {
    case "clearNote":
      applyRemoval("clearNote", clearNote(text, c));
      return;
    case "insertBeat":
      applyResult(insertBeat(text, c));
      return;
    case "deleteBeat":
      applyRemoval("deleteBeat", deleteBeat(text, c));
      return;
    case "addBar":
      applyResult(addBar(text, c));
      return;
    case "deleteBar":
      applyRemoval("deleteBar", deleteBar(text, c));
      return;
    case "scaleDuration":
      applyDuration(command.direction, scaleDuration(text, c, command.direction));
      return;
    case "toggleDotted":
      applyDuration("dot", toggleDotted(text, c));
      return;
    case "toggleTechnique":
      applyResult(toggleTechnique(text, c, command.technique));
      return;
    case "toggleTuplet":
      applyResult(toggleTuplet(text, c, TRIPLET));
      return;
    case "toggleTie": {
      // A null here has a specific, actionable cause — there is no
      // earlier note on this string — and saying so beats the generic
      // "that did nothing". Unless it was an untie it declined because a
      // beat it cannot read hides the fret: that is a refusal.
      const tied = toggleTie(text, c);
      applyResult(tied);
      if (!tied) {
        if (tieRefusal(text, c) === "refused") deps.notice(refusedNotice(c.barIndex, "change"), BAR_NOTICE_MS);
        else deps.notice(NOTHING_TO_TIE_NOTICE);
      }
      return;
    }
    case "makeRest":
      applyOutcome("makeRest", makeRest(text, c));
      return;
    case "fixBar":
      applyOutcome("fixBar", fixBar(text, c));
      return;
    case "selectAll": {
      const all = selectAll(parseTex(text).scoreNode);
      if (all) {
        deps.setAnchor(all.from);
        deps.moveCaret({ ...c, ...all.to });
      }
      return;
    }
    case "clearSelection":
      deps.setAnchor(null);
      return;
    case "duplicate": {
      const scoreNode = parseTex(text).scoreNode;
      const what = range ?? barRange(scoreNode, c.barIndex);
      const outcome = duplicate(text, c, range);
      // The copy is selected, caret on its first beat: the anchor is its last.
      applyRangeEdit("duplicate", outcome, outcome.kind === "ok" ? (outcome.selection?.to ?? null) : null);
      if (outcome.kind === "ok" && what) {
        deps.notice(duplicatedNotice(sizeOf(scoreNode, what), what.from.barIndex), BAR_NOTICE_MS);
      }
      return;
    }
    default: {
      // Exhaustiveness check: a compile error here means a new ChordCommand
      // kind was added to keymap.ts without being handled above (undo, redo,
      // playPause, showHelp, openMenu, setFret, moveBeat, moveString and the
      // two selection extends are narrowed out by the early returns above
      // this switch).
      const exhaustiveCheck: never = command;
      return exhaustiveCheck;
    }
  }
}

/** What Ctrl+C and Ctrl+X take: the selection, or the beat at the caret. */
function clipRange(deps: CommandDeps): Range {
  const c = deps.caret();
  const anchor = deps.anchor();
  return anchor ? rangeOf(anchor, c) : rangeOf(c, c);
}

/**
 * Copy — Ctrl+C's copy event, or the note menu's Copy: the clip's text to
 * put on the clipboard, having said what it copied; or null, having said
 * why, when there is nothing to put there. Honours the parse guard: while
 * the source does not parse it changes nothing and keeps the selection.
 */
export function copyText(deps: CommandDeps): string | null {
  deps.setDigits(null);
  if (!deps.parsedOk()) {
    deps.notice(PARSE_ERROR_NOTICE);
    return null;
  }
  const c = deps.caret();
  const copied = copyRange(deps.text(), clipRange(deps));
  if (copied.kind !== "copied") {
    const message = clipOutcomeNotice("copy", copied);
    if (message) deps.notice(message, BAR_NOTICE_MS);
    return null;
  }
  deps.notice(copiedNotice(copied.clip), BAR_NOTICE_MS);
  deps.preview(c, c, { kind: "clipboard", action: "copy", accepted: true });
  return copied.clip.text;
}

/**
 * Cut — a copy and then Delete: the beats become rests of the same length,
 * and the selection stays. The clip's text to put on the clipboard; null,
 * changing nothing, unless both halves can be done.
 */
export function cutText(deps: CommandDeps): string | null {
  deps.setDigits(null);
  if (!deps.parsedOk()) {
    deps.notice(PARSE_ERROR_NOTICE);
    return null;
  }
  const c = deps.caret();
  const range = clipRange(deps);
  const copied = copyRange(deps.text(), range);
  const cleared = copied.kind === "copied" ? clearRange(deps.text(), c, range) : copied;
  if (copied.kind !== "copied" || cleared.kind === "refused") {
    const message = clipOutcomeNotice("cut", copied.kind !== "copied" ? copied : cleared);
    if (message) deps.notice(message, BAR_NOTICE_MS);
    return null;
  }
  if (cleared.kind === "ok") deps.commit(cleared.result.text, cleared.result.caret, deps.anchor());
  deps.notice(cutNotice(copied.clip), BAR_NOTICE_MS);
  deps.preview(c, c, { kind: "clipboard", action: "cut", accepted: cleared.kind === "ok" });
  return copied.clip.text;
}

/**
 * Paste `raw` — a paste event's text, or what the note menu's Paste read —
 * over the music at the selection's first beat or the caret, or in front of
 * it (`inserts`, Ctrl+Shift+V). The pasted music is selected afterwards,
 * caret on its first beat. Line ends are normalised first, as at every
 * boundary that brings text in: a Windows clipboard's CRLF must not reach the
 * parser's offsets. It reads the text, the caret and the parse when it runs,
 * so a paste that waited on the clipboard lands on the document as it is
 * then. `said` words the notice when it acts.
 */
export function pasteText(
  deps: CommandDeps,
  raw: string,
  inserts: boolean,
  said: (size: RangeSize) => string = pastedNotice,
): void {
  deps.setDigits(null);
  if (!deps.parsedOk()) {
    deps.notice(PARSE_ERROR_NOTICE);
    return;
  }
  const clip = readClip(normalizeNewlines(raw));
  if (!clip) {
    deps.notice(NOT_A_PASSAGE_NOTICE, BAR_NOTICE_MS);
    return;
  }
  const c = deps.caret();
  const at = { ...c, ...clipRange(deps).from };
  const outcome = (inserts ? pasteInsert : pasteOverwrite)(deps.text(), at, clip);
  if (outcome.kind === "ok") {
    deps.commit(outcome.result.text, outcome.result.caret, outcome.selection?.to ?? null);
    deps.notice(said(clip), BAR_NOTICE_MS);
  } else {
    const message = clipOutcomeNotice("paste", outcome);
    if (message) deps.notice(message, BAR_NOTICE_MS);
  }
  deps.preview(c, outcome.kind === "ok" ? outcome.result.caret : c, {
    kind: "clipboard",
    action: "paste",
    accepted: outcome.kind === "ok",
  });
}

/** Where the note menu's Paste may find a passage. */
export interface PasteSources {
  /** `navigator.clipboard.readText`, where the page has a clipboard to read (a secure context). */
  readText?: () => Promise<string>;
  /** The passage last copied or cut in the editor, this page load; null for none. */
  editorClip: string | null;
  /** The editor's clip is newer than the system clipboard: a menu Copy the page could not put there. */
  editorClipNewer: boolean;
}

/**
 * What the note menu's Paste pastes: the editor's own clip when it is newer
 * than the system clipboard; else the system clipboard (reading it may ask
 * for permission, once); else — no clipboard to read, the read refused, or
 * nothing on it — the editor's own clip, `blocked` when the browser refused
 * the read. Null when there is nothing at all.
 */
export async function readForPaste(sources: PasteSources): Promise<{ raw: string; blocked: boolean } | null> {
  const { readText, editorClip, editorClipNewer } = sources;
  if (editorClipNewer && editorClip !== null) return { raw: editorClip, blocked: false };
  let blocked = false;
  if (readText) {
    try {
      const text = await readText();
      if (text) return { raw: text, blocked: false };
    } catch {
      blocked = true;
    }
  }
  return editorClip !== null ? { raw: editorClip, blocked } : null;
}
