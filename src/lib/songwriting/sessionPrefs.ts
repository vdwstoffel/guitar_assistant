import { NOTES, SCALE_FORMULAS } from "../musicTheory";
import { MAX_TEMPO, MIN_TEMPO } from "../tabscore/commands/tempo";
import { CHORD_QUALITIES, type ChordQuality, type ProgressionChord } from "./theory";
import { SESSION_TUNING_IDS } from "./tunings";

export interface SessionPrefs {
  keyRoot: string;
  scale: string;
  tuning: string;
  progression: ProgressionChord[];
  labelMode: "intervals" | "notes";
  /** The tempo the click plays at while recording (tapped or typed); null: record without one. */
  clickTempo: number | null;
  tsNum: number;
  tsDen: number;
  /** Count in and click while recording, when there is a tempo. */
  click: boolean;
}

/** The time signatures offered for recording. */
export const SESSION_TIME_SIGNATURES = [[4, 4], [3, 4], [6, 8], [2, 4], [5, 4], [7, 8]] as const;

export const DEFAULT_SESSION: SessionPrefs = {
  keyRoot: "A",
  scale: "Minor",
  tuning: "standard",
  progression: [],
  labelMode: "intervals",
  clickTempo: null,
  tsNum: 4,
  tsDen: 4,
  click: true,
};

export const SESSION_STORAGE_KEY = "guitar-assistant.songwritingSession";

const isRoot = (v: unknown): v is string => typeof v === "string" && (NOTES as readonly string[]).includes(v);

/** Keep the chords with a known root and quality; bars are clamped to 1-8. */
export function parseProgression(value: unknown): ProgressionChord[] {
  if (!Array.isArray(value)) return [];
  const out: ProgressionChord[] = [];
  for (const c of value) {
    if (!c || typeof c !== "object") continue;
    const { root, quality, bars } = c as Record<string, unknown>;
    if (!isRoot(root) || !CHORD_QUALITIES.includes(quality as ChordQuality)) continue;
    const n = typeof bars === "number" && Number.isFinite(bars) ? Math.round(bars) : 1;
    out.push({ root, quality: quality as ChordQuality, bars: Math.min(8, Math.max(1, n)) });
  }
  return out;
}

/** Read saved prefs, falling back to the default field by field (and dropping fields no longer kept, like the groove's). */
export function parseSessionPrefs(raw: string | null): SessionPrefs {
  let o: Record<string, unknown>;
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_SESSION, progression: [] };
    o = parsed as Record<string, unknown>;
  } catch {
    return { ...DEFAULT_SESSION, progression: [] };
  }
  const d = DEFAULT_SESSION;
  const t = o.clickTempo;
  const ts = SESSION_TIME_SIGNATURES.find(([n, den]) => n === o.tsNum && den === o.tsDen) ?? [d.tsNum, d.tsDen];
  return {
    keyRoot: isRoot(o.keyRoot) ? o.keyRoot : d.keyRoot,
    scale: typeof o.scale === "string" && o.scale !== "None" && Object.hasOwn(SCALE_FORMULAS, o.scale) ? o.scale : d.scale,
    tuning: typeof o.tuning === "string" && SESSION_TUNING_IDS.includes(o.tuning) ? o.tuning : d.tuning,
    progression: parseProgression(o.progression),
    labelMode: o.labelMode === "notes" ? "notes" : "intervals",
    clickTempo: typeof t === "number" && Number.isInteger(t) && t >= MIN_TEMPO && t <= MAX_TEMPO ? t : null,
    tsNum: ts[0],
    tsDen: ts[1],
    click: typeof o.click === "boolean" ? o.click : d.click,
  };
}

/** The click a take is recorded to — and so the tempo and time signature its riff keeps — or null: just audio. */
export function recordingClick(s: SessionPrefs): { tempo: number; tsNum: number; tsDen: number } | null {
  return s.click && s.clickTempo !== null ? { tempo: s.clickTempo, tsNum: s.tsNum, tsDen: s.tsDen } : null;
}

export function serializeSessionPrefs(p: SessionPrefs): string {
  return JSON.stringify(p);
}
