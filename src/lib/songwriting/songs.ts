/** Rules for songs (compositions) made of riff sections. Prisma-free. */

export const SONG_SHAPE = ["Intro", "Verse", "Chorus", "Verse", "Chorus", "Bridge", "Chorus"] as const;

export const MAX_SECTIONS = 64;
export const MAX_LYRICS = 50_000;

export interface SectionInput {
  label: string;
  riffId: string | null;
  repeats: number;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const intIn = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;

export function parseSectionsInput(v: unknown): Result<SectionInput[]> {
  if (!Array.isArray(v)) return { ok: false, error: "sections must be a list" };
  if (v.length > MAX_SECTIONS) return { ok: false, error: `a song has at most ${MAX_SECTIONS} sections` };
  const out: SectionInput[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { ok: false, error: "each section must be an object" };
    const o = item as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim() : "";
    if (label.length < 1 || label.length > 40) return { ok: false, error: "label must be 1-40 characters" };
    if (!intIn(o.repeats, 1, 16)) return { ok: false, error: "repeats must be an integer 1-16" };
    const riffId = o.riffId ?? null;
    if (riffId !== null && (typeof riffId !== "string" || !riffId)) return { ok: false, error: "riffId must be a riff id or null" };
    out.push({ label, riffId, repeats: o.repeats });
  }
  return { ok: true, value: out };
}

type NoteSection = { riff: { keyRoot: string; scale: string; tempo: number | null } | null };

/** One entry per gap between section i and i+1: what changes, or null. */
export function sectionNotes(sections: readonly NoteSection[]): (string | null)[] {
  const notes: (string | null)[] = [];
  for (let i = 0; i + 1 < sections.length; i++) {
    const a = sections[i].riff;
    const b = sections[i + 1].riff;
    if (!a || !b) {
      notes.push(null);
      continue;
    }
    const parts: string[] = [];
    if (a.keyRoot !== b.keyRoot || a.scale !== b.scale) parts.push(`key changes ${a.keyRoot} ${a.scale} → ${b.keyRoot} ${b.scale}`);
    // A riff whose tempo is not tapped yet changes nothing that can be said.
    if (a.tempo !== null && b.tempo !== null && a.tempo !== b.tempo) parts.push(`tempo ${a.tempo} → ${b.tempo}`);
    notes.push(parts.length ? parts.join(" · ") : null);
  }
  return notes;
}

/** Indices of the sections that have a riff to play. */
export function playableSections(sections: readonly NoteSection[]): number[] {
  const out: number[] = [];
  sections.forEach((s, i) => {
    if (s.riff) out.push(i);
  });
  return out;
}

/** "Song N", one past the highest there is, so deleting a song never leads to a duplicate name. */
export function defaultSongName(existingNames: readonly string[]): string {
  let highest = 0;
  for (const name of existingNames) {
    const m = /^Song (\d+)$/.exec(name);
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  return `Song ${highest + 1}`;
}
