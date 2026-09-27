import { editBeat } from "./beatText";
import { type Caret } from "../locate";
import { type CommandResult } from "../apply";

export function setFret(text: string, caret: Caret, fret: number): CommandResult | null {
  if (!Number.isInteger(fret) || fret < 0 || fret > 24) return null;
  return editBeat(text, caret, (beat, c) => {
    const existing = beat.notes.find((n) => n.string === c.string);
    const notes = beat.notes.filter((n) => n.string !== c.string);
    notes.push({ fret, string: c.string, effects: existing?.effects ?? "" });
    return { ...beat, notes };
  });
}

export function clearNote(text: string, caret: Caret): CommandResult | null {
  return editBeat(text, caret, (beat, c) => {
    if (!beat.notes.some((n) => n.string === c.string)) return null;
    return { ...beat, notes: beat.notes.filter((n) => n.string !== c.string) };
  });
}
