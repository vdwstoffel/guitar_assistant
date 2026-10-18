import { parseTex } from "../parse";
import { sliceCp } from "../offsets";
import { beatSpliceRange, countBars, countBeats, type Caret } from "../locate";
import { commitEdit, type CommandResult } from "../apply";
import { editBeat, parseBeatText } from "./beatText";
import { editKey, spliceBeats, splicesOf, type EditSet } from "./barEdit";
import { restOutBeat, unbindAround } from "./rest";

export function setFret(text: string, caret: Caret, fret: number): CommandResult | null {
  if (!Number.isInteger(fret) || fret < 0 || fret > 24) return null;
  return editBeat(text, caret, (beat, c) => {
    const existing = beat.notes.find((n) => n.string === c.string);
    const notes = beat.notes.filter((n) => n.string !== c.string);
    notes.push({ fret, string: c.string, effects: existing?.effects ?? "" });
    return { ...beat, notes };
  });
}

/**
 * Delete: take the caret's note off its beat. The last note going makes the
 * beat a rest through the same helper as `r`, so a length marker on the note
 * stays. Either way the string falls silent at that beat, so the ties and
 * hammer-ons on it are unbound as they are around a rest (unbindStrings): a
 * later tie would otherwise re-bind to an older note, and a hammer-on reach
 * past the beat. Null when there is no note there, or a beat the editor
 * cannot read stops that unbinding.
 */
export function clearNote(text: string, caret: Caret): CommandResult | null {
  const { scoreNode, ok } = parseTex(text);
  if (!ok || !scoreNode) return null;
  const range = beatSpliceRange(text, scoreNode, caret);
  const beat = range && parseBeatText(sliceCp(text, range.cpStart, range.cpEnd));
  if (!beat || !beat.notes.some((n) => n.string === caret.string)) return null;
  let next: string | null;
  if (beat.notes.length > 1) {
    const notes = beat.notes.filter((n) => n.string !== caret.string);
    const edits: EditSet = new Map([[editKey(caret), { pos: caret, beat: { ...beat, notes } }]]);
    const unbound = unbindAround(text, scoreNode, caret, [caret.string], edits);
    next = unbound ? spliceBeats(text, scoreNode, splicesOf(edits)) : null;
  } else {
    next = restOutBeat(text, scoreNode, caret, beat);
  }
  return next === null ? null : commitEdit(next, caret, { bars: countBars(scoreNode), beats: countBeats(scoreNode) });
}
