import { NOTES, SCALE_FORMULAS } from "../musicTheory";
import { MIN_TEMPO, MAX_TEMPO, readTempo, setOrInsertTempo } from "../tabscore/commands/tempo";
import { TUNING_PRESETS, BASS_TUNING_PRESETS, readTuningId, setTuning, tuningDirective } from "../tabscore/commands/tuning";
import { normalizeNewlines } from "../tabscore/offsets";
import { parseTex } from "../tabscore/parse";
import { bassTuningFor } from "./bassTunings";
import { GUITAR_PRESETS, instrumentDirective } from "../tabscore/commands/instrument";
import { parseProgression } from "./sessionPrefs";
import type { ProgressionChord } from "./theory";

export interface RiffInput {
  name: string | null;
  keyRoot: string;
  scale: string;
  tuning: string;
  /** Null until it is tapped (or typed): a recording needs none. */
  tempo: number | null;
  tsNum: number;
  tsDen: number;
  progression: ProgressionChord[];
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export type RiffShape = { tempo: number | null; tsNum: number; tsDen: number; tuning: string };

/** How many empty bars a new tab starts with; you add or remove bars in the editor. */
export const NEW_TAB_BARS = 4;

const DENOMINATORS = [1, 2, 4, 8, 16];
const intIn = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;

type Fields = Omit<RiffInput, "progression">;
const CHECKS: { [K in keyof Fields]: (v: unknown) => string | null } = {
  name: (v) => {
    if (v === null) return null;
    return typeof v === "string" && v.trim().length >= 1 && v.trim().length <= 80 ? null : "name must be 1-80 characters";
  },
  keyRoot: (v) => ((NOTES as readonly string[]).includes(v as string) ? null : "unknown keyRoot"),
  scale: (v) =>
    typeof v === "string" && v !== "None" && Object.prototype.hasOwnProperty.call(SCALE_FORMULAS, v) ? null : "unknown scale",
  tuning: (v) => (TUNING_PRESETS.some((p) => p.id === v) ? null : "unknown tuning"),
  tempo: (v) => (intIn(v, MIN_TEMPO, MAX_TEMPO) ? null : `tempo must be an integer ${MIN_TEMPO}-${MAX_TEMPO}`),
  tsNum: (v) => (intIn(v, 1, 16) ? null : "tsNum must be an integer 1-16"),
  tsDen: (v) => (DENOMINATORS.includes(v as number) ? null : "tsDen must be 1, 2, 4, 8 or 16"),
};

/** A new riff: a recording needs no tempo (null until tapped), and its time signature defaults to 4/4. */
export function parseRiffInput(v: unknown): Result<RiffInput> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return { ok: false, error: "riff must be an object" };
  const o: Record<string, unknown> = { tsNum: 4, tsDen: 4, ...(v as Record<string, unknown>) };
  for (const key of Object.keys(CHECKS) as (keyof Fields)[]) {
    if (key === "name" && o.name === undefined) continue;
    if (key === "tempo" && (o.tempo === undefined || o.tempo === null)) continue;
    const err = CHECKS[key](o[key]);
    if (err) return { ok: false, error: err };
  }
  const name = typeof o.name === "string" ? o.name.trim() : null;
  return {
    ok: true,
    value: {
      name,
      keyRoot: o.keyRoot as string,
      scale: o.scale as string,
      tuning: o.tuning as string,
      tempo: (o.tempo as number | undefined) ?? null,
      tsNum: o.tsNum as number,
      tsDen: o.tsDen as number,
      progression: parseProgression(o.progression),
    },
  };
}

/** The editable header fields; unlike a new riff's, a patched `name` or `tempo` is never null. */
export type RiffPatch = Partial<Omit<RiffInput, "progression" | "name" | "tempo">> & { name?: string; tempo?: number };

export function parseRiffPatch(v: unknown): Result<RiffPatch> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return { ok: false, error: "patch must be an object" };
  const o = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(CHECKS) as (keyof Fields)[]) {
    if (o[key] === undefined) continue;
    if (key === "name" && o.name === null) return { ok: false, error: "name must be 1-80 characters" };
    if (key === "tempo" && o.tempo === null) return { ok: false, error: `tempo must be an integer ${MIN_TEMPO}-${MAX_TEMPO}` };
    const err = CHECKS[key](o[key]);
    if (err) return { ok: false, error: err };
    out[key] = key === "name" ? (o[key] as string).trim() : o[key];
  }
  return { ok: true, value: out as RiffPatch };
}

/**
 * The name a riff saved without one gets: one past the highest "Riff N" there
 * is, so deleting a riff never leads to two with the same name.
 */
