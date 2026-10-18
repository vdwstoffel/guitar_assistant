/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import { editBeat, parseBeatText, tokenHead, tokensOf, formatEffects } from "./beatText";
import { sliceCp } from "../offsets";
import { beatSpliceRange, type Caret } from "../locate";
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

/**
 * Every technique, in the order the toolbar and the note menu list them. It
 * repeats the keys of `TOKEN` on purpose: this is where that order is fixed,
 * so reordering or regrouping `TOKEN` cannot reshuffle the toolbar. Typed
 * `Record<Technique, true>` so that, like `TOKEN`, it fails to compile when a
 * technique is added without a place here; `TECHNIQUES` reads its keys, which
 * keep the order written.
 */
const ORDER: Record<Technique, true> = {
  hammer: true,
  slide: true,
  palmMute: true,
  vibrato: true,
  dead: true,
  ghost: true,
  tap: true,
  harmonic: true,
  letRing: true,
  bendFull: true,
  bendHalf: true,
  bendRelease: true,
  preBend: true,
};

export const TECHNIQUES = Object.keys(ORDER) as Technique[];

/** What the toolbar and the note menu call each technique. */
export const TECHNIQUE_LABEL: Record<Technique, string> = {
  hammer: "Hammer-on / Pull-off",
  slide: "Slide",
  palmMute: "Palm mute",
  vibrato: "Vibrato",
  dead: "Dead note",
  ghost: "Ghost note",
  tap: "Tap",
  harmonic: "Harmonic",
  letRing: "Let ring",
  bendFull: "Bend",
  bendHalf: "Bend (half)",
  bendRelease: "Bend & release",
  preBend: "Pre-bend",
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
  const head = tokenHead(token);

  return editBeat(text, caret, (beat, c) => {
    const i = beat.notes.findIndex((n) => n.string === c.string);
    if (i === -1) return null;

    const note = beat.notes[i];
    const tokens = tokensOf(note.effects);
    const existing = tokens.findIndex((t) => tokenHead(t) === head);

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

/**
 * The techniques the note at the caret carries that toggling would take off —
 * what the note menu shows as pressed. The same lookup as toggleTechnique (the
 * caret's beat as written, its note on the caret's string) and the same test:
 * a technique is in the set exactly when the note's first token with its head
 * is its own token, so of the four bends only the one written counts, and a
 * spelling toggleTechnique would rewrite rather than remove (`{lht()}`) does
 * not. Empty for a rest, an empty string, or a beat the editor cannot read.
 * That matches what toggleTechnique would do only for a `scoreNode` from a
 * parse that is `ok` (`parseTex` can return one for a parse that is not, and
 * toggleTechnique refuses that document), so pass `null` for a parse that is
 * not `ok`.
 */
export function techniquesAt(text: string, scoreNode: any, caret: Caret): ReadonlySet<Technique> {
  const pressed = new Set<Technique>();
  const range = scoreNode ? beatSpliceRange(text, scoreNode, caret) : null;
  const beat = range && parseBeatText(sliceCp(text, range.cpStart, range.cpEnd));
  const note = beat?.notes.find((n) => n.string === caret.string);
  if (!note) return pressed;
  const tokens = tokensOf(note.effects);
  for (const technique of TECHNIQUES) {
    const token = TOKEN[technique];
    if (tokens.find((t) => tokenHead(t) === tokenHead(token)) === token) pressed.add(technique);
  }
  return pressed;
}
