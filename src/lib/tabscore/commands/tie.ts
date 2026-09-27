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

/**
 * The fret the tie at `caret` would sound: the nearest earlier note on the
 * same string, walking backwards beat by beat and bar by bar.
 *
 * Ties chain — `3.6 -.6 -.6` is one note held for three beats — so a `-`
 * found on the way back is not the answer; keep walking to the fret it
 * ultimately refers to. Returns null when nothing earlier plays that string,
 * which is the case `toggleTie` refuses: alphaTex accepts such a tie and
 * silently renders it as an open string rather than reporting an error.
 */
function tiedFret(text: string, scoreNode: any, caret: Caret): number | null {
  const bars: any[] = scoreNode?.bars ?? [];
  let barIndex = caret.barIndex;
  let beatIndex = caret.beatIndex - 1;

  while (barIndex >= 0) {
    if (beatIndex < 0) {
      barIndex--;
      if (barIndex < 0) break;
      beatIndex = (bars[barIndex]?.beats?.length ?? 0) - 1;
      continue;
    }

    const range = beatSpliceRange(text, scoreNode, { ...caret, barIndex, beatIndex });
    const beat = range && parseBeatText(sliceCp(text, range.cpStart, range.cpEnd));
    const note = beat?.notes.find((n) => n.string === caret.string);
    if (note && note.fret !== TIE) return note.fret;
    beatIndex--;
  }
  return null;
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
 * nothing earlier to tie to. Writing the tie anyway would parse, but alphaTab
 * renders it as an open string, which is silently wrong rather than visibly
 * refused.
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
  const previous = tiedFret(text, scoreNode, caret);

  let notes: ParsedNote[];
  if (existing?.fret === TIE) {
    // Untie. With no resolvable origin the note has no fret to go back to, so
    // it comes out rather than becoming an arbitrary one.
    notes =
      previous === null
        ? beat.notes.filter((_, i) => i !== index)
        : beat.notes.map((n, i) => (i === index ? { ...n, fret: previous } : n));
  } else {
    if (previous === null) return null;
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
