"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import PartRow from "./PartRow";
import PartTabEditor, { type HeaderChange } from "./PartTabEditor";
import RiffHeader from "./RiffHeader";
import RiffMixer from "./RiffMixer";
import TakeTrimPanel from "./TakeTrimPanel";
import { HIDDEN_PLAYER_STYLE } from "./hiddenScorePlayer";
import { RiffGoneError, deleteRiff, errorText, inRiffOrder, patchRiff } from "./riffApi";
import { useRiffMix } from "./useRiffMix";
import { useRiffParts } from "./useRiffParts";
import { useRiffTransport } from "./useRiffTransport";
import { deletePartQuestion, deleteRiffQuestion } from "@/lib/songwriting/partTakes";
import { chordName, type ProgressionChord } from "@/lib/songwriting/theory";
import { applyMixEdits } from "@/lib/songwriting/riffMix";
import { applyEdits, takeSrc } from "@/lib/songwriting/riffView";
import { listenAfterNewTake, type RiffPatch } from "@/lib/songwriting/riffs";
import { useSplitPane } from "@/lib/useSplitPane";
import type { Riff, RiffPart } from "@/types";

const LABEL = "text-[11px] uppercase tracking-wide text-gray-400";
const GHOST =
  "rounded-lg border border-amber-800 px-3 py-1.5 text-sm font-medium text-amber-400 hover:bg-amber-950 disabled:opacity-40 disabled:cursor-not-allowed";
const PLAY = "bg-amber-600 text-gray-900 font-semibold rounded-lg px-3 py-1.5 text-sm hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed";

export interface RiffDetailProps {
  riff: Riff;
  /** The part whose tab is shown (the `part` query param); the first part when it is not one of the riff's. */
  partId: string | null;
  /** A saved change came back from the server. */
  onRiffChange(riff: Riff): void;
  /** Show another part's tab. */
  onPickPart(partId: string): void;
  /** Deleted from here. */
  onDeleted(riff: Riff): void;
  /** A save found the riff gone (deleted elsewhere). */
  onGone(): void;
}

/**
 * One riff, in two halves as on the Jam Tracks view. On one, Play riff and its
 * mixer, its parts — each with its own take, recorded over the others as a
 * guide — and Delete; on the other, its header (editable), the
 * chords it was made over, and one part's tab in the editor. Side by side on
 * a wide screen (the divider drags), one above the other otherwise.
 */
