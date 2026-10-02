"use client";

import { trackLabels } from "@/lib/gp/trackLabel";

interface GpTrackMixerProps {
  trackNames: string[];
  /** 0-1 per track, index-aligned with trackNames. */
  levels: number[];
  muted: boolean[];
  soloed: boolean[];
  onLevelChange: (index: number, level: number) => void;
  onMuteToggle: (index: number) => void;
  onSoloToggle: (index: number) => void;
  /** True until the score has loaded; alphaTab cannot be told anything yet. */
  disabled?: boolean;
  open: boolean;
  onToggleOpen: () => void;
}

const CHANNEL =
  "px-1.5 py-0.5 text-[10px] rounded border focus:outline-none focus:border-blue-500 " +
  "disabled:opacity-40 disabled:cursor-not-allowed";

/** Any track quieter than full, muted, or soloed counts as a touched mix. */
function changedCount(levels: number[], muted: boolean[], soloed: boolean[]): number {
  return levels.reduce(
    (n, level, i) => n + ((level ?? 1) < 1 || muted[i] || soloed[i] ? 1 : 0),
    0,
  );
}

/**
 * Balance the band.
 *
 * This is the point of importing a Guitar Pro file rather than a recording:
 * turn your own part down, or off, and the rest keeps playing. Not persisted
 * — which part you silence changes with what you are working on that day.
 *
 * Folded away behind a button by default. A real file has six or more tracks
 * with names like "Kerry King | ESP Explorer | Lead Guitar - Distortion
 * Guitar", and a row of those strips took as much height as the first system
 * of music. Open, it is a channel per track so the names have room to be
 * read; the button carries a count so a mix left set is never invisible.
 *
 * Every control is labelled with its track's name. Six identical "Mute"
 * buttons would be indistinguishable to anyone navigating by name.
 */
export default function GpTrackMixer({
  trackNames,
  levels,
  muted,
  soloed,
  onLevelChange,
  onMuteToggle,
  onSoloToggle,
  disabled,
  open,
  onToggleOpen,
}: GpTrackMixerProps) {
  const changed = changedCount(levels, muted, soloed);
  // Computed across the list: a label is shortened only as far as it can go
  // while staying distinct from its neighbours.
  const labels = trackLabels(trackNames);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        aria-label="Track mixer"
        title="Balance the instruments, or mute your own part"
        className={`px-2 py-1 text-xs rounded border focus:outline-none focus:border-blue-500 ${
          open || changed > 0
            ? "bg-blue-700 border-blue-600 text-white hover:bg-blue-600"
            : "bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white"
        }`}
      >
        🎚 Mixer
        {changed > 0 && <span className="ml-1 text-blue-200">({changed})</span>}
      </button>

      {open && (
        <div
          role="group"
          aria-label="Track mixer"
          /*
            Anchored to the button's RIGHT edge so it opens inward. The
            mixer button sits well to the right of the toolbar, and a
            left-anchored panel ran straight off the side of the window,
            taking the faders and the M/S buttons with it — the names were
            all that stayed on screen.
          */
          className="absolute z-20 mt-1 right-0 w-72 max-h-96 overflow-y-auto flex flex-col gap-2 p-2 rounded bg-gray-800 border border-gray-600 shadow-xl"
        >
          {trackNames.map((name, i) => (
            /*
              Name on its own line, controls below. A real file names a track
              "Jeff Hanneman | Jackson Soloist Custom | Lead Guitar -
              Distortion Guitar"; sharing one line with a fader left so little
              room that the name truncated before saying which guitar it was,
              and the fader was squeezed to nothing.
            */
            <div key={i} className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-300 truncate" title={name}>
                {labels[i]}
              </span>
              <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round((levels[i] ?? 1) * 100)}
                disabled={disabled}
                aria-label={`${name} volume`}
                onChange={(e) => onLevelChange(i, Number(e.target.value) / 100)}
                className="flex-1 min-w-0 h-1 accent-blue-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onMuteToggle(i)}
                aria-pressed={muted[i] ?? false}
                aria-label={`Mute ${name}`}
                title={`Mute ${name}`}
                className={`${CHANNEL} shrink-0 ${
                  muted[i]
                    ? "bg-red-800 border-red-600 text-white"
                    : "bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500"
                }`}
              >
                M
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSoloToggle(i)}
                aria-pressed={soloed[i] ?? false}
                aria-label={`Solo ${name}`}
                title={`Solo ${name}`}
                className={`${CHANNEL} shrink-0 ${
                  soloed[i]
                    ? "bg-yellow-700 border-yellow-600 text-white"
                    : "bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500"
                }`}
              >
                S
              </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
