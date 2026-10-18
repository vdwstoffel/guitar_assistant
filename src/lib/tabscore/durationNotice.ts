import { parseTex } from "./parse";
import { findBeatNode, type Caret } from "./locate";
import { DURATIONS } from "./durationValues";
import { durationAt } from "./repin";
import { refusedNotice } from "./barMessages";

/** The keys that change a beat's length: `-` halves, `+` doubles, `.` toggles the dot. */
export type DurationCommand = "halve" | "double" | "dot";

/**
 * What to tell the user when a duration key returned null at `caret`: null
 * when it had nothing to do — halving the shortest value the editor writes
 * (a 64th), doubling the longest (a whole), no beat at the caret — and
 * otherwise the refusal notice for the caret's bar: the key could have acted
 * but for a beat it cannot read, in the caret's bar or the beat after the
 * edit that must keep its duration (repinAt). Ask only after a null; after a
 * result the answer means nothing. A document that does not parse has its own
 * notice, so it gets none here.
 *
 * Like removalNotice, it calls every null but the limit a refusal rather than
 * work out which beat was in the way: a notice that sends the user to the
 * source beats a key that does nothing, unexplained.
 */
export function durationNotice(command: DurationCommand, text: string, caret: Caret): string | null {
  const { scoreNode, ok } = parseTex(text);
  if (!ok || !scoreNode || !findBeatNode(scoreNode, caret)) return null;
  if (command !== "dot") {
    const i = DURATIONS.indexOf(durationAt(scoreNode, caret));
    // A value the editor does not write (`.128`, `.-2`) cannot be stepped: that is a refusal, not a limit.
    if (i !== -1 && DURATIONS[command === "halve" ? i + 1 : i - 1] === undefined) return null;
  }
  return refusedNotice(caret.barIndex, "change");
}
