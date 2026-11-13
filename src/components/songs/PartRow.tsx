"use client";

import DraftInput from "./DraftInput";
import TakePlayer from "./TakePlayer";
import { ListenSwitch } from "./RiffMixer";
import type { PartTakes } from "./usePartTakes";
import { parsePartName } from "@/lib/songwriting/partTakes";
import { canSwitch } from "@/lib/songwriting/riffMix";
import { takeClock, takeSrc, takeWindow } from "@/lib/songwriting/riffView";
import type { OnePlayerGroup } from "@/lib/songwriting/onePlayer";
import type { RiffPart } from "@/types";

const PANEL = "bg-gray-800 border rounded-xl p-3";
const GHOST =
  "rounded-lg border border-amber-800 px-3 py-1.5 text-sm font-medium text-amber-400 hover:bg-amber-950 disabled:opacity-40 disabled:cursor-not-allowed";
const RECORD =
  "rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-100 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed";
const DANGER =
  "rounded-lg border border-red-800 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950 disabled:opacity-40 disabled:cursor-not-allowed";

export interface PartRowProps {
  part: RiffPart;
  /** Not for a riff's only part (ruling 5): delete the riff instead. */
  canDelete: boolean;
  /** This part's take is being recorded: the recorder shows in place of the take. */
  recorder: Pick<PartTakes, "stage" | "level" | "durationMs"> | null;
  /** Another part's take is being recorded or waits: Record and Trim wait too. */
  locked: boolean;
  deleting: boolean;
  /** Its take player is one of the riff's players (one plays at a time). */
  group: OnePlayerGroup;
  /** Its tab is the one shown beside the takes. */
  selected: boolean;
  /** Show its tab: anything clicked in the row does. */
  onSelect(): void;
  onRename(name: string): void;
  onRecord(): void;
  onStopRecording(): void;
  onTrim(): void;
  onListen(listen: RiffPart["listen"]): void;
  onDelete(): void;
}

/** One part of a riff: its name, its take (play, record, trim), which of take and tab is heard, and Delete. */
export default function PartRow({
  part,
  canDelete,
  recorder,
  locked,
  deleting,
  group,
  selected,
  onSelect,
  onRename,
  onRecord,
  onStopRecording,
  onTrim,
  onListen,
  onDelete,
}: PartRowProps) {
  const { trimStart, trimEnd } = takeWindow(part);

  return (
    // Capture, so it still counts when a child stops the event.
    <div
      role="group"
      aria-label={`Part: ${part.name}`}
      onPointerDownCapture={onSelect}
      className={`${PANEL} flex flex-col gap-3 ${selected ? "border-amber-600" : "border-gray-700"} ${deleting ? "opacity-50" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <DraftInput aria-label={`Name of ${part.name}`} value={part.name} parse={parsePartName} onCommit={onRename} maxLength={80} className="w-40 font-semibold" />
        {part.kind === "bass" && <span className="rounded-full bg-sky-950 px-2 py-0.5 text-[11px] text-sky-300">4-string bass</span>}
        {selected && <span className="text-xs text-amber-400">its tab is shown</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {canDelete && (
            <button type="button" onClick={onDelete} disabled={deleting} aria-label={`Delete part ${part.name}`} className={DANGER}>
              {deleting ? "Deleting…" : "Delete part"}
            </button>
          )}
        </div>
      </div>

      {recorder ? (
        <Recorder name={part.name} recorder={recorder} onStop={onStopRecording} />
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* Wide enough for the take player's speed control; on a phone the buttons wrap below it. */}
          <div className="min-w-[18rem] flex-1">
            {part.audioPath ? (
              // Its level in the mixer sets how loud it plays here too (muting is Play riff's business).
              <TakePlayer src={takeSrc(part.audioPath)} trimStart={trimStart} trimEnd={trimEnd} loop group={group} volume={part.level} />
            ) : (
              <p className="text-sm text-gray-500">No recording yet.</p>
            )}
          </div>
          <button
            type="button"
            onClick={onRecord}
            disabled={locked || deleting}
            aria-label={`Record take: ${part.name}`}
            title={part.audioPath ? "Record a new take; it replaces this one when you save it" : "Record this part while the others play"}
            className={RECORD}
          >
            <span className="text-red-500" aria-hidden>●</span> Record take
          </button>
          {part.audioPath && (
            <button type="button" onClick={onTrim} disabled={locked || deleting} aria-label={`Trim take: ${part.name}`} className={GHOST}>
              Trim
            </button>
          )}
        </div>
      )}

      {canSwitch(part) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
          Play riff plays its
          <ListenSwitch label={`${part.name}: tab or recording`} listen={part.listen} onChange={onListen} />
        </div>
      )}
    </div>
  );
}

function Recorder({ name, recorder, onStop }: { name: string; recorder: NonNullable<PartRowProps["recorder"]>; onStop(): void }) {
  const { stage, level, durationMs } = recorder;
  const clock = takeClock(durationMs / 1000);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {stage === "recording" ? (
          <>
            <span className="flex items-center gap-2" role="status" aria-label={`Recording ${name}, ${clock}`}>
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" aria-hidden />
              <span className="font-mono text-sm tabular-nums text-gray-200" aria-hidden>
                {clock}
              </span>
            </span>
            <div className="h-2 min-w-24 flex-1 overflow-hidden rounded bg-gray-700" title="Input level" aria-hidden>
              <div className="h-full bg-green-500" style={{ width: `${Math.round(level * 100)}%` }} />
            </div>
          </>
        ) : (
          <span role="status" className="text-sm text-gray-400">
            {stage === "finishing" ? "Finishing the take…" : "Opening the mic…"}
          </span>
        )}
        <button
          type="button"
          onClick={onStop}
          disabled={stage !== "recording"}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ■ Stop recording
        </button>
      </div>
      <p className="text-xs text-gray-500">The other parts play as a guide, round and round. Stop when you have it.</p>
    </div>
  );
}
