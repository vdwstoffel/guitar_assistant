import type { Composition } from "@/types";

type Row = {
  id: string;
  name: string;
  lyrics: string;
  createdAt: Date;
  updatedAt: Date;
  sections: {
    id: string;
    label: string;
    repeats: number;
    sortOrder: number;
    riff: { id: string; name: string; keyRoot: string; scale: string; tempo: number | null; tsNum: number; tsDen: number } | null;
  }[];
};

/** A stored song as clients see it: sections in order, dates as ISO strings. */
export function songToJson(row: Row): Composition {
  return {
    id: row.id,
    name: row.name,
    lyrics: row.lyrics,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    sections: [...row.sections].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => ({
      id: s.id,
      label: s.label,
      repeats: s.repeats,
      sortOrder: s.sortOrder,
      riff: s.riff
        ? { id: s.riff.id, name: s.riff.name, keyRoot: s.riff.keyRoot, scale: s.riff.scale, tempo: s.riff.tempo, tsNum: s.riff.tsNum, tsDen: s.riff.tsDen }
        : null,
    })),
  };
}

export const SONG_INCLUDE = {
  sections: {
    orderBy: { sortOrder: "asc" as const },
    include: { riff: { select: { id: true, name: true, keyRoot: true, scale: true, tempo: true, tsNum: true, tsDen: true } } },
  },
};
