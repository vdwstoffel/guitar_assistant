export interface TabBeat {
  // index 0 = high e (string 1), index 5 = low E (string 6) in AlphaTex numbering
  strings: (number | null)[];
  duration: number; // AlphaTex duration value: 4=quarter, 8=eighth, 16=sixteenth
}

export interface TabBar {
  beats: TabBeat[];
}

export interface TabData {
  _version: 1;
  tempo: number;
  timeSignature: string; // e.g. "4/4"
  defaultDuration: number; // duration for new beats when adding bars (4|8|16)
  bars: TabBar[];
}

export const DURATION_CYCLE: number[] = [4, 8, 16];

export const DURATION_SYMBOL: Record<number, string> = {
  1: "𝅝",
  2: "𝅗",
  4: "♩",
  8: "♪",
  16: "♬",
  32: "𝅘𝅥𝅰",
};

export function nextDuration(current: number): number {
  const idx = DURATION_CYCLE.indexOf(current);
  return DURATION_CYCLE[(idx + 1) % DURATION_CYCLE.length];
}

export function createEmptyBeat(duration: number): TabBeat {
  return { strings: [null, null, null, null, null, null], duration };
}

/** numBeats = how many beats to add; each beat gets the given duration */
export function createEmptyBar(numBeats: number, duration: number): TabBar {
  return {
    beats: Array.from({ length: numBeats }, () => createEmptyBeat(duration)),
  };
}

/** Default: 1 bar, 8 eighth-note beats (= 1 bar of 4/4) */
export function createDefaultTabData(tempo: number): TabData {
  return {
    _version: 1,
    tempo,
    timeSignature: "4/4",
    defaultDuration: 8,
    bars: [createEmptyBar(8, 8)],
  };
}

export function isTabDataJson(value: string | null): boolean {
  if (!value) return false;
  const t = value.trim();
  return t.startsWith("{") && t.includes('"_version"');
}

export function parseTabData(value: string): TabData | null {
  try {
    const parsed = JSON.parse(value);
    if (parsed._version === 1 && Array.isArray(parsed.bars)) {
      // Migrate old slotsPerBar field → defaultDuration
      if (parsed.slotsPerBar && !parsed.defaultDuration) {
        parsed.defaultDuration = parsed.slotsPerBar;
        delete parsed.slotsPerBar;
      }
      if (!parsed.defaultDuration) parsed.defaultDuration = 8;
      return parsed as TabData;
    }
    return null;
  } catch {
    return null;
  }
}

export function tabDataToAlphaTex(data: TabData): string {
  const [num, den] = data.timeSignature.split("/").map(Number);
  // Header: tempo + optional time signature (\ts; default is 4/4)
  const lines: string[] = [`\\tempo ${data.tempo}`];
  if (!(num === 4 && den === 4)) {
    lines.push(`\\ts ${num} ${den}`);
  }
  lines.push("."); // track separator

  const barStrings: string[] = [];
  for (const bar of data.bars) {
    const parts: string[] = [];
    for (const beat of bar.beats) {
      // strings[] index 0=high e → alphaTab string 1; index 5=low E → string 6
      const notes = beat.strings
        .map((fret, i) => (fret !== null ? `${fret}.${i + 1}` : null))
        .filter((n): n is string => n !== null);

      if (notes.length === 0) {
        parts.push(`r.${beat.duration}`);
      } else if (notes.length === 1) {
        parts.push(`${notes[0]}.${beat.duration}`);
      } else {
        parts.push(`(${notes.join(" ")}).${beat.duration}`);
      }
    }
    barStrings.push(parts.join(" "));
  }
  // Use | only as a separator between bars (not as wrappers) so alphaTab
  // doesn't insert an empty bar 1 before the first | marker.
  lines.push(barStrings.join(" | "));

  return lines.join("\n");
}
