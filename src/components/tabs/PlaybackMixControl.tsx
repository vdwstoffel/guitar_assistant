"use client";

interface PlaybackMixControlProps {
  /** Score playback volume, 0-1. */
  volume: number;
  onVolumeChange: (volume: number) => void;
  /** Metronome click volume, 0-1. Zero means off. */
  metronome: number;
  metronomeOn: boolean;
  onMetronomeToggle: () => void;
  onMetronomeChange: (volume: number) => void;
  /** Tick out a bar before playback starts. */
  countIn: boolean;
  onCountInToggle: () => void;
}

const TOGGLE =
  "px-2 py-1 text-xs rounded border focus:outline-none focus:border-blue-500";
const TOGGLE_ON = "bg-green-700 border-green-600 text-white hover:bg-green-600";
const TOGGLE_OFF =
  "bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white";

const SLIDER =
  "w-16 h-1 accent-blue-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

/**
 * The two things you balance while practising a tab: how loud the notes are
 * and how loud the click is.
 *
 * Both are alphaTab's own 0-1 volumes rather than the 10-200% practice speed
 * beside them. alphaTab has no separate metronome enable — a volume of zero
 * IS off — so the toggle writes zero and restores the last audible level,
 * which is why the slider keeps its position while muted. The count-in works
 * the same way and shares the one level, since it is the same click; a third
 * slider would earn its place only if anyone wanted them at different
 * volumes.
 */
export default function PlaybackMixControl({
  volume,
  onVolumeChange,
  metronome,
  metronomeOn,
  onMetronomeToggle,
  onMetronomeChange,
  countIn,
  onCountInToggle,
}: PlaybackMixControlProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1" title="Playback volume of the tab">
        <span className="text-gray-400 text-xs select-none" aria-hidden>🔊</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          aria-label="Tab volume"
          onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
          className={SLIDER}
        />
      </label>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onMetronomeToggle}
          aria-pressed={metronomeOn}
          // "Metronome" alone collides with the global nav's own Metronome
          // button — two identically named buttons on one page.
          aria-label="Metronome click"
          title={metronomeOn ? "Turn the metronome off" : "Turn the metronome on"}
          className={`${TOGGLE} ${metronomeOn ? TOGGLE_ON : TOGGLE_OFF}`}
        >
          ♩ Click
        </button>
        <button
          type="button"
          onClick={onCountInToggle}
          aria-pressed={countIn}
          aria-label="Count-in"
          title={
            countIn
              ? "Stop counting a bar in before playback"
              : "Count a bar in before playback starts"
          }
          className={`${TOGGLE} ${countIn ? TOGGLE_ON : TOGGLE_OFF}`}
        >
          ⏱ Count-in
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(metronome * 100)}
          disabled={!metronomeOn && !countIn}
          aria-label="Metronome click volume"
          title="How loud the click and the count-in are"
          onChange={(e) => onMetronomeChange(Number(e.target.value) / 100)}
          className={SLIDER}
        />
      </div>
    </div>
  );
}
