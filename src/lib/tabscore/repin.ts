/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab exposes its AST node types only through the `alphaTex` namespace,
 * which cannot be imported as a type across the bundle boundary. These `any`s
 * are the interop boundary with that untyped surface, not unexamined typing.
 */
import { parseTex } from "./parse";
import { sliceCp, spliceCp } from "./offsets";
import { beatSpliceRange, findBeatNode, type BeatPos } from "./locate";
import { formatBeat, liftLengthMarkers, parseBeatText } from "./commands/beatText";
import { misreads } from "./commands/barEdit";

/** AlphaTex's duration when nothing earlier sets one. */
const DEFAULT_DURATION = 4;

/** The duration a beat's own text sets — its `.8` suffix, or a `:8` written before it — or null. */
export function ownDuration(beatNode: any): number | null {
  const suffix = beatNode?.durationValue?.value;
  if (typeof suffix === "number") return suffix;
  const change = beatNode?.durationChange?.value?.value;
  return typeof change === "number" ? change : null;
}

/**
 * The duration in force at a beat, from a parsed AST: its own, else the
 * nearest earlier one — across bar lines, which is how AlphaTex inherits it
 * (only the duration: `{d}`, `{dd}` and `{tu n}` belong to one beat) — else 4.
 * It is the text-level duration later beats inherit, not the finished model's
 * `Beat.duration` (alphaTab rewrites a grace beat's), and a sticky `:8{tu 3}`
 * is outside its scope (isEditableBar refuses a bar that has one).
 */
export function durationAt(scoreNode: any, pos: BeatPos): number {
  const bars: any[] = scoreNode?.bars ?? [];
  for (let bar = pos.barIndex; bar >= 0; bar--) {
    const beats: any[] = bars[bar]?.beats ?? [];
    const from = bar === pos.barIndex ? Math.min(pos.beatIndex, beats.length - 1) : beats.length - 1;
    for (let beat = from; beat >= 0; beat--) {
      const own = ownDuration(beats[beat]);
      if (own !== null) return own;
    }
  }
  return DEFAULT_DURATION;
}

/** The duration in force at a beat; null when the text does not parse. */
export function inheritedDuration(text: string, pos: BeatPos): number | null {
  const { scoreNode, ok } = parseTex(text);
  return ok && scoreNode ? durationAt(scoreNode, pos) : null;
}

/**
 * Keep the beat at `pos` at `duration` after an edit before it: when it has
 * no duration of its own and now inherits another, write `.duration` onto it,
 * and everything after it inherits as before. Callers pass the value the beat
 * had before their edit (read with durationAt first). Returns the text
 * unchanged when nothing needs writing or no beat is there.
 *
 * The pin is a suffix after the beat's notes and before its own effects, and
 * formatBeat writes every effect block back as it was read, so a chord name
 * or a text (`(3.5 5.4){ch "Am"}` → `(3.5 5.4).4{ch "Am"}`) comes through
 * whole. Only lifting a length marker off a note onto the beat
 * (liftLengthMarkers) re-tokenises the effects; that is refused when the beat
 * is one the commands `misreads` (barEdit) — a quoted, unquoted or upper-case
 * argument (`{ch "Am"}`, `{ch Am}`, `{CH Am}`), which tokensOf would split
 * apart, or a marked tie. Null then, and when the text does not parse or the
 * beat is one parseBeatText cannot read (`x.5`): the caller refuses. The beat
 * may sit in the next bar, which the caller's bar check never saw.
 */
export function repinAt(text: string, pos: BeatPos, duration: number): string | null {
  const { scoreNode, ok } = parseTex(text);
  if (!ok || !scoreNode) return null;
  const node = findBeatNode(scoreNode, pos);
  if (!node || ownDuration(node) !== null || durationAt(scoreNode, pos) === duration) return text;
  const range = beatSpliceRange(text, scoreNode, pos);
  if (!range) return null;
  const beat = parseBeatText(sliceCp(text, range.cpStart, range.cpEnd));
  if (!beat) return null;
  const lifted = liftLengthMarkers(beat);
  if (lifted !== beat && misreads(beat)) return null;
  return spliceCp(text, range.cpStart, range.cpEnd, formatBeat({ ...lifted, durationSuffix: `.${duration}` }));
}
