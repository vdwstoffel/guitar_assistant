import type { RangeSize } from "./selection";
import { pastedNotice } from "./clipMessages";

/**
 * Every sentence the note menu says — why an item is disabled, and what a
 * menu Paste reports — in one place so each wording is tested once, with the
 * two editor notices the keys, the toolbar and the menu share, moved here from
 * TabEditor so runCommand.ts can say them. A disabled item that a bar the
 * commands cannot read stops gives barMessages' or clipMessages' sentence for
 * that bar instead.
 */

/** Any canvas command while the source does not parse. */
export const PARSE_ERROR_NOTICE = "Fix the source errors to edit on the canvas";

/**
 * A tie sounds the PREVIOUS note on the same string again. With nothing
 * earlier on that string alphaTex still accepts `-`, but renders it as an
 * open string — so the command refuses, and this says why. The menu's Tie gives the
 * same sentence as its reason.
 */
export const NOTHING_TO_TIE_NOTICE = "Nothing earlier on this string to tie to";

/** Every item of the menu while the source does not parse. */
export const PARSE_REASON = "The tab doesn't parse";

/** A technique, or Clear, with no note on the caret's string. */
export const NO_NOTE_REASON = "No note on this string";

/**
 * Paste with nothing to paste: a reason when the page cannot read the system
 * clipboard and the editor holds no passage of its own; a notice when a menu
 * Paste found neither.
 */
export const NOTHING_TO_PASTE = "Nothing to paste";

/** A menu Paste the browser would not let read the clipboard, so it pasted the editor's own last copy. */
export const pastedFromEditorNotice = (size: RangeSize) =>
  `${pastedNotice(size)} copied in the editor — the browser didn't share its clipboard`;
