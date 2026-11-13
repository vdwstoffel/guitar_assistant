import { BASS_TUNING_PRESETS } from "../tabscore/commands/tuning";

// The list itself lives with the editor's guitar presets: the tab editor
// offers it to any four-string tab and reads and writes it, and tabscore
// never imports from songwriting.
export { BASS_TUNING_PRESETS };

const FALLBACK = "bass-standard";

/**
 * The bass tuning that goes with a guitar tuning (spec decision 12: E
 * standard guitar → E standard bass, C standard → C standard): the bass preset
 * whose id is the guitar's prefixed with `bass-`. Every session tuning has
 * one; anything else — an open tuning, an unknown id — gets E standard.
 */
export function bassTuningFor(guitarPresetId: string): string {
  const id = `bass-${guitarPresetId}`;
  return BASS_TUNING_PRESETS.some((p) => p.id === id) ? id : FALLBACK;
}
