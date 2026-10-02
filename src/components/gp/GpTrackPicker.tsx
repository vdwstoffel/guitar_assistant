"use client";

import { trackLabels } from "@/lib/gp/trackLabel";

interface GpTrackPickerProps {
  trackNames: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
  disabled?: boolean;
}

/**
 * Which part is drawn. Every track keeps sounding whichever is chosen —
 * this changes the page, not the mix.
 *
 * A dropdown rather than a row of tabs: a real Guitar Pro file names its
 * tracks things like "Jeff Hanneman | Jackson Soloist Custom | Lead Guitar -
 * Distortion Guitar", and six of those wrapped to two full rows of buttons
 * before the score even started.
 */
export default function GpTrackPicker({
  trackNames,
  activeIndex,
  onSelect,
  disabled,
}: GpTrackPickerProps) {
  const labels = trackLabels(trackNames);
  return (
    <label className="flex items-center gap-1 min-w-0">
      <span className="text-gray-400 text-xs select-none shrink-0">Part</span>
      <select
        value={activeIndex}
        disabled={disabled}
        aria-label="Instrument"
        title={trackNames[activeIndex] ?? ""}
        onChange={(e) => onSelect(Number(e.target.value))}
        className="max-w-64 bg-gray-700 text-gray-200 text-xs rounded px-1 py-1 border border-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {trackNames.map((name, i) => (
          <option key={i} value={i} title={name}>
            {labels[i]}
          </option>
        ))}
      </select>
    </label>
  );
}
