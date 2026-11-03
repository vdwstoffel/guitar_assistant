"use client";

import ToolbarPopover from "./ToolbarPopover";
import TempoControl from "./TempoControl";
import TuningControl from "./TuningControl";
import GuitarControl from "./GuitarControl";
import { TUNING_PRESETS } from "@/lib/tabscore/commands/tuning";
import { GUITAR_PRESETS } from "@/lib/tabscore/commands/instrument";

interface TabSettingsControlProps {
  tempo: number | null;
  tuningId: string | null;
  guitarId: string | null;
  onTempoChange: (bpm: number) => void;
  onTuningChange: (presetId: string) => void;
  onGuitarChange: (presetId: string) => void;
  disabled?: boolean;
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
  guitarId,
  onTempoChange,
  onTuningChange,
  onGuitarChange,
  disabled = false,
}: TabSettingsControlProps) {
  const tuning = TUNING_PRESETS.find((p) => p.id === tuningId)?.label ?? "Custom tuning";
  const guitar = GUITAR_PRESETS.find((p) => p.id === guitarId)?.label ?? "Other instrument";

  return (
    <ToolbarPopover
      label={`♩${tempo ?? "–"} · ${tuning} · ${guitar}`}
      title="Tempo, tuning and guitar — written into this tab"
      ariaLabel="Tab settings"
      disabled={disabled}
    >
      <TempoControl tempo={tempo} onChange={onTempoChange} disabled={disabled} />
      <TuningControl tuningId={tuningId} onChange={onTuningChange} disabled={disabled} />
      <GuitarControl guitarId={guitarId} onChange={onGuitarChange} disabled={disabled} />
      <p className="text-[11px] text-gray-400">Saved with this tab, and undoable.</p>
    </ToolbarPopover>
  );
}