export default function RiffDetail({ riff, partId, onRiffChange, onPickPart, onDeleted, onGone }: RiffDetailProps) {
  const riffId = riff.id;
  // Header edits on their way to the server, laid over the riff so a picked
  // key shows at once instead of flicking back until the save returns.
  const [edits, setEdits] = useState<{ seq: number; fields: RiffPatch }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  /** The part whose saved take is in the trim panel. */
  const [trimmingId, setTrimmingId] = useState<string | null>(null);
  const seq = useRef(0);
  /** The header's last tempo or tuning, for the tab beside it. */
  const [headerChange, setHeaderChange] = useState<HeaderChange | null>(null);
  const split = useSplitPane("riffSplit");
  const latest = useRef({ onRiffChange, onGone });
  useEffect(() => {
    latest.current = { onRiffChange, onGone };
  });

  // Bound to this riff: the form is keyed by riff, so a flush on the way out saves here.
  const save = useCallback(
    (fields: RiffPatch) => {
      const n = ++seq.current;
      setEdits((e) => [...e, { seq: n, fields }]);
      if (fields.tempo !== undefined || fields.tuning !== undefined) setHeaderChange({ seq: n, tempo: fields.tempo, tuning: fields.tuning });
      setError(null);
      void inRiffOrder(riffId, async () => {
        try {
          latest.current.onRiffChange(await patchRiff(riffId, fields));
        } catch (err) {
          if (err instanceof RiffGoneError) latest.current.onGone();
          else setError(`Could not save: ${errorText(err)}`);
        } finally {
          setEdits((e) => e.filter((x) => x.seq !== n));
        }
      });
    },
    [riffId],
  );

  // The mixer's changes (and part names), laid over the header's: the mixer and the player follow them before they are saved.
  const mix = useRiffMix(riffId, { onRiffChange, onGone });
  const shown = useMemo(
    () => applyMixEdits(applyEdits(riff, edits.map((e) => e.fields)), mix.edits),
    [riff, edits, mix.edits],
  );
  const parts = useRiffParts(riffId, { onRiffChange, onGone });

  // Play riff, the take players and a take being recorded over its guide.
  const { player, takes, players, toggleRiff, record, stopRecording, hush, silence } = useRiffTransport(shown);
  const guidePartId = takes.recordingPartId;
  const openTrim = (partId: string) => {
    hush(); // the loop check is heard alone
    setTrimmingId(partId);
  };

  const removePart = (part: RiffPart) => {
    if (!window.confirm(deletePartQuestion(part, takes.active))) return;
    silence();
    parts.remove(part);
  };

  const remove = async () => {
    if (!window.confirm(deleteRiffQuestion(shown.name, takes.active))) return;
    silence();
    setDeleting(true);
    try {
      await inRiffOrder(riffId, () => deleteRiff(riffId));
      onDeleted(shown);
    } catch (err) {
      if (err instanceof RiffGoneError) {
        onDeleted(shown);
        return;
      }
      setError(`Could not delete: ${errorText(err)}`);
      setDeleting(false);
    }
  };

  // The saved take being trimmed (closed if its part goes).
  const trimming = trimmingId ? shown.parts.find((p) => p.id === trimmingId && p.audioPath) : undefined;
  const newTake = takes.take;
  const newTakePart = newTake ? shown.parts.find((p) => p.id === newTake.partId) : undefined;
  const { saveTake, saveTrim } = parts;
  const { clear } = takes;
  const closeTrim = useCallback(() => setTrimmingId(null), []);
  // Play riff keeps the parts together by the riff's tempo: none until it is tapped.
  const noTempo = shown.tempo === null;
  const tabPart = shown.parts.find((p) => p.id === partId) ?? shown.parts[0];

  return (
    <div
      ref={split.containerRef}
      style={{ "--riff-split": `${split.split * 100}%` } as CSSProperties}
      className="flex flex-col gap-8 xl:h-full xl:flex-row xl:gap-0"
    >
      {/* The takes: Play riff, the mixer and the parts. */}
      <div className="flex min-w-0 flex-col gap-4 xl:h-full xl:w-[var(--riff-split)] xl:shrink-0 xl:overflow-y-auto xl:pr-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggleRiff}
              disabled={takes.active || noTempo || (!player.playing && !player.ready)}
              title={
                takes.active ? "A take is being recorded" : noTempo ? "Tap the riff's tempo first" : player.playing || player.ready ? undefined : "Loading the sound…"
              }
              className={PLAY}
            >
              {player.playing && !takes.active ? "■ Stop" : "▶ Play riff"}
            </button>
            {player.currentBar !== null ? (
              <span className="text-sm tabular-nums text-gray-400">
                Bar {player.currentBar + 1}
                {guidePartId && " · the guide"}
              </span>
            ) : noTempo ? (
              <span className="text-sm text-amber-400">Tap the tempo first (beside Tempo, while a take plays)</span>
            ) : !player.ready ? (
              <span className="text-sm text-gray-500">Loading the sound…</span>
            ) : null}
          </div>
          {player.error && <p role="alert" className="text-sm text-red-400">{player.error}</p>}
          {mix.error && <p role="alert" className="text-sm text-red-400">{mix.error}</p>}
          <RiffMixer riff={shown} onPartChange={mix.setPart} />
        </div>

        <div className="flex flex-col gap-2">
          <div className={LABEL}>Parts</div>
          {takes.message && <p role="alert" className="text-sm text-red-400">{takes.message}</p>}
          {parts.error && <p role="alert" className="text-sm text-red-400">{parts.error}</p>}
          {shown.parts.map((part) => (
            <PartRow
              key={part.id}
              part={part}
              canDelete={shown.parts.length > 1}
              recorder={takes.recordingPartId === part.id ? takes : null}
              locked={takes.active}
              deleting={parts.deleting.includes(part.id)}
              group={players}
              onRename={(name) => mix.setPart(part.id, { name })}
              onRecord={() => record(part.id)}
              onStopRecording={stopRecording}
              onTrim={() => openTrim(part.id)}
              selected={part.id === tabPart?.id}
              onSelect={() => {
                if (part.id !== tabPart?.id) onPickPart(part.id);
              }}
              onListen={(listen) => mix.setPart(part.id, { listen })}
              onDelete={() => removePart(part)}
            />
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => parts.add("guitar")} disabled={parts.adding} className={GHOST}>
              + Guitar part
            </button>
            <button type="button" onClick={() => parts.add("bass")} disabled={parts.adding} className={GHOST}>
              + Bass part
            </button>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={deleting}
            className="rounded-lg border border-red-800 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950 disabled:opacity-40"
          >
            {deleting ? "Deleting…" : "Delete riff"}
          </button>
        </div>
      </div>

      <div
        {...split.dividerProps}
        aria-label="Resize the takes and the tab"
        className="hidden w-1.5 shrink-0 cursor-col-resize rounded bg-transparent transition-colors hover:bg-amber-500/50 xl:block"
      />

      {/* The tab: the riff's header, its chords, and one part's tab. */}
      <div className="flex min-w-0 flex-col gap-4 xl:h-full xl:flex-1 xl:overflow-y-auto xl:pl-4">
        <RiffHeader
          riff={shown}
          onSave={save}
          status={
            error ? (
              <p role="alert" className="text-red-400">{error}</p>
            ) : edits.length > 0 ? (
              <p className="text-gray-500">Saving…</p>
            ) : null
          }
        />

        <div>
          <div className={`${LABEL} mb-1`}>Made over</div>
          {shown.progression.length === 0 ? (
            <p className="text-sm text-gray-500">No chords — it was recorded without a progression.</p>
          ) : (
            <ul className="flex flex-wrap gap-2" aria-label="Chord progression">
              {shown.progression.map((c, i) => (
                <li key={i} className="min-w-16 rounded-lg border border-gray-600 bg-gray-700 px-3 py-1.5 text-center font-semibold">
                  {chordName(c as ProgressionChord)}
                  <small className="block text-[11px] font-normal text-gray-400">
                    {c.bars} {c.bars === 1 ? "bar" : "bars"}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </div>

        {tabPart && (
          <div className="flex flex-col gap-3 xl:min-h-0 xl:flex-1">
            {shown.parts.length > 1 ? (
              <div role="group" aria-label="Which part's tab" className="flex flex-wrap items-center gap-2">
                <span className={LABEL}>Tab</span>
                {shown.parts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={p.id === tabPart.id}
                    onClick={() => p.id !== tabPart.id && onPickPart(p.id)}
                    className={`rounded-lg border px-3 py-1 text-sm ${
                      p.id === tabPart.id ? "border-amber-500 bg-amber-500/15 text-amber-300" : "border-gray-600 text-gray-300 hover:bg-gray-800"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className={LABEL}>Tab · {tabPart.name}</div>
            )}
            <PartTabEditor
              key={tabPart.id}
              riff={shown}
              part={tabPart}
              group={players}
              headerChange={headerChange}
              onRiffChange={onRiffChange}
              onGone={onGone}
            />
          </div>
        )}
      </div>

      {newTake && (
        <TakeTrimPanel
          key={`new-${newTake.partId}`}
          partName={newTakePart?.name ?? "Deleted part"}
          source={{ kind: "new", blob: newTake.blob, mimeType: newTake.mimeType, duration: newTake.duration }}
          replacesTab={!!newTakePart && listenAfterNewTake(newTakePart) === "recording"}
          note={newTake.note}
          onSave={async (trim, audioDuration) => {
            await saveTake(newTake, trim, audioDuration);
            clear();
          }}
          onClose={clear}
        />
      )}
      {trimming?.audioPath && (
        <TakeTrimPanel
          key={`saved-${trimming.id}-${trimming.audioPath}`}
          partName={trimming.name}
          source={{
            kind: "saved",
            url: takeSrc(trimming.audioPath),
            trimStart: trimming.trimStart,
            trimEnd: trimming.trimEnd,
            audioDuration: trimming.audioDuration,
          }}
          onSave={async (trim) => {
            await saveTrim(trimming.id, trim);
            closeTrim();
          }}
          onClose={closeTrim}
        />
      )}

      <div ref={player.containerRef} style={HIDDEN_PLAYER_STYLE} aria-hidden className="pointer-events-none" />
    </div>
  );
}
