/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its model types only through namespaces that cannot be
 * imported as types across the bundle boundary. These `any`s are the interop
 * boundary with that untyped surface, not unexamined typing.
 */
import { parseTex, type ParseResult } from "../parse";
import { countBars, countBeats, type Caret } from "../locate";
import { commitEdit, type CommandResult } from "../apply";
import { barCapacity, beatLength } from "../barFill";
import { add, cmp, fromDuration, sub, ZERO, type Fraction } from "../fraction";
import { DURATIONS, fill } from "../durationValues";
import { durationAt, repinAt } from "../repin";
import { formatBeat, formatEffects, liftLengthMarkers, tokensOf, type ParsedBeat } from "./beatText";
import { formatRests, isEditableBar, nextBeatPos, readBar, spliceBeats } from "./barEdit";

/** Where absorbing stopped: the last beat it used up, and any rests a split left. */
interface Absorbed {
  last: number;
  rests: string[];
}

/**
 * The second half of lengthening. While the bar is over-full, the rests after
 * the edited beat give way: one that fits in what is left of the excess is
 * deleted; the first that does not is replaced by rests for the rest of its
 * length, and that is the end. A note — a held, tied one too — and the bar
 * line stop it; whatever is left over stays, and the bar shows as long. So
 * does a rest no rests can split exactly (a quarter triplet less an 8th):
 * absorbing stops at it rather than skip on to a later one (plan Ruling 16).
 * `lengths` are the bar's beat lengths as the edit leaves them; `inForce` is
 * the edited beat's written duration, which a split's first rest follows.
 */
function absorb(model: any[], lengths: Fraction[], edited: number, capacity: Fraction, unit: number, inForce: number): Absorbed {
  let excess = sub(lengths.reduce(add, ZERO), capacity);
  let last = edited;
  for (let j = edited + 1; j < model.length && cmp(excess, ZERO) > 0 && model[j].isRest; j++) {
    if (cmp(lengths[j], excess) <= 0) {
      excess = sub(excess, lengths[j]);
      last = j;
      continue;
    }
    const values = fill(sub(lengths[j], excess), { unit });
    if (values) return { last: j, rests: formatRests(values, inForce) };
    // No rests add up to what would be left of this one, so it stays whole.
    // Absorbing stops here rather than skip on to a later rest: the note grew
    // into this rest's time, not that one's. The bar is left long, flagged.
    break;
  }
  return { last, rests: [] };
}

/**
 * Write the edited beat, absorb rests if it grew, then re-pin: the beats
 * after the edited span keep the durations they had, and the sticky run
 * (`edited`+1 … `stickyEnd`, which takes the new value) keeps it past a
 * split. `newLengths` are the bar's beat lengths with the edit applied.
 */
function rewrite(
  text: string,
  parsed: ParseResult,
  caret: Caret,
  edited: ParsedBeat,
  newLengths: Fraction[],
  grew: boolean,
  inForce: number,
  stickyEnd: number,
): CommandResult | null {
  const { scoreNode, score } = parsed;
  const barIndex = caret.barIndex;
  const model: any[] = score.tracks[0].staves[0].bars[barIndex].voices[0].beats;
  const masterBar = score.masterBars[barIndex];
  const absorbed =
    grew && !masterBar.isAnacrusis
      ? absorb(model, newLengths, caret.beatIndex, barCapacity(score, barIndex)!, masterBar.timeSignatureDenominator, inForce)
      : { last: caret.beatIndex, rests: [] };

  let next = spliceBeats(text, scoreNode, [
    { barIndex, first: caret.beatIndex, last: absorbed.last, beats: [formatBeat(edited), ...absorbed.rests] },
  ]);
  if (next === null) return null;
  // Beats after the splice moved by this much within the bar.
  const shift = absorbed.rests.length - (absorbed.last - caret.beatIndex);
  const moved = (pos: { barIndex: number; beatIndex: number }) =>
    pos.barIndex === barIndex ? { barIndex, beatIndex: pos.beatIndex + shift } : pos;

  // A split rest inside the sticky run leaves the run's remaining rests
  // inheriting the split's value: they keep the new one.
  if (absorbed.rests.length > 0 && absorbed.last < stickyEnd) {
    next = repinAt(next, moved({ barIndex, beatIndex: absorbed.last + 1 }), inForce);
    if (next === null) return null;
  }
  // Everything after the edited span keeps the duration it had.
  const after = nextBeatPos(scoreNode, { barIndex, beatIndex: Math.max(stickyEnd, absorbed.last) });
  if (after) {
    next = repinAt(next, moved(after), durationAt(scoreNode, after));
    if (next === null) return null;
  }
  return commitEdit(next, caret, {
    bars: countBars(scoreNode),
    beats: countBeats(scoreNode) + shift,
  });
}

