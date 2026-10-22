"use client";

import { SOUND_BANKS } from "@/lib/soundBank";

interface SoundBankControlProps {
  /** The id of the bank the player is sounding with. */
  bankId: string;
  onChange: (bankId: string) => void;
}

/**
 * Which SoundFont file the playback synth sounds with. A playback preference
 * only — like the volume beside it, never written into the tab: the notes on
 * screen are the same whichever bank is picked, and this is a practice aid for
 * hearing them, not an instrument choice.
 *
 * The bank loads asynchronously; while a larger one is still arriving the
 * player keeps sounding with the previous one.
 */
export default function SoundBankControl({ bankId, onChange }: SoundBankControlProps) {
  const current = SOUND_BANKS.find((bank) => bank.id === bankId) ?? SOUND_BANKS[0];

  return (
    <label className="flex items-center gap-1" title={current.description}>
      <span className="text-gray-400 text-xs select-none">Sound</span>
      <select
        value={current.id}
        aria-label="Sound bank"
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-700 text-gray-200 text-xs rounded px-1 py-1 border border-gray-600 focus:outline-none focus:border-blue-500"
      >
        {SOUND_BANKS.map((bank) => (
          <option key={bank.id} value={bank.id}>
            {bank.label}
          </option>
        ))}
      </select>
    </label>
  );
}
