/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab's model types are only reachable through namespaces that cannot be
 * imported as types across the bundle boundary. These `any`s are the interop
 * boundary with that untyped surface, not unexamined typing.
 */
import { parseTex } from "../parse";
import { countBars, countBeats, type Caret } from "../locate";
import { commitEdit, type CommandResult, type EditOutcome, type FixReport } from "../apply";
import { barState, beatLength, brokenBars } from "../barFill";
import { cmp, sub, ZERO } from "../fraction";
import {
  fill, largestPlainAtMost, lengthOf, sameValue, valueOf, valueOfBeat, type NoteValue,
} from "../durationValues";
import { durationAt, repinAt } from "../repin";
import { formatBeat, formatEffects, liftLengthMarkers, splitLengthMarkers, tokensOf, type ParsedBeat } from "./beatText";
import {
  editKey, formatRests, isEditableBar, nextBeatPos, readBar, spliceBeats, splicesOf, type BeatSplice, type EditSet,
} from "./barEdit";
import { unbindStrings } from "./rest";

/** A refusal always names the bar the fix was asked for, even when the cause lies in the next bar. */
type Fix =
  | { kind: "fixed"; text: string; report: FixReport }
  | { kind: "noop"; reason: "exact" | "exempt" }
  | { kind: "refused"; barIndex: number };

/** The value every beat of the bar shares (graces aside), or null. */
function uniformValue(model: any[]): NoteValue | null {
  const values = model.filter((beat) => !(beat.graceType > 0)).map(valueOfBeat);
  return values.length > 0 && values.every((v) => sameValue(v, values[0])) ? values[0] : null;
}

/** The value of the tuplet the bar ends in, which padding completes first; null when it ends in a plain beat. */
function openTuplet(model: any[]): NoteValue | null {
  const last = [...model].reverse().find((beat) => !(beat.graceType > 0));
  return last && last.tupletNumerator > 0 ? { duration: last.duration, dots: 0, tuplet: last.tupletNumerator } : null;
}

/** The beat written with `value`: an explicit duration, and dot and tuplet markers rewritten to match. */
function withValue(beat: ParsedBeat, value: NoteValue): ParsedBeat {
  const lifted = liftLengthMarkers(beat);
  const kept = splitLengthMarkers(tokensOf(lifted.effects));
  const markers = kept.markers.filter((marker) => marker.startsWith("gr"));
  if (value.dots === 1) markers.push("d");
  if (value.dots === 2) markers.push("dd");
  if (value.tuplet !== null) markers.push(`tu ${value.tuplet}`);
  return { ...lifted, durationSuffix: `.${value.duration}`, effects: formatEffects([...kept.others, ...markers]) };
}

/**
 * Make one bar add up, or say why not. Short: rests after the last beat
 * (fill: the bar's own value if every beat shares one, else plain values from
 * the beat unit, completing an unfinished tuplet first), and the hammer-ons,
 * slides and ties of the last beat's notes that would reach across them are
 * unbound. Long: whole beats come off the end while each fits in the excess,
 * then the last one left is shortened — its notes take the exact value if
 * there is one, else the longest plain value that fits, and the rest of its
 * length becomes rests; the hammer-ons, slides and ties that pointed across
 * the cut are unbound.
 * Either way the beat after the bar keeps its duration (re-pinning). Refused,
 * changing nothing, when the commands would misread the bar (isEditableBar),
 * when no rests can make up the length, when an unreadable beat or a marked
 * tie stops the unbinding (unbindStrings), or when the beat after the bar
 * cannot be re-pinned; the refusal names this bar, whatever the cause.
 */
