"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePartTakes, type PartTakes } from "./usePartTakes";
import { useRiffPlayer, type RiffPlayer } from "./useRiffPlayer";
import { createOnePlayerGroup, type OnePlayerGroup, type OnePlayerMember } from "@/lib/songwriting/onePlayer";
import { guideRiff } from "@/lib/songwriting/partTakes";
import type { Riff } from "@/types";

export interface RiffTransport {
  player: RiffPlayer;
  takes: PartTakes;
  /** The parts' take players join this: starting one stops Play riff (never the guide). */
  players: OnePlayerGroup;
  /** Play riff / Stop. */
  toggleRiff(): void;
  /** Record a take for a part; the guide starts once the mic is recording. */
  record(partId: string): void;
  /** Stop recording (the take goes to the trim panel) and the guide. */
  stopRecording(): void;
  /** Stop Play riff and pause every take player (before the loop check, say). */
  hush(): void;
  /** Before a delete: the take being recorded is dropped, and nothing plays on. */
  silence(): void;
}

/**
 * Play riff, the parts' take players and recording a take, in one riff detail:
 * one sounds at a time. One take is recorded at a time; while it is, the riff
 * player is its guide — the riff without that part (`guideRiff`), looping —
 * from when the mic is recording until Stop. The detail is keyed by riff, so
 * leaving it unmounts the player and the recorder, which stops both.
 */
export function useRiffTransport(riff: Riff): RiffTransport {
  const takes = usePartTakes();
  const guidePartId = takes.recordingPartId;
  const heard = useMemo(() => (guidePartId ? guideRiff(riff, guidePartId) : riff), [riff, guidePartId]);
  const sections = useMemo(() => [{ riff: heard, repeats: 1 }], [heard]);
  const player = useRiffPlayer({ sections, loop: true });
  const { play, stop, ready } = player;

  const [players] = useState(createOnePlayerGroup);
  const member = useRef<OnePlayerMember | null>(null);
  const guiding = useRef(false);
  useEffect(() => {
    // A take player started while recording would be recorded either way: the guide plays on.
    const me = players.join(() => {
      if (!guiding.current) stop();
    });
    member.current = me;
    return () => {
      me.leave();
      if (member.current === me) member.current = null;
    };
  }, [players, stop]);

  // The guide starts once the mic is recording (and the sound has loaded), and stops with it.
  // Before the riff has a tempo there is nothing to keep a guide in time: the take records alone.
  const wantGuide = takes.stage === "recording" && riff.tempo !== null;
  useEffect(() => {
    if (wantGuide && ready && !guiding.current) {
      guiding.current = true;
      member.current?.started();
      play();
    } else if (!wantGuide && guiding.current) {
      guiding.current = false;
      stop();
    }
  }, [wantGuide, ready, play, stop]);

  const hush = () => {
    member.current?.started();
    guiding.current = false;
    stop();
  };
  return {
    player,
    takes,
    players,
    toggleRiff: () => {
      if (player.playing) {
        stop();
        return;
      }
      member.current?.started();
      play();
    },
    record: (partId) => {
      hush();
      takes.record(partId);
    },
    stopRecording: () => {
      guiding.current = false;
      stop();
      takes.stop();
    },
    hush,
    silence: () => {
      takes.clear();
      hush();
    },
  };
}
