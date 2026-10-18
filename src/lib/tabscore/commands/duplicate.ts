import { parseTex } from "../parse";
import type { Caret } from "../locate";
import { refuse, type EditOutcome } from "../apply";
import { copyRange } from "../clip";
import { barRange, isWholeBars, stillValid, type Range } from "../selection";
import { insertClipBars, insertClipBeats } from "./paste";
import { isOnePart } from "./rangeEdit";

/**
 * `d`: repeat music right after itself. With nothing selected, the caret's
 * bar; with whole bars selected, those bars; with beats inside one bar
 * selected, those beats — the bar grows. Beats across a bar line are
 * refused. The copy is the copy Ctrl+C makes, so it carries no directives:
 * a bar that closes a repeat keeps its sign, and the copy lands after it.
 * The copy is selected afterwards, caret on its first beat.
 *
 * The edges are paste's (insertClipBars, insertClipBeats): the first beat
 * after the copy keeps its duration, and ties and legato across it are
 * rewritten, or the command refused — except paste's rule for a left-hand
 * tap, which a copy right after the beats it repeats has no need of. A
 * refusal names a bar being copied, never the bar the copy would go in front
 * of: the one copyRange could not copy; else, for bars, the caret's
 * (insertClipBars), and for beats, their own bar, which the copy goes into
 * too (insertClipBeats). Whole bars in a tab of more than one track, staff or
 * voice are refused saying so (`severalTracks`). A range an edit has stranded
 * is refused like any bar the commands cannot read, not as beats across a bar
 * line.
 */
export function duplicate(text: string, caret: Caret, range: Range | null): EditOutcome {
  const { scoreNode, score, ok } = parseTex(text);
  const target = ok ? (range ?? barRange(scoreNode, caret.barIndex)) : null;
  if (!target) return refuse(caret.barIndex);
  if (!stillValid(scoreNode, target)) return refuse(target.from.barIndex);
  const whole = range === null || isWholeBars(scoreNode, range);
  if (!whole && target.from.barIndex !== target.to.barIndex) {
    return refuse(target.from.barIndex, "crossesBarLine");
  }
  // New bars would put a tab's other tracks, staves or voices out of step:
  // say so, as insertClipBars would, before copyRange refuses the bar itself.
  if (whole && !isOnePart(score)) return refuse(caret.barIndex, "severalTracks");
  const copied = copyRange(text, target);
  if (copied.kind !== "copied") return copied;
  return whole
    ? insertClipBars(text, caret, target.to.barIndex + 1, copied.clip)
    : insertClipBeats(text, caret, target.to, true, copied.clip, { repeats: true });
}
