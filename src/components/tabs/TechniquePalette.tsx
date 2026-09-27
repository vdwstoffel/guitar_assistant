"use client";

import { TECHNIQUE_KEYS, type Technique } from "@/lib/tabscore/commands/technique";

export interface TechniquePaletteProps {
  /**
   * Disables every button. The caller derives this from `parseTex(tex).ok`
   * and passes it down — shared with the same parse result TabEditor's
   * keyboard guard and SourcePane's diagnostics already use, rather than
   * this component calling `parseTex` again on the same text (see
   * task-14-report.md, "Performance note").
   */
  disabled: boolean;
  onSelect: (technique: Technique) => void;
}

// `technique.ts` exports the `Technique` type and `TECHNIQUE_KEYS`, but not
// an enumeration of every technique (the TOKEN table that would double as
// one isn't exported). Typing this object literal against
// `Record<Technique, true>` is the one way to enumerate a union at runtime
// that still fails to compile if a member is ever added without a matching
// entry here.
const TECHNIQUE_ORDER: Record<Technique, true> = {
  hammer: true,
  slide: true,
  palmMute: true,
  vibrato: true,
  dead: true,
  ghost: true,
  tap: true,
  harmonic: true,
  letRing: true,
  bendFull: true,
  bendHalf: true,
  bendRelease: true,
  preBend: true,
};

const TECHNIQUES = Object.keys(TECHNIQUE_ORDER) as Technique[];

const LABEL: Record<Technique, string> = {
  hammer: "Hammer-on / Pull-off",
  slide: "Slide",
  palmMute: "Palm mute",
  vibrato: "Vibrato",
  dead: "Dead note",
  ghost: "Ghost note",
  tap: "Tap",
  harmonic: "Harmonic",
  letRing: "Let ring",
  bendFull: "Bend",
  bendHalf: "Bend (half)",
  bendRelease: "Bend & release",
  preBend: "Pre-bend",
};

// TECHNIQUE_KEYS maps key -> Technique; inverted once at module scope so
// each button can look its own shortcut up in O(1). A technique with no
// keyboard shortcut (bendHalf, bendRelease, preBend — TECHNIQUE_KEYS binds
// only "b" -> bendFull for the whole bend family) just gets no suffix.
const KEY_BY_TECHNIQUE: Partial<Record<Technique, string>> = {};
for (const [key, technique] of Object.entries(TECHNIQUE_KEYS)) {
  KEY_BY_TECHNIQUE[technique] = key;
}

export default function TechniquePalette({ disabled, onSelect }: TechniquePaletteProps) {
  return (
    <div role="toolbar" aria-label="Techniques" className="flex flex-wrap items-center gap-1">
      {TECHNIQUES.map((technique) => {
        const shortcut = KEY_BY_TECHNIQUE[technique];
        const label = LABEL[technique];
        return (
          <button
            key={technique}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(technique)}
            title={shortcut ? `${label} (${shortcut})` : label}
            className="px-2 py-1 text-xs rounded bg-gray-600 border border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-600 disabled:hover:text-gray-300"
          >
            {label}
            {shortcut && <span className="ml-1 text-gray-500">{shortcut}</span>}
          </button>
        );
      })}
    </div>
  );
}
