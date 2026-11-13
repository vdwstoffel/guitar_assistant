"use client";

import { canSwitch, heardAs, mixGains, type PartMix } from "@/lib/songwriting/riffMix";
import type { Riff, RiffPart } from "@/types";

const PANEL = "bg-gray-800 border border-gray-700 rounded-xl p-3";
const LABEL = "text-[11px] uppercase tracking-wide text-gray-400";
const CHANNEL = "w-8 h-8 shrink-0 rounded-lg border text-xs font-semibold";
const OFF = "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600";
const SLIDER = "min-w-24 flex-1 h-1 accent-amber-500 cursor-pointer";
/** Fixed widths, so the sliders line up row under row. */
const NAME = "w-24 shrink-0 truncate font-medium";
const SOURCE = "w-40 shrink-0";

export interface RiffMixerProps {
  /** The riff as shown, unsaved mixer changes included. */
  riff: Riff;
  onPartChange(partId: string, fields: PartMix): void;
}

/** Level, mute and solo for each part, and whether a part with a tab and a take plays the tab or the take. */
export default function RiffMixer({ riff, onPartChange }: RiffMixerProps) {
  const gains = mixGains(riff);

  return (
    <div className={`${PANEL} flex flex-col gap-2`}>
      <div className={LABEL}>Mixer</div>
      <ul className="flex flex-col gap-2" aria-label="Mixer">
        {riff.parts.map((part) => (
          <PartChannel
            key={part.id}
            part={part}
            heard={heardAs(part) !== null && (gains.parts[part.id] ?? 0) > 0}
            onChange={(fields) => onPartChange(part.id, fields)}
          />
        ))}
      </ul>
    </div>
  );
}

function PartChannel({ part, heard, onChange }: { part: RiffPart; heard: boolean; onChange(fields: PartMix): void }) {
  const source = heardAs(part);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className={`${NAME} ${heard ? "" : "text-gray-500"}`} title={part.name}>
        {part.name}
      </span>
      <div className={SOURCE}>
        {canSwitch(part) ? (
          <ListenSwitch label={`${part.name} plays`} listen={part.listen} onChange={(listen) => onChange({ listen })} />
        ) : (
          <span className="text-xs text-gray-400">
            {source === "tab" ? "Tab" : source === "recording" ? "Recording" : "Nothing to play yet"}
          </span>
        )}
      </div>
      <Level name={part.name} value={part.level} onChange={(level) => onChange({ level })} />
      <button
        type="button"
        onClick={() => onChange({ muted: !part.muted })}
        aria-pressed={part.muted}
        aria-label={`Mute ${part.name}`}
        title={`Mute ${part.name}`}
        className={`${CHANNEL} ${part.muted ? "bg-red-800 border-red-600 text-white" : OFF}`}
      >
        M
      </button>
      <button
        type="button"
        onClick={() => onChange({ soloed: !part.soloed })}
        aria-pressed={part.soloed}
        aria-label={`Solo ${part.name}`}
        title={`Solo ${part.name}`}
        className={`${CHANNEL} ${part.soloed ? "bg-amber-600 border-amber-500 text-gray-900" : OFF}`}
      >
        S
      </button>
    </li>
  );
}

function Level({ name, value, onChange }: { name: string; value: number; onChange(level: number): void }) {
  const percent = Math.round(value * 100);
  return (
    <>
      <input
        type="range"
        min={0}
        max={100}
        value={percent}
        aria-label={`${name} level`}
        aria-valuetext={`${percent}%`}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className={SLIDER}
      />
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-gray-400" aria-hidden>
        {percent}%
      </span>
    </>
  );
}

/** Whether a part with a tab and a take is heard as the tab or the take: in the mixer and in the part's row. */
export function ListenSwitch({
  label,
  listen,
  onChange,
}: {
  label: string;
  listen: RiffPart["listen"];
  onChange(listen: RiffPart["listen"]): void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-lg border border-gray-600 text-xs">
      {(["tab", "recording"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={listen === option}
          onClick={() => listen !== option && onChange(option)}
          className={`px-2 py-1 ${listen === option ? "bg-amber-600 text-gray-900 font-semibold" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
        >
          {option === "tab" ? "Tab" : "Recording"}
        </button>
      ))}
    </div>
  );
}
