import { editBeat, tokensOf, formatEffects } from "./beatText";
import { type Caret } from "../locate";
import { type CommandResult } from "../apply";

export type Technique =
  | "hammer" | "slide" | "palmMute" | "vibrato" | "dead"
  | "ghost" | "tap" | "harmonic" | "letRing"
  | "bendFull" | "bendHalf" | "bendRelease" | "preBend";

/**
 * The AlphaTex effect token each technique writes inside a note's braces.
 * Verified against the real alphaTab 1.8.1 importer's note-property table
 * (`AlphaTex1LanguageDefinitions.noteProperties` / `applyNoteProperty`) —
 * see task-9-report.md for the per-token evidence.
 */
const TOKEN: Record<Technique, string> = {
  hammer: "h",
  slide: "sl",
  palmMute: "pm",
  vibrato: "v",
  dead: "x",
  ghost: "g",
  // NOT "tt": "tt" is a valid alphaTex token, but only as a BEAT property
  // (`beat.tap`, the bass slap/pop/tap family alongside `s`/`p`) — it is
  // absent from the NOTE property table, so the importer would silently
  // re-target it onto the whole beat instead of this note. "lht" is the
  // genuine per-note property (`note.isLeftHandTapped`) for a two-hand tap.
  tap: "lht",
  harmonic: "nh",
  letRing: "lr",
  // Verified against alphaTab 1.8.1: these produce bendType 2, 2, 4 and 6
  // (Bend, Bend, BendRelease, Prebend) respectively.
  bendFull: "b (0 4)",
  bendHalf: "b (0 2)",
  bendRelease: "b (0 4 0)",
  preBend: "b (4 4)",
};

export const TECHNIQUE_KEYS: Record<string, Technique> = {
  h: "hammer",
  s: "slide",
  p: "palmMute",
  v: "vibrato",
  x: "dead",
  g: "ghost",
  t: "tap",
  n: "harmonic",
  l: "letRing",
  b: "bendFull",
};

export function toggleTechnique(
  text: string,
  caret: Caret,
  technique: Technique,
): CommandResult | null {
  const token = TOKEN[technique];
  const head = token.split(" ")[0];

  return editBeat(text, caret, (beat, c) => {
    const i = beat.notes.findIndex((n) => n.string === c.string);
    if (i === -1) return null;

    const note = beat.notes[i];
    const tokens = tokensOf(note.effects);
    const existing = tokens.findIndex((t) => t.split(/[\s(]/)[0] === head);

    // Same head, different token (e.g. swapping bendFull for bendHalf):
    // REPLACE in place. Same head, identical token: a true toggle-off, so
    // REMOVE. Only a genuinely absent head gets appended.
    const next = existing === -1
      ? [...tokens, token]
      : tokens[existing] === token
        ? tokens.filter((_, j) => j !== existing)
        : tokens.map((t, j) => (j === existing ? token : t));

    const notes = [...beat.notes];
    notes[i] = { ...note, effects: formatEffects(next) };
    return { ...beat, notes };
  });
}