function fixBarText(text: string, barIndex: number): Fix {
  const refused: Fix = { kind: "refused", barIndex };
  const parsed = parseTex(text);
  const { scoreNode, score } = parsed;
  if (!parsed.ok || !scoreNode || !score || barIndex < 0 || barIndex >= countBars(scoreNode)) return refused;
  const state = barState(score, barIndex);
  if (state.kind === "exact" || state.kind === "exempt") return { kind: "noop", reason: state.kind };
  if (!isEditableBar(text, parsed, barIndex)) return refused;

  const beats = readBar(text, scoreNode, barIndex)!;
  const model: any[] = score.tracks[0].staves[0].bars[barIndex].voices[0].beats;
  const unit: number = score.masterBars[barIndex].timeSignatureDenominator;
  const last = beats.length - 1;
  const after = nextBeatPos(scoreNode, { barIndex, beatIndex: last });
  const edits: EditSet = new Map();
  let splice: BeatSplice;
  let report: FixReport;

  if (state.kind === "short") {
    const values = fill(state.amount, { unit, uniform: uniformValue(model), tuplet: openTuplet(model) });
    if (!values) return refused;
    // The rests go between the last beat and the next bar: its notes' ties and
    // legato would bind straight across them, so they are unbound as a cut's are.
    const lastPos = { barIndex, beatIndex: last };
    const strings = beats[last].beat!.notes.map((note) => note.string);
    if (!unbindStrings(text, scoreNode, strings, { bar: barIndex, before: lastPos, after }, edits)) return refused;
    const lastBeat = edits.get(editKey(lastPos))?.beat;
    edits.delete(editKey(lastPos));
    const rests = formatRests(values, durationAt(scoreNode, lastPos));
    splice = { barIndex, first: last, last, beats: [lastBeat ? formatBeat(lastBeat) : beats[last].source, ...rests] };
    report = { barIndex, removedBeats: 0, shortenedLast: false, addedRests: values.length };
  } else {
    const lengths = model.map(beatLength);
    let excess = state.amount;
    let keep = last;
    while (keep > 0 && cmp(excess, ZERO) > 0 && cmp(lengths[keep], excess) <= 0) {
      excess = sub(excess, lengths[keep]);
      keep--;
    }
    const removedStrings = beats.slice(keep + 1).flatMap((b) => b.beat!.notes.map((note) => note.string));
    const keptPos = { barIndex, beatIndex: keep };
    if (cmp(excess, ZERO) === 0) {
      if (!unbindStrings(text, scoreNode, removedStrings, { bar: barIndex, before: keptPos, after }, edits)) return refused;
      splice = { barIndex, first: keep + 1, last, beats: [] };
      report = { barIndex, removedBeats: last - keep, shortenedLast: false, addedRests: 0 };
    } else {
      const target = sub(lengths[keep], excess);
      const value = valueOf(target, valueOfBeat(model[keep]).tuplet) ?? largestPlainAtMost(target);
      // No rests for what the shortened beat leaves over (a cut inside a triplet, say): nothing can be written.
      const leftover = value && fill(sub(target, lengthOf(value)), { unit });
      if (!value || !leftover) return refused;
      const shortened = beats[keep].beat!;
      edits.set(editKey(keptPos), { pos: keptPos, beat: withValue(shortened, value) });
      // With rests after it now, the shortened beat's own notes are cut off too.
      const strings = leftover.length > 0 ? [...removedStrings, ...shortened.notes.map((n) => n.string)] : removedStrings;
      if (!unbindStrings(text, scoreNode, strings, { bar: barIndex, before: keptPos, after }, edits)) return refused;
      const keptBeat = edits.get(editKey(keptPos))!.beat;
      edits.delete(editKey(keptPos));
      splice = { barIndex, first: keep, last, beats: [formatBeat(keptBeat), ...formatRests(leftover, value.duration)] };
      report = {
        barIndex,
        removedBeats: last - keep,
        shortenedLast: shortened.notes.length === 0 ? "rest" : "note",
        addedRests: leftover.length,
      };
    }
  }

  let next = spliceBeats(text, scoreNode, [splice, ...splicesOf(edits)]);
  if (next !== null && after) next = repinAt(next, after, durationAt(scoreNode, after));
  if (next === null) return refused;
  // A guard that no current input reaches: the values and rests above always add up to what the
  // bar is missing or over by, and a cut that no value can express is already refused above, where
  // no rests make up its remainder. It stays so that a change to the values or the fill can never
  // report a bar as fixed that does not add up.
  const check = parseTex(next);
  if (!check.ok || barState(check.score, barIndex).kind !== "exact") return refused;
  return { kind: "fixed", text: next, report };
}

/**
 * Shift+B: make the bar at the caret add up. The caret stays in its bar on
 * its string, clamped to the bar's last beat when beats were removed. One
 * commit, one undo step.
 */
export function fixBar(text: string, caret: Caret): EditOutcome {
  const fix = fixBarText(text, caret.barIndex);
  if (fix.kind === "noop") return { kind: "noop", reason: fix.reason };
  if (fix.kind === "refused") return { kind: "refused", barIndex: fix.barIndex };
  const { scoreNode } = parseTex(text);
  const { removedBeats, addedRests } = fix.report;
  const result = commitEdit(fix.text, caret, {
    bars: countBars(scoreNode),
    beats: countBeats(scoreNode) - removedBeats + addedRests,
  });
  return result ? { kind: "ok", result, report: fix.report } : { kind: "refused", barIndex: caret.barIndex };
}

/**
 * Fix all: every bar that does not add up, front to back, re-reading the
 * text after each fix, as one commit (one undo step). Bars that would be
 * refused are skipped and counted. The bar count never changes; the caret
 * stays where it was, clamped like Shift+B.
 */
export function fixAllBars(text: string, caret: Caret): { result: CommandResult | null; fixed: number; skipped: number } {
  const parsed = parseTex(text);
  if (!parsed.ok || !parsed.scoreNode) return { result: null, fixed: 0, skipped: 0 };
  let current = text;
  let fixed = 0;
  let skipped = 0;
  for (const { barIndex } of brokenBars(parsed.score)) {
    const fix = fixBarText(current, barIndex);
    if (fix.kind === "fixed") {
      current = fix.text;
      fixed++;
    } else if (fix.kind === "refused") {
      skipped++;
    }
  }
  const result = fixed > 0 ? commitEdit(current, caret, { bars: countBars(parsed.scoreNode) }) : null;
  return { result, fixed: result ? fixed : 0, skipped };
}