export function defaultRiffName(existingNames: readonly string[]): string {
  let highest = 0;
  for (const name of existingNames) {
    const m = /^Riff (\d+)$/.exec(name);
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  return `Riff ${highest + 1}`;
}

export function riffAudioDir(riffId: string): string {
  return `Riffs/${riffId}`;
}

export type PartKind = "guitar" | "bass";

/** Ruling 4: guitars are "Guitar N" (one past the highest), the first bass is "Bass", then "Bass 2", … */
export function nextPartName(kind: PartKind, existingNames: readonly string[]): string {
  const re = kind === "guitar" ? /^Guitar (\d+)$/ : /^Bass(?: (\d+))?$/;
  let highest = 0;
  for (const name of existingNames) {
    const m = re.exec(name);
    if (m) highest = Math.max(highest, m[1] ? Number(m[1]) : 1);
  }
  if (kind === "guitar") return `Guitar ${highest + 1}`;
  return highest === 0 ? "Bass" : `Bass ${highest + 1}`;
}

/** Electric bass (pick), the zero-based General MIDI program the bass tabs play as. */
const BASS_PROGRAM = 34;

/** A blank tab for a new part: header directives (no tempo while the riff has none), then NEW_TAB_BARS bars of rests. */
export function newPartTabTex(riff: RiffShape, kind: PartKind = "guitar"): string {
  let head: string[];
  if (kind === "bass") {
    const bassId = bassTuningFor(riff.tuning);
    const preset = BASS_TUNING_PRESETS.find((p) => p.id === bassId)!;
    head = [tuningDirective(preset), `\\instrument ${BASS_PROGRAM}`];
  } else {
    const preset = TUNING_PRESETS.find((p) => p.id === riff.tuning) ?? TUNING_PRESETS[0];
    const guitar = GUITAR_PRESETS.find((p) => p.id === "distortion")!;
    head = [tuningDirective(preset), instrumentDirective(guitar)];
  }
  if (riff.tempo !== null) head.unshift(`\\tempo ${riff.tempo}`);
  if (!(riff.tsNum === 4 && riff.tsDen === 4)) head.push(`\\ts (${riff.tsNum} ${riff.tsDen})`);
  const bar = Array.from({ length: riff.tsNum }, (_, i) => (i === 0 ? `r.${riff.tsDen}` : "r")).join(" ");
  const body = Array.from({ length: NEW_TAB_BARS }, () => bar).join(" |\n");
  return `${head.join("\n")}\n.\n${body}\n`;
}

/** The part's tab as it should open: its own text with the riff's tempo (once it has one) and (derived, for bass) tuning applied. */
export function tabTexForPart(part: { kind: PartKind; alphatex: string | null }, riff: RiffShape): string {
  if (!part.alphatex || !part.alphatex.trim()) return newPartTabTex(riff, part.kind);
  // The commands splice at offsets into newline-normalised text.
  let tex = normalizeNewlines(part.alphatex);
  if (riff.tempo !== null) tex = setOrInsertTempo(tex, riff.tempo)?.text ?? tex;
  tex = setTuning(tex, part.kind === "bass" ? bassTuningFor(riff.tuning) : riff.tuning)?.text ?? tex;
  return tex;
}

/**
 * Whether anything has been written in the tab: a note anywhere. A tab
 * alphaTab cannot read counts as written (the editor keeps broken drafts).
 */
export function tabHasNotes(tex: string): boolean {
  const { ok, score } = parseTex(tex);
  if (!ok || !score) return true;
  // The slice of alphaTab's score model this reads.
  type Model = { tracks: { staves: { bars: { voices: { beats: { isRest: boolean }[] }[] }[] }[] }[] };
  return (score as Model).tracks.some((t) =>
    t.staves.some((st) => st.bars.some((b) => b.voices.some((v) => v.beats.some((x) => !x.isRest)))),
  );
}

/**
 * Tempo and tuning the tab states that differ from the riff (the tab wins).
 * A bass tab's tuning is derived from the riff's, so it never writes one back
 * (ruling 6); nor does any tab whose tuning is not one of the riff's guitar
 * tunings (a four-string tuning in a guitar part, say): the riff holds only
 * what its header can show.
 */
export function riffWriteBack(
  tex: string,
  riff: { tempo: number | null; tuning: string },
  kind: PartKind = "guitar",
): { tempo?: number; tuning?: string } {
  const out: { tempo?: number; tuning?: string } = {};
  const tempo = readTempo(tex);
  // An out-of-range tempo stays in the tab only; the riff keeps its valid one.
  if (tempo !== null && intIn(tempo, MIN_TEMPO, MAX_TEMPO) && tempo !== riff.tempo) out.tempo = tempo;
  if (kind === "bass") return out;
  const tuning = readTuningId(tex);
  if (tuning !== null && tuning !== riff.tuning && TUNING_PRESETS.some((p) => p.id === tuning)) out.tuning = tuning;
  return out;
}

/** Trim points for a take of `duration` seconds: `0 ≤ start < end ≤ duration`, each null when unset. */
export function validTrim(start: number | null, end: number | null, duration: number | null): string | null {
  const s = start ?? 0;
  if (s < 0) return "trimStart must be at least 0";
  if (end !== null && end <= s) return "trimEnd must be after trimStart";
  if (duration !== null && end !== null && end > duration + 1e-6) return "trimEnd must not exceed the take's length";
  if (duration !== null && s >= duration) return "trimStart must be before the end of the take";
  return null;
}

/**
 * What a part is heard as once a new take is saved for it: a part that has a
 * tab switches to the take just recorded (it is what you want to hear next);
 * one without a tab keeps its setting (null), so a tab written later is what
 * plays. Only a new take does this, never a trim.
 */
export function listenAfterNewTake(part: { alphatex: string | null }): "recording" | null {
  return part.alphatex?.trim() ? "recording" : null;
}
