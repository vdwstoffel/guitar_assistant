import type { Riff, RiffPart } from "@/types";
import { effectiveGains, heardTabs, heardTakes } from "./riffScore";

/** A part's mixer settings (the part PATCH fields). */
export type PartMix = Partial<Pick<RiffPart, "listen" | "level" | "muted" | "soloed">>;
/** A part's settings saved the mixer's way: its mix, and its name (renamed in its row). */
export type PartEdit = PartMix & Partial<Pick<RiffPart, "name">>;
/** One mixer change, to a part (by id). */
export type MixEdit = { partId: string; fields: PartEdit };

/** The riff with mixer changes still being saved laid over it, oldest first. */
export function applyMixEdits(riff: Riff, edits: MixEdit[]): Riff {
  if (edits.length === 0) return riff;
  let parts = riff.parts;
  for (const e of edits) parts = parts.map((p) => (p.id === e.partId ? { ...p, ...e.fields } : p));
  return { ...riff, parts };
}

/** What each part sounds at, keyed by part id: one rule for tabs and takes (riffScore's effectiveGains). */
export function mixGains(riff: Pick<Riff, "parts">): { parts: Record<string, number> } {
  const gains = effectiveGains(riff.parts.map((p) => ({ level: p.level, muted: p.muted, soloed: p.soloed })));
  return { parts: Object.fromEntries(riff.parts.map((p, i) => [p.id, gains[i]])) };
}

type Source = Pick<RiffPart, "alphatex" | "audioPath" | "listen">;

/** What the riff player plays for this part: its tab, its take, or nothing yet. */
export function heardAs(part: Source): "tab" | "recording" | null {
  if (heardTabs([part]).length > 0) return "tab";
  if (heardTakes([part]).length > 0) return "recording";
  return null;
}

/** The part has a tab and a take, so it can be switched between them. */
export function canSwitch(part: Source): boolean {
  return !!part.audioPath && !!part.alphatex?.trim();
}
