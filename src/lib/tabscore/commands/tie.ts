/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import { parseTex } from "../parse";
import { sliceCp, spliceCp } from "../offsets";
import { beatSpliceRange, countBars, countBeats, type Caret } from "../locate";
import { commitEdit, type CommandResult } from "../apply";
import { parseBeatText, formatBeat, TIE, type ParsedNote } from "./beatText";
import { BINDING_REACH_BARS, isMarkedTie, prevBeatPos } from "./barEdit";

/** What a tie at some beat sounds, as far as the editor can tell. */
export type TieOrigin =
  /** The fret of the note it is tied to, through any chain of ties. */
  | { kind: "fret"; fret: number }
  /** Nothing alphaTab binds it to: it sounds the open string. */
  | { kind: "none" }
  /**
   * The walk met a beat the editor cannot read past: one parseBeatText cannot
   * read (it might hold the string), or a note marked as a tie in its effects
   * (`3.6{t}`), whose written fret is not the one it sounds.
   */
  | { kind: "blocked" };

/**
 * What the tie at `caret` sounds: the nearest earlier note on the same
 * string, walking back beat by beat and bar by bar — as far as alphaTab does,
 * BINDING_REACH_BARS bars; beyond that it binds nothing, and the tie sounds
 * the open string.
 *
 * Ties chain — `3.6 -.6 -.6` is one note held for three beats — so a `-`
 * found on the way back is not the answer: walk on to the fret it refers to,
 * which alphaTab looks for within reach of that tie's own bar.
 */
export function tieOrigin(text: string, scoreNode: any, caret: Caret): TieOrigin {
  let reach = caret.barIndex - BINDING_REACH_BARS;
  for (let pos = prevBeatPos(scoreNode, caret); pos && pos.barIndex >= reach; pos = prevBeatPos(scoreNode, pos)) {
    const range = beatSpliceRange(text, scoreNode, pos);
    const beat = range && parseBeatText(sliceCp(text, range.cpStart, range.cpEnd));
    if (!beat) return { kind: "blocked" };
    const note = beat.notes.find((n) => n.string === caret.string);
    if (!note) continue;
    if (isMarkedTie(note.effects)) return { kind: "blocked" };
    if (note.fret !== TIE) return { kind: "fret", fret: note.fret };
    reach = pos.barIndex - BINDING_REACH_BARS;
  }
  return { kind: "none" };
}

/**
 * Why toggleTie returned null at `caret` — ask only after a null: "refused"
 * when the caret's note is a tie whose fret the walk back cannot name
 * (tieOrigin is blocked by a beat the editor cannot read), so untying it would
 * mean guessing; otherwise "nothingToTie", as before.
 */
export function tieRefusal(text: string, caret: Caret): "refused" | "nothingToTie" {
  const { scoreNode, ok } = parseTex(text);
  const range = ok && scoreNode ? beatSpliceRange(text, scoreNode, caret) : null;
  const beat = range && parseBeatText(sliceCp(text, range.cpStart, range.cpEnd));
  const isTie = beat?.notes.some((n) => n.string === caret.string && n.fret === TIE) ?? false;
  return isTie && tieOrigin(text, scoreNode, caret).kind === "blocked" ? "refused" : "nothingToTie";
}

/**
 * Tie the note at the caret to the previous one on its string, or untie it.
 *
 * Untying restores the fret the tie was SOUNDING rather than leaving a hole:
 * the tie becomes the same note picked again. That is deliberately not an
 * exact inverse — tying a 5 that follows a 3 and untying it gives a 3, since
 * the 5 is gone from the text the moment the tie is written and a pure text
 * command has nowhere to remember it. Ctrl+Z is the exact inverse. A string
 * whose earlier notes are themselves ties resolves through the whole chain.
 *
 * Returns null — leaving the document untouched — when the caret's string has
 * nothing within alphaTab's reach (tieOrigin) to tie to. Writing the tie
 * anyway would parse, but alphaTab renders it as an open string, which is
 * silently wrong rather than visibly refused. A walk blocked by a beat the
 * editor cannot read does not stop a new tie — alphaTab binds it to whatever
 * that beat holds — but it does stop an untie, which would have to name the
 * fret.
 */
export function toggleTie(text: string, caret: Caret): CommandResult | null {
  const { scoreNode, ok } = parseTex(text);
  if (!ok || !scoreNode) return null;

  const range = beatSpliceRange(text, scoreNode, caret);
  if (!range) return null;

  const beat = parseBeatText(sliceCp(text, range.cpStart, range.cpEnd));
  if (!beat) return null;

  const index = beat.notes.findIndex((n) => n.string === caret.string);
  const existing = index === -1 ? null : beat.notes[index];
  const origin = tieOrigin(text, scoreNode, caret);

  let notes: ParsedNote[];
  if (existing?.fret === TIE) {
    // Untie. With no resolvable origin the note has no fret to go back to, so
    // it comes out rather than becoming an arbitrary one; with a beat in the
    // way that the editor cannot read, the fret is unknown, so nothing changes.
    if (origin.kind === "blocked") return null;
    notes =
      origin.kind === "none"
        ? beat.notes.filter((_, i) => i !== index)
        : beat.notes.map((n, i) => (i === index ? { ...n, fret: origin.fret } : n));
  } else {
    if (origin.kind === "none") return null;
    const note: ParsedNote = {
      fret: TIE,
      string: caret.string,
      effects: existing?.effects ?? "",
    };
    notes =
      index === -1
        ? [...beat.notes, note]
        : beat.notes.map((n, i) => (i === index ? note : n));
  }

  const nextText = spliceCp(text, range.cpStart, range.cpEnd, formatBeat({ ...beat, notes }));
  return commitEdit(nextText, caret, {
    bars: countBars(scoreNode),
    beats: countBeats(scoreNode),
  });
}
