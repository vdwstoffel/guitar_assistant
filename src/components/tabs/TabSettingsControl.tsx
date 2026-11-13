"use client";

import ToolbarPopover from "./ToolbarPopover";
import TempoControl from "./TempoControl";
import TuningControl from "./TuningControl";
import GuitarControl from "./GuitarControl";
import { findTuningPreset } from "@/lib/tabscore/commands/tuning";
import { GUITAR_PRESETS } from "@/lib/tabscore/commands/instrument";

interface TabSettingsControlProps {
  tempo: number | null;
  tuningId: string | null;
  /** The tab's string count: 4 offers the bass tunings. */
  strings?: number;
  guitarId: string | null;
  onTempoChange: (bpm: number) => void;
  onTuningChange: (presetId: string) => void;
  onGuitarChange: (presetId: string) => void;
  disabled?: boolean;
  /** The tuning cannot be changed here: why, and where it can be. */
  tuningLocked?: string;
}

/**
 * The settings written into the tab itself — tempo, tuning and guitar. Each
 * is set once and then left, so they share one button, whose face doubles as
 * a summary of all three: what the tab is in stays readable at a glance
 * without the controls taking a third of the toolbar.
 */
export default function TabSettingsControl({
  tempo,
  tuningId,
  strings,
  guitarId,
  onTempoChange,
  onTuningChange,
  onGuitarChange,
  disabled = false,
  tuningLocked,
}: TabSettingsControlProps) {
  const tuning = findTuningPreset(tuningId)?.label ?? "Custom tuning";
  const guitar = GUITAR_PRESETS.find((p) => p.id === guitarId)?.label ?? "Other instrument";

  return (
    <ToolbarPopover
      label={`♩${tempo ?? "–"} · ${tuning} · ${guitar}`}
      title="Tempo, tuning and guitar — written into this tab"
      ariaLabel="Tab settings"
      disabled={disabled}
    >
      <TempoControl tempo={tempo} onChange={onTempoChange} disabled={disabled} />
      <TuningControl tuningId={tuningId} strings={strings} onChange={onTuningChange} disabled={disabled || !!tuningLocked} />
      {tuningLocked && <p className="max-w-56 text-[11px] text-amber-400">{tuningLocked}</p>}
      <GuitarControl guitarId={guitarId} onChange={onGuitarChange} disabled={disabled} />
      <p className="text-[11px] text-gray-400">Saved with this tab, and undoable.</p>
    </ToolbarPopover>
  );
}
