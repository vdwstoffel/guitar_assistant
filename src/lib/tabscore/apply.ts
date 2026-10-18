import { parseTex } from "./parse";
import { clampCaret, countBars, countBeats, type Caret } from "./locate";
import type { Range } from "./selection";

export interface CommandResult {
  text: string;
  caret: Caret;
}

/**
 * What the command intends the document's shape to be afterwards. A parse
 * check alone is not enough: dropping a separator merges two beats into one
 * and still parses cleanly, so commands assert the resulting counts.
 */
export interface StructureExpectation {
  bars?: number;
  beats?: number;
}

export function commitEdit(
  nextText: string,
  caret: Caret,
  expected: StructureExpectation,
): CommandResult | null {
  const result = parseTex(nextText);
  if (!result.ok || !result.scoreNode) return null;

  if (expected.bars !== undefined && countBars(result.scoreNode) !== expected.bars) return null;
  if (expected.beats !== undefined && countBeats(result.scoreNode) !== expected.beats) return null;

  return { text: nextText, caret: clampCaret(result.scoreNode, caret) };
}

/** What a bar fix did, for its notice. */
export interface FixReport {
  barIndex: number;
  removedBeats: number;
  /** Whether the last beat left was shortened, and whether it was a note (or chord) or a rest. */
  shortenedLast: false | "note" | "rest";
  addedRests: number;
}

/**
 * Why a selection or clipboard command declined. Absent on a refusal means
 * what it meant before these commands: a bar the commands cannot read.
 */
export type RefusalReason =
  | "doesNotFit"
  | "crossesBarLine"
  | "needsBarStart"
  | "remainderInexpressible"
  | "notAPassage"
  | "wouldEmptyBar"
  | "wouldRemoveAll"
  | "barsCarrySigns"
  | "severalTracks";

/**
 * How a command that can decline for a reason reports back. The older
 * commands return `CommandResult | null`; these need to say why they did
 * nothing, which barMessages.ts and clipMessages.ts turn into words. A paste
 * or duplicate also says what to select afterwards: the music it wrote.
 */
export type EditOutcome =
  | { kind: "ok"; result: CommandResult; report?: FixReport; selection?: Range }
  | { kind: "noop"; reason: "alreadyRest" | "exact" | "exempt" }
  | { kind: "refused"; barIndex: number; why?: RefusalReason };

export type Refused = Extract<EditOutcome, { kind: "refused" }>;

/**
 * A refusal naming the bar, with the reason when there is one — no `why` key
 * at all when there is none, so it equals feature 2's refusals exactly. The
 * one helper the selection and clipboard commands share.
 */
export const refuse = (barIndex: number, why?: RefusalReason): Refused =>
  why ? { kind: "refused", barIndex, why } : { kind: "refused", barIndex };
