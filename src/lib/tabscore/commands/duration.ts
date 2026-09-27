/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import { editBeat, parseBeatText, tokensOf, formatEffects } from "./beatText";
import { beatSpliceRange, type Caret } from "../locate";
import { type CommandResult } from "../apply";
import { parseTex } from "../parse";
import { sliceCp } from "../offsets";

const DURATIONS = [1, 2, 4, 8, 16, 32, 64];

/** The duration in force at a caret: explicit on this beat, else inherited. */
export function effectiveDuration(text: string, caret: Caret): number | null {
  const { scoreNode, ok } = parseTex(text);
  if (!ok || !scoreNode) return null;

  for (let bar = caret.barIndex; bar >= 0; bar--) {
    const beats: any[] = scoreNode.bars[bar]?.beats ?? [];
    const from = bar === caret.barIndex ? caret.beatIndex : beats.length - 1;
    for (let b = from; b >= 0; b--) {
      const range = beatSpliceRange(text, scoreNode, { ...caret, barIndex: bar, beatIndex: b });
      if (!range) continue;
      const parsed = parseBeatText(sliceCp(text, range.cpStart, range.cpEnd));
      if (parsed?.durationSuffix) return Number(parsed.durationSuffix.slice(1));
    }
  }
  return 4; // AlphaTex default
}

export function scaleDuration(
  text: string,
  caret: Caret,
  direction: "halve" | "double",
): CommandResult | null {
  const current = effectiveDuration(text, caret);
  if (current === null) return null;

  const i = DURATIONS.indexOf(current);
  if (i === -1) return null;
  const next = DURATIONS[direction === "halve" ? i + 1 : i - 1];
  if (next === undefined) return null;

  return editBeat(text, caret, (beat) => ({ ...beat, durationSuffix: `.${next}` }));
}

export function toggleDotted(text: string, caret: Caret): CommandResult | null {
  const current = effectiveDuration(text, caret);
  if (current === null) return null;

  return editBeat(text, caret, (beat) => {
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
    const durationSuffix = beat.durationSuffix || `.${current}`;

    const notes = dottedNoteIndex === -1
      ? beat.notes
      : beat.notes.map((n, i) =>
          i === dottedNoteIndex
            ? { ...n, effects: formatEffects(tokensOf(n.effects).filter((t) => t !== "d")) }
            : n,
        );

    // Edit the beat's own token list rather than replacing the whole block:
    // a wholesale "{d}" / "" would silently destroy any sibling beat-level
    // token this beat also carries (e.g. "{tu 3}", a triplet marker) — see
    // invariants.test.ts's "preserves a beat-level effect it does not own".
    const rest = tokensOf(beat.effects).filter((t) => t !== "d");

    return {
      ...beat,
      notes,
      durationSuffix,
      effects: formatEffects(isDotted ? rest : [...rest, "d"]),
    };
  });
}
