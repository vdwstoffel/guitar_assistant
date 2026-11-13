import { parseRiffPatch, type RiffPatch } from "./riffs";
import type { Riff, RiffPart, RiffSummary } from "@/types";

export type SongsView = "write" | "riffs" | "songs";

/** Where the Songs section is: its view, and in the Riffs view the riff and part open. */
export interface SongsLocation {
  view: SongsView;
  riff?: string | null;
  part?: string | null;
  /** The song open in the Songs view. */
  song?: string | null;
}

/** The URL for a place in the Songs section (a part only counts inside a riff). */
export function songsHref(loc: SongsLocation): string {
  const q = new URLSearchParams({ view: loc.view });
  if (loc.view === "riffs" && loc.riff) {
    q.set("riff", loc.riff);
    if (loc.part) q.set("part", loc.part);
  }
  if (loc.view === "songs" && loc.song) q.set("song", loc.song);
  return `/songs?${q.toString()}`;
}

/** A full riff as the list shows it, so a saved change shows in the list without refetching it. */
export function riffSummary(r: Riff): RiffSummary {
  return {
    id: r.id,
    name: r.name,
    keyRoot: r.keyRoot,
    scale: r.scale,
    tuning: r.tuning,
    tempo: r.tempo,
    tsNum: r.tsNum,
    tsDen: r.tsDen,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    parts: r.parts.map((p) => ({
      id: p.id,
      kind: p.kind,
      name: p.name,
      hasTab: !!p.alphatex?.trim(),
      hasAudio: !!p.audioPath,
    })),
  };
}

/** The list with `s` in place of the entry it updates; a riff not in the list is not added. */
export function replaceSummary(list: RiffSummary[], s: RiffSummary): RiffSummary[] {
  return list.some((r) => r.id === s.id) ? list.map((r) => (r.id === s.id ? s : r)) : list;
}

export function isTabbed(r: { parts: { hasTab: boolean }[] }): boolean {
  return r.parts.some((p) => p.hasTab);
}

/** "4/4 · ♩ 92", or "4/4 · tempo not tapped" before it has one. */
export function riffShape(r: { tsNum: number; tsDen: number; tempo: number | null }): string {
  return `${r.tsNum}/${r.tsDen} · ${r.tempo === null ? "tempo not tapped" : `♩ ${r.tempo}`}`;
}

/** The part a riff card's tab button opens: the first one with a tab, else the first one. */
export function tabLink(r: { parts: { id: string; hasTab: boolean }[] }): { partId: string; label: "Open tab" | "Tab it out" } | null {
  const tabbed = r.parts.find((p) => p.hasTab);
  if (tabbed) return { partId: tabbed.id, label: "Open tab" };
  return r.parts[0] ? { partId: r.parts[0].id, label: "Tab it out" } : null;
}

/** The riff with header edits that are still being saved laid over it, oldest first. */
export function applyEdits(riff: Riff, edits: RiffPatch[]): Riff {
  return edits.length ? edits.reduce<Riff>((r, e) => ({ ...r, ...e }), riff) : riff;
}

/** The header fields typed into a box (the rest are picked from a list). */
export type DraftField = "name" | "tempo" | "tsNum";

/**
 * What a header box's text saves as, or null while it is not a value the
 * riff accepts (an empty name, "14" on the way to "140"). Uses the API's own
 * checks, so the box never sends what the server would refuse.
 */
export function parseDraft(field: DraftField, text: string): string | number | null {
  const t = text.trim();
  let value: string | number;
  if (field === "name") {
    value = t;
  } else {
    if (!/^\d+$/.test(t)) return null;
    value = Number(t);
  }
  const parsed = parseRiffPatch({ [field]: value });
  return parsed.ok ? (parsed.value[field] ?? null) : null;
}

/** The streaming URL of a take stored under `music/`. */
export function takeSrc(audioPath: string): string {
  return `/api/audio/${audioPath.split("/").map(encodeURIComponent).join("/")}`;
}

/** The kept part of a take; with no end stored, up to the end of the recording (Infinity: unknown). */
export function takeWindow(part: Pick<RiffPart, "trimStart" | "trimEnd" | "audioDuration">): { trimStart: number; trimEnd: number } {
  const trimStart = part.trimStart ?? 0;
  const end = part.trimEnd ?? part.audioDuration;
  return { trimStart, trimEnd: end !== null && end > trimStart ? end : Infinity };
}

/** A take's clock, m:ss.t. Rounded to tenths before the minutes are split off, so 59.96 s reads 1:00.0, never 0:60.0. */
export function takeClock(seconds: number): string {
  const tenths = Number.isFinite(seconds) ? Math.round(Math.max(0, seconds) * 10) : 0;
  return `${Math.floor(tenths / 600)}:${((tenths % 600) / 10).toFixed(1).padStart(4, "0")}`;
}
