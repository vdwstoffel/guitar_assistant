import type { EditOutcome } from "./apply";
import type { RangeSize } from "./selection";

/**
 * Every sentence the editor says about selecting, copying, pasting and
 * duplicating, in one place so each wording is tested once. Bars are numbered
 * from 1, as the score prints them. Shown for runCommand.ts's BAR_NOTICE_MS.
 */

/**
 * The commands of this feature, by what their refusals say they could not do.
 * `remove` is Shift+Delete over beats, `removeBars` over whole bars.
 */
export type ClipCommand = "copy" | "cut" | "paste" | "duplicate" | "remove" | "removeBars" | "clear";

export const NOT_A_PASSAGE_NOTICE = "That isn't a passage of tab — copy beats from the editor or the Source pane";

const bar = (barIndex: number) => `bar ${barIndex + 1}`;
const count = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
/** "3 beats", "2 bars", "1 beat". */
const amount = (size: RangeSize) => (size.wholeBars ? count(size.bars, "bar") : count(size.beats, "beat"));

/**
 * What a screen reader hears once the selection stops changing: "3 beats
 * selected", "Bar 2 selected", "Bars 2–4 selected". `firstBar` is the
 * selection's first bar, from 0.
 */
export const selectionAnnouncement = (size: RangeSize, firstBar: number): string =>
  !size.wholeBars
    ? `${count(size.beats, "beat")} selected`
    : size.bars === 1
      ? `Bar ${firstBar + 1} selected`
      : `Bars ${firstBar + 1}–${firstBar + size.bars} selected`;

/** …and once there is none, after there was one. */
export const SELECTION_CLEARED = "Selection cleared";

export const copiedNotice = (size: RangeSize) => `Copied ${amount(size)}`;
export const cutNotice = (size: RangeSize) => `Cut ${amount(size)}`;
export const pastedNotice = (size: RangeSize) => `Pasted ${amount(size)}`;

/** "Duplicated bar 5" for one whole bar (`barIndex` is the original's), else "Duplicated 2 bars" / "3 beats". */
export const duplicatedNotice = (size: RangeSize, barIndex: number) =>
  size.wholeBars && size.bars === 1 ? `Duplicated ${bar(barIndex)}` : `Duplicated ${amount(size)}`;

/** A bar the commands cannot read, said with the command's own verb. */
const UNREADABLE: Record<ClipCommand, (barIndex: number) => string> = {
  copy: (i) => `Can't copy ${bar(i)} automatically — copy it from the source`,
  cut: (i) => `Can't cut ${bar(i)} automatically — edit it in the source`,
  paste: (i) => `Can't paste into ${bar(i)} automatically — edit it in the source`,
  duplicate: (i) => `Can't duplicate ${bar(i)} automatically — edit it in the source`,
  remove: (i) => `Can't remove beats from ${bar(i)} automatically — edit it in the source`,
  removeBars: (i) => `Can't remove ${bar(i)} automatically — edit it in the source`,
  clear: (i) => `Can't clear ${bar(i)} automatically — edit it in the source`,
};

/**
 * Bars that cannot go in, or out, of a tab of more than one track, staff or
 * voice: the others would be put out of step. Shift+Delete over whole bars and
 * a paste or duplicate of bars refuse so; the other commands refuse such a tab
 * bar by bar, as a bar they cannot read, and their sentences here are only for
 * completeness.
 */
const SEVERAL_TRACKS: Record<ClipCommand, string> = {
  copy: "Can't copy bars from a tab with more than one track, staff or voice — copy them from the source",
  cut: "Can't cut bars from a tab with more than one track, staff or voice — edit it in the source",
  paste: "Can't paste bars into a tab with more than one track, staff or voice — edit it in the source",
  duplicate: "Can't duplicate bars in a tab with more than one track, staff or voice — edit it in the source",
  remove: "Can't remove bars from a tab with more than one track, staff or voice — edit it in the source",
  removeBars: "Can't remove bars from a tab with more than one track, staff or voice — edit it in the source",
  clear: "Can't clear bars in a tab with more than one track, staff or voice — edit it in the source",
};

/** Why a command of this feature did nothing; null when it acted or has nothing to say. */
export function clipOutcomeNotice(command: ClipCommand, outcome: EditOutcome): string | null {
  if (outcome.kind !== "refused") return null;
  const n = outcome.barIndex;
  switch (outcome.why) {
    case undefined:
      return UNREADABLE[command](n);
    case "doesNotFit":
      return `That doesn't fit in the rest of ${bar(n)} — Ctrl+Shift+V inserts it instead`;
    case "crossesBarLine":
      return command === "duplicate"
        ? "Select whole bars, or beats inside one bar, to duplicate"
        : "These beats cross a bar line — put the caret on a bar's first beat and press Ctrl+Shift+V";
    case "needsBarStart":
      return "Put the caret on a bar's first beat to paste bars";
    case "remainderInexpressible":
      return `Can't split the beat at ${bar(n)} — paste at another beat`;
    // No command returns this reason today: TabEditor says NOT_A_PASSAGE_NOTICE
    // itself when readClip finds no passage on the clipboard, before any command
    // runs. It is here so a command that ever does refuse so says the same.
    case "notAPassage":
      return NOT_A_PASSAGE_NOTICE;
    case "wouldEmptyBar":
      return `Can't remove every beat of ${bar(n)} — select whole bars`;
    case "wouldRemoveAll":
      return "A tab needs at least one bar";
    case "barsCarrySigns":
      return `Bar ${n + 1} carries a sign (repeat, tempo, time signature or section) — remove it in the Source pane first`;
    case "severalTracks":
      return SEVERAL_TRACKS[command];
    default: {
      const unhandled: never = outcome.why;
      return unhandled;
    }
  }
}
