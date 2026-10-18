import type { EditOutcome, FixReport } from "./apply";
import type { BrokenBar } from "./barFill";
import { describe } from "./durationValues";

/**
 * Every sentence the editor says about bars, in one place so each wording is
 * tested once: the notices the bar commands show, and the status strip under
 * the score. Bars are numbered from 1, as the score prints them.
 */

export const ALREADY_REST_NOTICE = "Already a rest — type a fret to add a note";

const bar = (barIndex: number) => `bar ${barIndex + 1}`;

/**
 * A command left a bar alone because a beat it would have to rewrite is one it
 * cannot read (barEdit.ts's isEditableBar and misreads). Shift+B and Fix all
 * "fix" a bar; every other command "changes" it.
 */
export const refusedNotice = (barIndex: number, verb: "fix" | "change") =>
  `Can't ${verb} ${bar(barIndex)} automatically — edit it in the source`;
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function fixNotice({ barIndex, removedBeats, shortenedLast, addedRests }: FixReport): string {
  const undo = " — Ctrl+Z to undo";
  // A shortened rest is the last beat; "note" would name something that is not there.
  const last = shortenedLast === "rest" ? "beat" : "note";
  if (removedBeats > 0 && shortenedLast) {
    return `Removed ${count(removedBeats, "beat")} from ${bar(barIndex)} and shortened its last ${last}${undo}`;
  }
  if (removedBeats > 0) return `Removed ${count(removedBeats, "beat")} from ${bar(barIndex)}${undo}`;
  if (shortenedLast) return `Shortened the last ${last} of ${bar(barIndex)}${undo}`;
  return `Added ${count(addedRests, "rest")} to ${bar(barIndex)}${undo}`;
}

/** The commands that report an EditOutcome: `r` and Shift+B. */
export type OutcomeCommand = "makeRest" | "fixBar";

/**
 * The notice for a bar command's outcome at the caret's bar; null when it has
 * nothing to say. A refusal names the bar the outcome names: Shift+B's names
 * the bar it was asked to fix, whatever stopped it.
 */
export function outcomeNotice(outcome: EditOutcome, barIndex: number, command: OutcomeCommand): string | null {
  switch (outcome.kind) {
    case "ok":
      return outcome.report ? fixNotice(outcome.report) : null;
    case "noop":
      switch (outcome.reason) {
        case "alreadyRest":
          return ALREADY_REST_NOTICE;
        case "exact":
        case "exempt":
          return `Bar ${barIndex + 1} already adds up`;
        default: {
          // A compile error here means a no-op reason was added to EditOutcome
          // (apply.ts) without deciding what the user is told about it.
          const unhandled: never = outcome.reason;
          return unhandled;
        }
      }
    case "refused":
      return refusedNotice(outcome.barIndex, command === "fixBar" ? "fix" : "change");
    default: {
      const unhandled: never = outcome;
      return unhandled;
    }
  }
}

/** The notice after Fix all; null when there was nothing to fix. */
export function fixAllNotice(fixed: number, skipped: number): string | null {
  const it = skipped === 1 ? "it" : "them";
  if (fixed > 0 && skipped > 0) return `Fixed ${count(fixed, "bar")}; ${skipped} skipped — edit ${it} in the source`;
  if (fixed > 0) return `Fixed ${count(fixed, "bar")} — Ctrl+Z to undo`;
  if (skipped > 0) return `Couldn't fix ${count(skipped, "bar")} automatically — edit ${it} in the source`;
  return null;
}

/** The status strip: a sentence, and whether Fix all follows it. */
export interface StripMessage {
  text: string;
  fixAll: boolean;
}

function caretBarSentence({ barIndex, state }: BrokenBar): string {
  const amount = describe(state.amount);
  const n = barIndex + 1;
  if (state.kind === "long") {
    return amount ? `Bar ${n} is ${amount} too long — Shift+B fixes it` : `Bar ${n} is too long — Shift+B fixes it`;
  }
  return amount
    ? `Bar ${n} is short by ${amount} — Shift+B fills it with rests`
    : `Bar ${n} is short — Shift+B fills it with rests`;
}

/** "Bar 5", "Bars 5 and 9", "Bars 1, 2, 3, 4, 5 and 3 more": at most five numbers. */
function barList(barIndexes: number[]): string {
  const numbers = barIndexes.map((i) => String(i + 1));
  if (numbers.length === 1) return `Bar ${numbers[0]}`;
  const shown = numbers.slice(0, 5);
  const tail = numbers.length > 5 ? `${numbers.length - 5} more` : shown.pop()!;
  return `Bars ${shown.join(", ")} and ${tail}`;
}

/**
 * What the strip says, given the caret's bar and the broken bars; null when
 * every bar adds up. In a broken bar it explains that bar and offers Shift+B,
 * adding the others and Fix all when there are others; elsewhere it lists the
 * broken bars and offers Fix all.
 */
export function stripMessage(caretBar: number, broken: BrokenBar[]): StripMessage | null {
  if (broken.length === 0) return null;
  const here = broken.find((b) => b.barIndex === caretBar);
  const others = broken.length - (here ? 1 : 0);
  if (here) {
    const sentence = caretBarSentence(here);
    if (others === 0) return { text: sentence, fixAll: false };
    const more = others === 1 ? "1 more bar doesn't add up" : `${others} more bars don't add up`;
    return { text: `${sentence} · ${more}`, fixAll: true };
  }
  const verb = broken.length === 1 ? "doesn't" : "don't";
  return { text: `${barList(broken.map((b) => b.barIndex))} ${verb} add up`, fixAll: true };
}
