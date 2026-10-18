/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import { parseTex } from "../parse";
import { sliceCp } from "../offsets";
import { beatSpliceRange, countBars, countBeats, type BeatPos, type Caret } from "../locate";
import { commitEdit, type EditOutcome } from "../apply";
import { formatEffects, liftLengthMarkers, parseBeatText, tokenHead, tokensOf, TIE, type ParsedBeat } from "./beatText";
import {
  BINDING_REACH_BARS,
  editKey,
  isEditableBar,
  isMarkedTie,
  nextBeatPos,
  prevBeatPos,
  readBar,
  readsBack,
  spliceBeats,
  splicesOf,
  type EditSet,
} from "./barEdit";
import { tieOrigin } from "./tie";

/**
 * Note effects that bind a note to the next note on its string, reaching
 * across any rests in between (probed on alphaTab 1.8.1): hammer-on/pull-off,
 * legato slide, shift slide. Named by their head (tokenHead): `{h()}` and
 * `{ss ()}` bind like `{h}` and `{ss}`.
 */
export const LEGATO: ReadonlySet<string> = new Set(["h", "sl", "ss"]);

/**
 * The one of them that also binds across strings: alphaTab 1.8.1 binds a
 * hammer-on to a left-hand tap on another string (findHammerPullDestination),
 * a slide only to the next note on its own (nextNoteOnSameLine).
 */
export const HAMMER_ON: ReadonlySet<string> = new Set(["h"]);

/** An effect block's tokens without those whose head (tokenHead) is in `heads`. */
const without = (tokens: string[], heads: ReadonlySet<string>): string[] =>
  tokens.filter((token) => !heads.has(tokenHead(token)));

/**
 * An effect block's tokens without its hammer-on, slide and shift slide, in
 * whatever spelling (`h`, `h()`, `ss ()`): what a note keeps once nothing
 * follows it on its string to bind to. The same tokens when it has none.
 * Shared by the walk that unbinds a gap (unbindStrings) and by a clip, whose
 * last note on each string binds to nothing (clip.ts).
 */
export const withoutLegato = (tokens: string[]): string[] => without(tokens, LEGATO);

/** The beat as `edits` has it so far, else as the text has it; null when it cannot be read. */
function beatAt(text: string, scoreNode: any, edits: EditSet, pos: BeatPos): ParsedBeat | null {
  const edited = edits.get(editKey(pos));
  if (edited) return edited.beat;
  const range = beatSpliceRange(text, scoreNode, pos);
  return range && parseBeatText(sliceCp(text, range.cpStart, range.cpEnd));
}

/**
 * Where notes on some strings fall silent: the beats of bar `bar` between
 * `before` (the last beat that still sounds, or null at the start of the
 * score) and `after` (the first beat after them, or null at the end).
 */
export interface Gap {
  bar: number;
  /** A gap across several bars starts in this one (else `bar`): the walk back reaches from here. */
  firstBar?: number;
  /** A gap across several bars ends in this one (else `bar`): the walk on reaches from here. */
  lastBar?: number;
  before: BeatPos | null;
  after: BeatPos | null;
  /**
   * Whether a tie after the gap that alphaTab binds to nothing — it sounds
   * the open string — is written as fret 0. An edit that only silences notes
   * leaves such a tie alone: it binds to nothing still. One that removes bars
   * or writes notes could bring a note within its reach (applyChange).
   */
  pinOrphanTies?: boolean;
}

/**
 * Stop alphaTab re-binding across a gap on `strings`. Walking back from
 * `before`, the nearest note on each string loses its hammer-on or slide,
 * which would otherwise reach across the gap to the next note. Walking on from
 * `after`, the first note on each string, if it is a tie (`-.s`), becomes the
 * fret it sounded, rather than holding an older note across the gap — a tie
 * bound to nothing, the open string, only when `gap.pinOrphanTies` asks. Both
 * walks cross bar lines, but stop BINDING_REACH_BARS bars from the gap — back
 * from its first bar, on from its last: alphaTab binds no further, so a note
 * beyond cannot be bound across the gap, before the edit or after it. Ties
 * resolve against the unedited text — what they sounded before the edit. Adds
 * to `edits`; splices nothing.
 *
 * A walk never gives up quietly. A beat it cannot read might hold the very
 * note it is looking for, so it cannot be stepped over and cannot be taken as
 * the end of the walk: that would leave a tie or a hammer-on re-bound across
 * the gap. Nor can a marked tie (`{t}`, `{-}`) be taken as the note that
 * settles a string: parseBeatText reads its fret as written, where alphaTab
 * sounds its origin's — nor be passed by the walk that finds what a tie
 * sounded (tieOrigin). And a hammer-on is not stripped from an effect block
 * tokensOf cannot read back (`{h PM}`), which rewriting would mangle. Reaching
 * any of these before the string is settled returns false, and `edits` is
 * then half-built — the caller drops it and refuses. True: every string is
 * settled, by finding its note or by reaching the end of the walk.
 *
 * `strip` names what the walk back takes off the note it finds: every legato
 * property (LEGATO) by default; HAMMER_ON alone on a string where only a
 * hammer-on can reach across the gap — to a left-hand tap on another string.
 */