/** Length of a model beat if it were written with `duration` (graces stay zero). */
const lengthWith = (beat: any, duration: number, dots = beat.dots): Fraction =>
  beat.graceType > 0 ? ZERO : fromDuration(duration, dots, beat.tupletNumerator, beat.tupletDenominator);

/**
 * `+`/`-`: double or halve the beat at the caret, and only that beat. The
 * bare rests straight after it in the same bar go with it — so "type, →,
 * type" keeps building 16ths after the first is halved (sticky entry) — and
 * the first beat after them keeps the duration it had (re-pinning), so no
 * later note or bar is re-timed. Lengthening then absorbs rests (`absorb`).
 * Shortening never pads: the bar is left short, and shows as short.
 */
export function scaleDuration(
  text: string,
  caret: Caret,
  direction: "halve" | "double",
): CommandResult | null {
  const parsed = parseTex(text);
  if (!parsed.ok || !parsed.scoreNode || !isEditableBar(text, parsed, caret.barIndex)) return null;
  const bar = readBar(text, parsed.scoreNode, caret.barIndex)!;
  const beat = bar[caret.beatIndex]?.beat;
  if (!beat) return null;

  const current = durationAt(parsed.scoreNode, caret);
  const i = DURATIONS.indexOf(current);
  const next = i === -1 ? undefined : DURATIONS[direction === "halve" ? i + 1 : i - 1];
  if (next === undefined) return null;

  let stickyEnd = caret.beatIndex;
  while (stickyEnd + 1 < bar.length && isBareRest(bar[stickyEnd + 1].beat!)) stickyEnd++;

  const model: any[] = parsed.score.tracks[0].staves[0].bars[caret.barIndex].voices[0].beats;
  const lengths = model.map((m, j) =>
    j >= caret.beatIndex && j <= stickyEnd ? lengthWith(m, next) : beatLength(m),
  );
  const edited = { ...liftLengthMarkers(beat), durationSuffix: `.${next}` };
  return rewrite(text, parsed, caret, edited, lengths, direction === "double", next, stickyEnd);
}

const isBareRest = (beat: ParsedBeat) => beat.notes.length === 0 && beat.durationSuffix === "";

/**
 * `.`: toggle the dot on the beat at the caret. A dot is not inherited, so
 * nothing else changes length — except that adding one absorbs rests like
 * lengthening does, and the beat after a split rest is re-pinned.
 */
export function toggleDotted(text: string, caret: Caret): CommandResult | null {
  const parsed = parseTex(text);
  if (!parsed.ok || !parsed.scoreNode || !isEditableBar(text, parsed, caret.barIndex)) return null;
  const beat = readBar(text, parsed.scoreNode, caret.barIndex)![caret.beatIndex]?.beat;
  if (!beat) return null;
  const current = durationAt(parsed.scoreNode, caret);

  // "d" (dotted) is a beat-only alphaTex keyword, but a duration-less
  // single note's own trailing brace is syntactically ambiguous between
  // "this note's effects" and "this beat's effects" (see parseBeatText's
  // doc comment in beatText.ts) — so an already-dotted duration-less beat
  // can have "d" sitting on its note instead of the beat. Check both
  // locations, and always re-emit the canonical form afterward: "d" lives
  // only in beat.effects, never on a note.
  const beatHasDot = tokensOf(beat.effects).includes("d");
  const dottedNoteIndex = beat.notes.findIndex((n) => tokensOf(n.effects).includes("d"));
  const isDotted = beatHasDot || dottedNoteIndex !== -1;
  const notes =
    dottedNoteIndex === -1
      ? beat.notes
      : beat.notes.map((n, i) =>
          i === dottedNoteIndex ? { ...n, effects: formatEffects(tokensOf(n.effects).filter((t) => t !== "d")) } : n,
        );
  // Edit the beat's own token list rather than replacing the whole block:
  // a wholesale "{d}" / "" would silently destroy any sibling beat-level
  // token this beat also carries (e.g. "{tu 3}", a triplet marker) — see
  // invariants.test.ts's "preserves a beat-level effect it does not own".
  const rest = tokensOf(beat.effects).filter((t) => t !== "d");
  const edited: ParsedBeat = {
    ...beat,
    notes,
    durationSuffix: beat.durationSuffix || `.${current}`,
    effects: formatEffects(isDotted ? rest : [...rest, "d"]),
  };

  const model: any[] = parsed.score.tracks[0].staves[0].bars[caret.barIndex].voices[0].beats;
  const lengths = model.map((m, j) => (j === caret.beatIndex ? lengthWith(m, current, isDotted ? 0 : 1) : beatLength(m)));
  return rewrite(text, parsed, caret, edited, lengths, !isDotted, current, caret.beatIndex);
}
