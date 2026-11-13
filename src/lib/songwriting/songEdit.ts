/** Editing a song's section list in the browser: rows, moves, the shape, picker labels. Prisma-free. */
import { SONG_SHAPE, type SectionInput } from "./songs";
import type { SongSection, SongSectionRiff } from "@/types";

/** A section as the editor holds it; `key` stays the same across saves so a row keeps its focus. */
export interface Row {
  key: string;
  label: string;
  riffId: string | null;
  repeats: number;
  riff: SongSectionRiff | null;
  /**
   * The riff this row had is gone. The server cannot say so (a deleted riff
   * and none picked both read as null), so it is known only from a row that
   * had a riff on screen and then came back without one.
   */
  riffDeleted: boolean;
}

export const NEW_SECTION_LABEL = "Section";

export const rowsToInput = (rows: readonly Row[]): SectionInput[] =>
  rows.map((r) => ({ label: r.label, riffId: r.riffId, repeats: r.repeats }));

/** The server's sections as rows, reusing the keys of the rows already on screen by position. */
export function reconcileRows(prev: readonly Row[], sections: readonly SongSection[]): Row[] {
  return sections.map((s, i) => ({
    key: prev[i]?.key ?? s.id,
    label: s.label,
    riffId: s.riff ? s.riff.id : null,
    repeats: s.repeats,
    riff: s.riff,
    riffDeleted: !s.riff && !!(prev[i]?.riff || prev[i]?.riffDeleted),
  }));
}

export function updateRow(rows: readonly Row[], i: number, patch: Partial<Omit<Row, "key">>): Row[] {
  return rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
}

/** Swap row i with the one `by` places away; out of range leaves the list as it is. */
export function moveRow(rows: readonly Row[], i: number, by: -1 | 1): Row[] {
  const j = i + by;
  if (i < 0 || i >= rows.length || j < 0 || j >= rows.length) return [...rows];
  const out = [...rows];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export const removeRow = (rows: readonly Row[], i: number): Row[] => rows.filter((_, j) => j !== i);

export const addRow = (rows: readonly Row[], key: string): Row[] => [
  ...rows,
  { key, label: NEW_SECTION_LABEL, riffId: null, repeats: 1, riff: null, riffDeleted: false },
];

/** The common song shape as empty rows (no riffs yet). */
export const shapeRows = (newKey: () => string): Row[] =>
  SONG_SHAPE.map((label) => ({ key: newKey(), label, riffId: null, repeats: 1, riff: null, riffDeleted: false }));

/** "Riff name · E Phrygian · ♩120" ("· no tempo yet" before one is tapped) */
export const riffOptionLabel = (r: { name: string; keyRoot: string; scale: string; tempo: number | null }): string =>
  `${r.name} · ${r.keyRoot} ${r.scale} · ${r.tempo === null ? "no tempo yet" : `♩${r.tempo}`}`;

/** What the label box saves: the trimmed text when the server would take it. */
export function parseLabel(text: string): string | null {
  const t = text.trim();
  return t.length >= 1 && t.length <= 40 ? t : null;
}

/** What the sections PUT says when a riffId is not a riff any more. */
export const UNKNOWN_RIFF_ERROR = "riffId does not match a riff";

/** The rows with every riff not in `existing` taken out and marked deleted; the rest of each row, and the user's edit, stay. */
export function dropUnknownRiffs(rows: readonly Row[], existing: ReadonlySet<string>): Row[] {
  return rows.map((r) => (r.riffId !== null && !existing.has(r.riffId) ? { ...r, riffId: null, riff: null, riffDeleted: true } : r));
}