export function unbindStrings(
  text: string,
  scoreNode: any,
  strings: number[],
  gap: Gap,
  edits: EditSet,
  strip: ReadonlySet<string> = LEGATO,
): boolean {
  const back = (gap.firstBar ?? gap.bar) - BINDING_REACH_BARS;
  const on = (gap.lastBar ?? gap.bar) + BINDING_REACH_BARS;
  for (const string of new Set(strings)) {
    for (let pos = gap.before; pos && pos.barIndex >= back; pos = prevBeatPos(scoreNode, pos)) {
      const beat = beatAt(text, scoreNode, edits, pos);
      if (!beat) return false;
      const index = beat.notes.findIndex((note) => note.string === string);
      if (index === -1) continue;
      const { effects } = beat.notes[index];
      if (isMarkedTie(effects)) return false;
      const tokens = tokensOf(effects);
      const kept = without(tokens, strip);
      if (kept.length < tokens.length) {
        if (!readsBack(effects)) return false;
        const notes = beat.notes.map((note, i) => (i === index ? { ...note, effects: formatEffects(kept) } : note));
        edits.set(editKey(pos), { pos, beat: { ...beat, notes } });
      }
      break;
    }
    for (let pos = gap.after; pos && pos.barIndex <= on; pos = nextBeatPos(scoreNode, pos)) {
      const beat = beatAt(text, scoreNode, edits, pos);
      if (!beat) return false;
      const index = beat.notes.findIndex((note) => note.string === string);
      if (index === -1) continue;
      if (isMarkedTie(beat.notes[index].effects)) return false;
      if (beat.notes[index].fret === TIE) {
        const origin = tieOrigin(text, scoreNode, { ...pos, string });
        if (origin.kind === "blocked") return false;
        // A tie with no origin (none) sounded the open string, and after an
        // edit that only silences notes still will.
        const fret = origin.kind === "fret" ? origin.fret : gap.pinOrphanTies ? 0 : null;
        if (fret !== null) {
          const notes = beat.notes.map((note, i) => (i === index ? { ...note, fret } : note));
          edits.set(editKey(pos), { pos, beat: { ...beat, notes } });
        }
      }
      break;
    }
  }
  return true;
}

/** unbindStrings for the notes on `strings` of the one beat at `pos`, which fall silent. */
export function unbindAround(text: string, scoreNode: any, pos: BeatPos, strings: number[], edits: EditSet): boolean {
  const gap: Gap = { bar: pos.barIndex, before: prevBeatPos(scoreNode, pos), after: nextBeatPos(scoreNode, pos) };
  return unbindStrings(text, scoreNode, strings, gap, edits);
}

/**
 * The beat as a rest of the same length: every note removed, its duration
 * suffix and beat markers kept — including a `{d}`, `{dd}`, `{tu n}` or `{gr}`
 * that sat on a duration-less note (liftLengthMarkers).
 */
export const asRest = (beat: ParsedBeat): ParsedBeat => ({ ...liftLengthMarkers(beat), notes: [] });

/**
 * The text with the beat at `pos` silent and the same length (asRest), and
 * the hammer-ons, slides and ties on its strings unbound (unbindStrings).
 * Null when an unreadable beat or a marked tie stops that unbinding, or a
 * splice fails.
 */
export function restOutBeat(text: string, scoreNode: any, pos: BeatPos, beat: ParsedBeat): string | null {
  const edits: EditSet = new Map([[editKey(pos), { pos, beat: asRest(beat) }]]);
  const strings = beat.notes.map((note) => note.string);
  return unbindAround(text, scoreNode, pos, strings, edits) ? spliceBeats(text, scoreNode, splicesOf(edits)) : null;
}

/**
 * `r`: the beat at the caret becomes a rest of the same length. Not a toggle
 * (Ctrl+Z brings the notes back): on a rest it does nothing and says so. The
 * caret does not move. Refused, changing nothing, for a bar the commands would
 * misread, and when an unreadable beat or a marked tie stops the unbinding
 * (restOutBeat).
 */
export function makeRest(text: string, caret: Caret): EditOutcome {
  const refused: EditOutcome = { kind: "refused", barIndex: caret.barIndex };
  const parsed = parseTex(text);
  if (!parsed.ok || !parsed.scoreNode || !isEditableBar(text, parsed, caret.barIndex)) return refused;
  const beat = readBar(text, parsed.scoreNode, caret.barIndex)?.[caret.beatIndex]?.beat;
  if (!beat) return refused;
  if (beat.notes.length === 0) return { kind: "noop", reason: "alreadyRest" };

  const next = restOutBeat(text, parsed.scoreNode, caret, beat);
  const result =
    next === null
      ? null
      : commitEdit(next, caret, { bars: countBars(parsed.scoreNode), beats: countBeats(parsed.scoreNode) });
  return result ? { kind: "ok", result } : refused;
}
