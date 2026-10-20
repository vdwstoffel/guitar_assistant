/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab's AST types are untyped through this interop boundary (same
 * convention as parse.ts).
 */

/**
 * Guard against the blank-canvas crash for tab-only rendering.
 *
 * AlphaTex written without a `\tuning` line imports with an EMPTY staff
 * tuning (alphaTab only auto-fills it when a note names a string, e.g.
 * `3.6`). The tab renderer refuses such staves — its factory's canCreate
 * requires `staff.tuning.length > 0` — so no render staff is created and
 * the layout then crashes on `group.staves[0]` with:
 *   Cannot read properties of undefined (reading 'staves')
 * The editor forces tab-only rendering (showStandardNotation=false), which
 * removes the standard-notation renderer that otherwise saves such a score,
 * so every hand-typed tab without a tuning line blanks the canvas.
 *
 * This fills the gap the way alphaTab's own importer would have: a default
 * standard tuning for the staff, and — for bare-pitch notes (`e3`, which
 * import with string/fret -1 but a real `realValue` MIDI pitch) — the
 * nearest string/fret placement on that tuning. Without the second half the
 * tab renderer survives staffing but dies later in collectSpaces indexing
 * `tuning.length - note.string` (verified against 1.8.1: tuning alone still
 * crashes, notes resolved too renders clean).
 */

/** Frets allowed when placing a bare pitch on a string; past this the
 *  placement is unplayable-ish and we leave the note alone. */
const MAX_FRET = 22;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function ensureRenderableTuning(alphaTab: any, score: any): void {
  for (const track of score?.tracks ?? []) {
    if (track?.isPercussion) continue;
    const staveCount = clamp(
      Number(track?.staves?.[0]?.stringTuning?.staveCount) || 6,
      4,
      8,
    );
    for (const staff of track?.staves ?? []) {
      if (!staff || staff.isPercussion) continue;
      const existing = staff.stringTuning?.tunings;
      if (Array.isArray(existing) && existing.length > 0) continue;

      // Scan the notes first: a stringed staff whose notes all fit, say, a
      // bass range is better served by the 4-string default than 6.
      const pitches: number[] = [];
      for (const bar of staff.bars ?? []) {
        for (const voice of bar.voices ?? []) {
          for (const beat of voice.beats ?? []) {
            for (const note of beat.notes ?? []) {
              if (note.string > 0 && note.fret >= 0) continue; // already on a string
              if (Number.isFinite(note.realValue)) pitches.push(note.realValue);
            }
          }
        }
      }

      // Pick the string count whose default tuning places every bare pitch
      // within 0..MAX_FRET; fall back to the track's staveCount, else 6.
      let tuning: any = null;
      const candidates = [staveCount, 6, 7, 5, 4, 8];
      for (const sc of candidates) {
        const preset = alphaTab.model.Tuning?.getDefaultTuningFor(sc);
        if (!preset?.tunings?.length) continue;
        const fits = pitches.every((p) =>
          preset.tunings.some((open: number) => p >= open && p - open <= MAX_FRET),
        );
        if (fits) {
          tuning = preset;
          break;
        }
      }
      if (!tuning) tuning = alphaTab.model.Tuning.getDefaultTuningFor(6);
      if (!tuning) continue; // no preset at all: nothing sensible to do

      staff.stringTuning = tuning;

      const openStrings: number[] = tuning.tunings; // string 1 = highest pitch, per index
      for (const bar of staff.bars ?? []) {
        for (const voice of bar.voices ?? []) {
          for (const beat of voice.beats ?? []) {
            for (const note of beat.notes ?? []) {
              if (note.string > 0 && note.fret >= 0) continue; // already placed
              if (!Number.isFinite(note.realValue)) continue;
              let best: { string: number; fret: number } | null = null;
              for (let s = 1; s <= openStrings.length; s++) {
                const fret = note.realValue - openStrings[s - 1];
                if (fret >= 0 && fret <= MAX_FRET && (!best || fret < best.fret)) {
                  best = { string: s, fret };
                }
              }
              if (best) {
                note.string = best.string;
                note.fret = best.fret;
              }
            }
          }
        }
      }
    }
  }
}
