/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import { parseTex } from "../parse";
import { sliceCp } from "../offsets";
import { beatSpliceRange, type Caret } from "../locate";
import { type CommandResult } from "../apply";
import { editBeat, parseBeatText, tokensOf, formatEffects, type ParsedBeat } from "./beatText";
import { effectiveDuration } from "./duration";
import { insertBeat } from "./structure";

/** The default and by far the commonest: three in the time of two. */
export const TRIPLET = 3;

/**
 * A tuplet is a BEAT-level `{tu n}` effect that has to appear on EVERY beat
 * of the group — `3.6.8{tu 3} 5.6{tu 3} 7.6{tu 3}` is one triplet filling a
 * single quarter-note beat. Verified against alphaTab 1.8.1: three tuplet
 * eighths come to 960 ticks, exactly two plain eighths, and a bar of twelve
 * fills 4/4 to the tick. The marker sits happily on a rest or a chord, and
 * alongside other beat effects.
 *
 * Because the group is n beats and not one, `toggleTuplet` marks all n at
 * once. An earlier version marked only the caret's beat and carried the
 * marker onto beats added afterwards, which worked only while typing past
 * the end of the score: arrowing onto a rest that already existed adds no
 * beat, so nothing carried and the group silently stayed one beat long.
 *
 * The marker is written with an explicit duration — `1.6.8{tu 3}`, the form
 * the real importer emits — because a duration-less single note's trailing
 * brace is ambiguous between the note's effects and the beat's, and a bare
 * `1.6{tu 3}` reads back as the note's.
 */
const TU = /^tu\s+(\d+)$/;

/**
 * The tuplet this beat carries, from wherever it ended up in the text.
 *
 * parseBeatText resolves a duration-less single note's trailing brace to the
 * NOTE, so a hand-written `5.6{tu 3}` reads back with the marker there;
 * looking only at `beat.effects` would call the beat unmarked and write a
 * second block beside the first. toggleDotted has the same hazard.
 */
function tupletOf(beat: ParsedBeat): number | null {
  for (const effects of [beat.effects, ...beat.notes.map((note) => note.effects)]) {
    for (const token of tokensOf(effects)) {
      const m = TU.exec(token);
      if (m) return Number(m[1]);
    }
  }
  return null;
}

/** What the beat at the caret is part of, if anything. */
export function tupletAt(text: string, scoreNode: any, caret: Caret): number | null {
  const range = beatSpliceRange(text, scoreNode, caret);
  if (!range) return null;
  const beat = parseBeatText(sliceCp(text, range.cpStart, range.cpEnd));
  return beat ? tupletOf(beat) : null;
}

/** Put the marker on one beat, or take it off. Idempotent, unlike a toggle. */
function setBeatTuplet(text: string, caret: Caret, n: number | null): CommandResult | null {
  const duration = effectiveDuration(text, caret);
  if (duration === null) return null;

  return editBeat(text, caret, (beat) => {
    const rest = tokensOf(beat.effects).filter((t) => !TU.test(t));
    // Strip the marker from wherever it was read and re-emit it on the beat,
    // with an explicit duration so the brace can only be the beat's.
    const notes = beat.notes.map((note) => ({
      ...note,
      effects: formatEffects(tokensOf(note.effects).filter((t) => !TU.test(t))),
    }));

    return {
      ...beat,
      notes,
      durationSuffix: beat.durationSuffix || `.${duration}`,
      effects: formatEffects(n === null ? rest : [...rest, `tu ${n}`]),
    };
  });
}

/** How many beats the bar currently holds. */
function beatCount(text: string, barIndex: number): number {
  const parsed = parseTex(text);
  return parsed.ok ? (parsed.scoreNode?.bars?.[barIndex]?.beats?.length ?? 0) : 0;
}

/** The consecutive run of `n`-tuplet beats containing the caret, in its bar. */
function runIndices(text: string, scoreNode: any, caret: Caret, n: number): number[] {
  const beats: any[] = scoreNode?.bars?.[caret.barIndex]?.beats ?? [];
  const inRun = (i: number) => tupletAt(text, scoreNode, { ...caret, beatIndex: i }) === n;
  if (!inRun(caret.beatIndex)) return [];

  let first = caret.beatIndex;
  while (first > 0 && inRun(first - 1)) first--;
  let last = caret.beatIndex;
  while (last + 1 < beats.length && inRun(last + 1)) last++;

  return Array.from({ length: last - first + 1 }, (_, k) => first + k);
}

/**
 * Make the caret's beat and the `n - 1` after it one tuplet, or take an
 * existing one apart.
 *
 * Marking grows the bar when it does not already hold enough beats, so this
 * works at the end of a score as well as over rests already written.
 * Unmarking clears the whole run the caret sits in, however long it grew:
 * pulling one beat out of a triplet would leave notation that does not add
 * up.
 *
 * The steps are chained `CommandResult`s rather than one hand-built splice,
 * so `commitEdit` validates every intermediate text on the way through.
 */
export function toggleTuplet(
  text: string,
  caret: Caret,
  n: number = TRIPLET,
): CommandResult | null {
  if (!Number.isInteger(n) || n < 2 || n > 16) return null;

  const parsed = parseTex(text);
  if (!parsed.ok || !parsed.scoreNode) return null;
  if (caret.beatIndex >= beatCount(text, caret.barIndex)) return null;

  const existing = runIndices(text, parsed.scoreNode, caret, n);
  let current = text;

  if (existing.length > 0) {
    // Right to left: each step re-parses, but working backwards means the
    // indices still to be visited keep their meaning.
    for (const index of [...existing].reverse()) {
      const step = setBeatTuplet(current, { ...caret, beatIndex: index }, null);
      if (!step) return null;
      current = step.text;
    }
    return { text: current, caret };
  }

  for (let k = n - 1; k >= 0; k--) {
    const beatIndex = caret.beatIndex + k;
    // Grow the bar if the group runs past what is written so far.
    while (beatCount(current, caret.barIndex) <= beatIndex) {
      const from = beatCount(current, caret.barIndex) - 1;
      const grown = insertBeat(current, { ...caret, beatIndex: from });
      if (!grown) return null;
      current = grown.text;
    }
    const step = setBeatTuplet(current, { ...caret, beatIndex }, n);
    if (!step) return null;
    current = step.text;
  }

  return { text: current, caret };
}
