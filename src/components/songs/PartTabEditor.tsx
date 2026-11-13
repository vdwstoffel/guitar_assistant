"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import TabEditor, { type CaretNoteInfo, type TabEditorHandle } from "@/components/tabs/TabEditor";
import HintStrip from "./HintStrip";
import { PartGoneError, RiffGoneError, inRiffOrder, patchPart, riffSettled } from "./riffApi";
import { bassTuningFor } from "@/lib/songwriting/bassTunings";
import { tabHasNotes, tabTexForPart } from "@/lib/songwriting/riffs";
import { tuningLabel } from "@/lib/songwriting/tunings";
import type { OnePlayerGroup, OnePlayerMember } from "@/lib/songwriting/onePlayer";
import type { ProgressionChord } from "@/lib/songwriting/theory";
import type { Riff, RiffPart } from "@/types";

/** A tempo or tuning just picked in the riff's header, for the tab on screen (`seq` tells one from the next). */
export interface HeaderChange {
  seq: number;
  tempo?: number;
  tuning?: string;
}

export interface PartTabEditorProps {
  riff: Riff;
  part: RiffPart;
  /** The riff's players: the tab playing pauses Play riff and the takes, and they pause it. */
  group: OnePlayerGroup;
  headerChange: HeaderChange | null;
  onRiffChange(riff: Riff): void;
  /** A save found the riff deleted. */
  onGone(): void;
}

type SavePatch = { alphatex: string; playbackSpeed: number; tempo?: number };

/** A bass part's tuning is derived from the riff's (ruling 6): never picked in its tab. */
const BASS_TUNING_LOCKED = "Bass follows the riff's tuning — change it in the riff header.";

interface PartEditorProps {
  riff: Riff;
  part: RiffPart;
  onSave(patch: SavePatch): Promise<void>;
  group: OnePlayerGroup;
  headerChange: HeaderChange | null;
  /** The notes at the caret, for the hint strip. */
  onCaretNote(info: CaretNoteInfo): void;
}

/**
 * The editor, mounted once per part: its text is worked out from the riff as
 * it stands then. Half a screen is too narrow for the source pane beside the
 * score, so it starts closed (one click away). Memoised: the hint strip beside
 * it changes with every caret move, which must not render the whole editor again.
 */
const PartEditor = memo(function PartEditor({ riff, part, onSave, group, headerChange, onCaretNote }: PartEditorProps) {
  const [initialTex] = useState(() => tabTexForPart(part, riff));
  const tab = useRef<TabEditorHandle>(null);
  const member = useRef<OnePlayerMember | null>(null);
  useEffect(() => {
    const me = group.join(() => tab.current?.pause());
    member.current = me;
    return () => {
      me.leave();
      if (member.current === me) member.current = null;
    };
  }, [group]);
  const onPlayingChange = useCallback((playing: boolean) => {
    if (playing) member.current?.started();
  }, []);

  // The header beside the tab changed the riff's tempo or tuning: the tab
  // takes it at once. Left until it next opened, the tab's next save would
  // write its old tempo back over the riff's (the tab wins, decision 19).
  // A change from before this editor opened is already in its text.
  const seen = useRef(headerChange?.seq);
  const kind = part.kind;
  useEffect(() => {
    if (!headerChange || headerChange.seq === seen.current) return;
    seen.current = headerChange.seq;
    const { tempo, tuning } = headerChange;
    tab.current?.setTempoAndTuning({ tempo, tuning: tuning !== undefined && kind === "bass" ? bassTuningFor(tuning) : tuning });
  }, [headerChange, kind]);

  return (
    <TabEditor
      key={part.id}
      ref={tab}
      initialTex={initialTex}
      initialSpeed={part.playbackSpeed}
      initialShowSource={false}
      onSave={onSave}
      onPlayingChange={onPlayingChange}
      onCaretNote={onCaretNote}
      tuningLocked={part.kind === "bass" ? BASS_TUNING_LOCKED : undefined}
    />
  );
});

/** A part's tab, beside its take: the hint strip and the tab editor, which autosaves into the part. */
export default function PartTabEditor({ riff, part, group, headerChange, onRiffChange, onGone }: PartTabEditorProps) {
  const riffId = riff.id;
  const partId = part.id;
  const latest = useRef({ onRiffChange, onGone });
  useEffect(() => {
    latest.current = { onRiffChange, onGone };
  });
  // The editor's caret, for the hint strip: its bar and the notes there.
  const [caretNote, setCaretNote] = useState<CaretNoteInfo | null>(null);

  // Saves still on their way (a header edit, the last part's unmount flush)
  // land first, so the tab opens from the riff as saved, not as it was.
  const [readyFor, setReadyFor] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void riffSettled(riffId).then(() => {
      if (live) setReadyFor(partId);
    });
    return () => {
      live = false;
    };
  }, [riffId, partId]);

  // A part's tab is saved once something is written in it. Until then (a new
  // tab, a tempo or tuning pushed into it) it stays unsaved, so the part is
  // not "tabbed" and Play riff keeps playing its take.
  const saved = useRef(!!part.alphatex?.trim());

  // Bound to this riff and part for good: the editor's unmount flush calls
  // the onSave it last saw, which must not write into whatever opens next.
  const onSave = useCallback(
    (patch: SavePatch) => {
      if (!saved.current && !tabHasNotes(patch.alphatex)) return Promise.resolve();
      saved.current = true;
      return inRiffOrder(riffId, async () => {
        try {
          const { riff: next } = await patchPart(riffId, partId, { alphatex: patch.alphatex, playbackSpeed: patch.playbackSpeed });
          latest.current.onRiffChange(next);
        } catch (err) {
          // The part deleted elsewhere: the riff as it is shows that it has gone.
          if (err instanceof PartGoneError) latest.current.onRiffChange(err.riff);
          else if (err instanceof RiffGoneError) latest.current.onGone();
          throw err;
        }
      });
    },
    [riffId, partId],
  );

  return (
    <div className="flex flex-col gap-3 xl:min-h-[30rem] xl:flex-1">
      {part.kind === "bass" && (
        <p className="text-sm text-gray-400">4-string bass in {tuningLabel(bassTuningFor(riff.tuning))}, following the riff&apos;s tuning.</p>
      )}
      <HintStrip
        progression={riff.progression as ProgressionChord[]}
        bars={Math.max(1, riff.progression.reduce((n, c) => n + c.bars, 0))}
        caretBar={caretNote?.barIndex ?? null}
        notes={caretNote?.notes ?? []}
        keyRoot={riff.keyRoot}
        scale={riff.scale}
      />
      {/* The editor fills its box: a fixed one when the halves are stacked, where the page scrolls instead. */}
      <div className="h-[75vh] xl:h-auto xl:min-h-[24rem] xl:flex-1">
        {readyFor === partId ? (
          <PartEditor key={part.id} riff={riff} part={part} onSave={onSave} group={group} headerChange={headerChange} onCaretNote={setCaretNote} />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500">Loading the tab…</div>
        )}
      </div>
    </div>
  );
}
