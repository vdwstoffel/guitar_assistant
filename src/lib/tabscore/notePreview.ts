import type { Caret } from "./locate";
import type { ChordCommand } from "./keymap";

/**
 * Where a preview decision comes from.
 * - `command`: a key, or the toolbar/structural button that runs the same
 *   command; `accepted` is whether the command function returned a result.
 * - `extend`: the → that grows the score at its end (it bypasses moveBeat).
 * - `click`: a press on the score, on release; `dragged` when it became a drag.
 *   A Shift+click that extends the selection is one too.
 * - `clipboard`: Ctrl+C, Ctrl+X or a paste; `accepted` is whether it acted.
 * - `excluded`: the Source pane, the tempo/tuning/repeat-sign controls, Stop,
 *   and switching Notes off.
 */
export type PreviewSource =
  | { kind: "command"; command: ChordCommand["kind"]; accepted: boolean }
  | { kind: "extend" }
  | { kind: "click"; dragged: boolean }
  | { kind: "clipboard"; action: "copy" | "cut" | "paste"; accepted: boolean }
  | { kind: "excluded" };

/**
 * - `request`: (re)start the wait and queue the caret as a candidate.
 * - `none`: leave any pending preview alone.
 * - `cancel`: drop the pending preview and stop one that is sounding.
 */
export type PreviewAction = "request" | "none" | "cancel";

const sameBeat = (a: Caret, b: Caret) => a.barIndex === b.barIndex && a.beatIndex === b.beatIndex;

/**
 * What an input does to the note preview. Moves are compared by position,
 * never identity: every command returns a new caret object.
 */
export function previewAction(prev: Caret, next: Caret, source: PreviewSource): PreviewAction {
  switch (source.kind) {
    case "extend":
      return "request";
    case "click":
      return source.dragged ? "none" : "request";
    case "excluded":
      return "cancel";
    case "clipboard":
      // A copy changes nothing to hear. A paste previews its first beat; a
      // cut leaves rests, which sound nothing and cut nothing off (as `r`).
      return source.action !== "copy" && source.accepted ? "request" : "none";
    case "command":
      return commandAction(prev, next, source.command, source.accepted);
    default: {
      // A compile error here means PreviewSource gained a kind that has not
      // been given a preview behaviour.
      const unhandled: never = source;
      return unhandled;
    }
  }
}

function commandAction(
  prev: Caret,
  next: Caret,
  kind: ChordCommand["kind"],
  accepted: boolean,
): PreviewAction {
  switch (kind) {
    // A rejected edit changed nothing, so there is nothing new to hear — and
    // `none`, not `cancel`, so the previous edit's pending preview still plays.
    case "setFret":
    case "clearNote":
    case "scaleDuration":
    case "toggleDotted":
    case "toggleTechnique":
    case "toggleTie":
    case "toggleTuplet":
    // `r` leaves a rest under the caret, which has nothing to sound (the
    // preview skips it); neither it nor Shift+B is a `cancel`, so neither cuts
    // off a preview that is still sounding.
    case "makeRest":
    case "fixBar":
    case "duplicate":
    case "insertBeat":
    case "deleteBeat":
    case "addBar":
    case "deleteBar":
      return accepted ? "request" : "none";
    case "moveBeat":
    case "extendSelection":
    case "extendSelectionToBar":
      return sameBeat(prev, next) ? "none" : "request";
    // The beat did not change, so there is nothing new to hear.
    case "moveString":
    case "showHelp":
    case "selectAll":
    case "clearSelection":
    case "openMenu":
      return "none";
    // Playback must not be talked over, and undo and redo can leave the caret
    // on beats the user did not choose.
    case "playPause":
    case "undo":
    case "redo":
      return "cancel";
    default: {
      // A compile error here means keymap.ts gained a ChordCommand kind that
      // has not been given a preview behaviour.
      const unhandled: never = kind;
      return unhandled;
    }
  }
}

export interface PreviewScheduler {
  /** Restart the wait and add this caret to the window's candidates. */
  request(caret: Caret): void;
  /** Drop the wait and the candidates. Not terminal: requests work again after. */
  cancel(): void;
}

/**
 * Waits `delayMs` after the last request, then hands over every caret
 * requested in that window, newest first, so the caller can play the newest
 * one that has something to sound — "type 5, →" at the end of the score lands
 * on a fresh rest, and the 5 is still heard. Consecutive requests for the same
 * beat are merged (keeping the latest caret); at most `maxCandidates` are kept.
 */
export function createPreviewScheduler(opts: {
  delayMs: number;
  onFire: (candidatesNewestFirst: Caret[]) => void;
  maxCandidates?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}): PreviewScheduler {
  const setTimer = opts.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer =
    opts.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const maxCandidates = opts.maxCandidates ?? 8;
  let handle: unknown = null;
  let candidates: Caret[] = []; // oldest first

  const fire = () => {
    handle = null;
    const newestFirst = [...candidates].reverse();
    candidates = [];
    opts.onFire(newestFirst);
  };

  return {
    request(caret) {
      const last = candidates[candidates.length - 1];
      if (last && sameBeat(last, caret)) candidates[candidates.length - 1] = caret;
      else candidates.push(caret);
      if (candidates.length > maxCandidates) candidates = candidates.slice(candidates.length - maxCandidates);
      if (handle !== null) clearTimer(handle);
      handle = setTimer(fire, opts.delayMs);
    },
    cancel() {
      if (handle !== null) clearTimer(handle);
      handle = null;
      candidates = [];
    },
  };
}
