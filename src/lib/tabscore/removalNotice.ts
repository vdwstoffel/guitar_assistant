import { parseTex } from "./parse";
import { countBars, type Caret } from "./locate";
import { readBar } from "./commands/barEdit";
import { refusedNotice } from "./barMessages";

/**
 * The keys that take something away: Delete, Shift+Delete and Ctrl+Shift+
 * Backspace, and the − Beat and − Bar buttons that run the last two.
 */
export type RemovalCommand = "clearNote" | "deleteBeat" | "deleteBar";

/**
 * What to tell the user when a removal command returned null at `caret`: the
 * refusal notice for the caret's bar when it could have gone ahead but for a
 * beat it cannot read, otherwise null — it had nothing to do, and a key that
 * does nothing needs no explaining. Ask only after a null; after a result the
 * answer means nothing.
 *
 * - clearNote: the caret's beat can be read and holds a note on the caret's
 *   string. What it declined is then the cleanup of the ties and hammer-ons
 *   that pointed at the note, which stops at a beat it cannot read.
 * - deleteBeat: the bar has another beat (a bar's only beat cannot go). What
 *   it declined is then giving the beat after it the duration it would
 *   otherwise lose (repinAt), which it will not write onto one it cannot read.
 * - deleteBar: the score has another bar (its only bar cannot go); likewise
 *   for the next bar's first beat.
 *
 * The two deletes call every null but their limit a refusal, rather than work
 * out which beat was in the way: a notice that sends the user to the source
 * beats a key that does nothing, unexplained.
 */
export function removalNotice(command: RemovalCommand, text: string, caret: Caret): string | null {
  const { scoreNode, ok } = parseTex(text);
  if (!ok || !scoreNode) return null;
  const bar = readBar(text, scoreNode, caret.barIndex);
  let refused: boolean;
  switch (command) {
    case "clearNote":
      refused = bar?.[caret.beatIndex]?.beat?.notes.some((note) => note.string === caret.string) ?? false;
      break;
    case "deleteBeat":
      refused = (bar?.length ?? 0) > 1;
      break;
    case "deleteBar":
      refused = countBars(scoreNode) > 1;
      break;
    default: {
      // A compile error here means a RemovalCommand was added without saying
      // when its refusal is worth a notice.
      const unhandled: never = command;
      return unhandled;
    }
  }
  return refused ? refusedNotice(caret.barIndex, "change") : null;
}
