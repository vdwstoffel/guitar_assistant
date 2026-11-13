import { parseProgression } from "./sessionPrefs";
import type { Riff, RiffPart } from "@/types";

type RiffRow = Omit<Riff, "progression" | "createdAt" | "updatedAt" | "parts"> & {
  progression: string | null;
  createdAt: Date;
  updatedAt: Date;
  parts: (Omit<RiffPart, "kind" | "listen"> & { kind: string; listen: string })[];
};

/** A stored riff as clients see it: progression parsed, parts in order, dates as ISO strings. */
export function riffToJson(row: RiffRow): Riff {
  let progression: Riff["progression"] = [];
  try {
    progression = row.progression ? parseProgression(JSON.parse(row.progression)) : [];
  } catch {
    progression = [];
  }
  return {
    ...row,
    progression,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    parts: [...row.parts]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => ({ ...p, kind: p.kind as RiffPart["kind"], listen: p.listen as RiffPart["listen"] })),
  };
}
