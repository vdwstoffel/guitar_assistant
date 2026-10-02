/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab's api and model types are only reachable through namespaces that
 * cannot be imported as types across the bundle boundary. These `any`s are
 * the interop boundary with that untyped surface, not unexamined typing.
 */
"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { GpSong } from "@/types";
import { useAlphaTabPlayback, SCORE_SURFACE_CSS } from "./useAlphaTabPlayback";
import GpTrackPicker from "./GpTrackPicker";
import GpSectionsPanel from "./GpSectionsPanel";
import GpTrackMixer from "./GpTrackMixer";
import { gpFileUrl } from "@/lib/gp/fileUrl";
import type { BarRange } from "./useAlphaTabPlayback";
import type { GpSongSection } from "@/types";
import PlaybackSpeedControl from "@/components/PlaybackSpeedControl";
import PlaybackMixControl from "@/components/tabs/PlaybackMixControl";
import { clampPlaybackSpeed } from "@/lib/playbackSpeed";
import { claimGlobalShortcuts } from "@/lib/globalShortcuts";
import {
  subscribeMix, getMix, getServerMix, setMix,
  metronomeVolumeOf, countInVolumeOf, type MixPrefs,
} from "@/lib/tabscore/mixPrefs";

export interface GpSongPlayerProps {
  song: GpSong;
  /** Persist a change to the song row (track choice, speed, practice state). */
  onUpdate: (patch: Partial<GpSong>) => void;
}

/**
 * Practise against a Guitar Pro file.
 *
 * The file plays itself: alphaTab synthesises every instrument in it, so
 * there is no audio recording and nothing to keep in sync. One part is drawn
 * at a time for readability while all of them stay audible — the point being
 * that the rest of the band carries on while you play yours.
 *
 * Read-only by design. Editing is the tab editor's job, and the two share
 * their playback through `useAlphaTabPlayback` rather than a second copy.
 */
export default function GpSongPlayer({ song, onUpdate }: GpSongPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [trackIndex, setTrackIndex] = useState(() =>
    Math.min(Math.max(song.lastTrackIndex, 0), Math.max(song.trackNames.length - 1, 0)),
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [looping, setLooping] = useState(false);
  const [speed, setSpeed] = useState(() => clampPlaybackSpeed(song.playbackSpeed));

  // The same listening preferences as the tab editor: wanting the click on
  // does not change between one surface and the other.
  const mix = useSyncExternalStore(subscribeMix, getMix, getServerMix);
  const updateMix = useCallback((patch: Partial<MixPrefs>) => {
    setMix({ ...getMix(), ...patch });
  }, []);

  // The mix resets to all-audible on open: which part you silence changes
  // with what you are working on, so there is nothing worth persisting.
  // Open state is remembered: someone who works with the mixer open wants it
  // open next time, and someone who never touches it should never see it.
  const [mixerOpen, setMixerOpen] = useState(false);
  useEffect(() => {
    try {
      setMixerOpen(localStorage.getItem("gpMixerOpen") === "1");
    } catch {
      /* the default is fine */
    }
  }, []);
  const toggleMixer = useCallback(() => {
    setMixerOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("gpMixerOpen", next ? "1" : "0");
      } catch {
        /* the choice just will not survive a reload */
      }
      return next;
    });
  }, []);

  const [levels, setLevels] = useState<number[]>(() => song.trackNames.map(() => 1));
  const [muted, setMuted] = useState<boolean[]>(() => song.trackNames.map(() => false));
  const [soloed, setSoloed] = useState<boolean[]>(() => song.trackNames.map(() => false));

  // Read by the scoreLoaded handler, which was created before these existed.
  const mixRef = useRef({ levels, muted, soloed });
  useEffect(() => {
    mixRef.current = { levels, muted, soloed };
  });

  const trackAt = useCallback((index: number) => apiRef.current?.score?.tracks?.[index] ?? null, []);

  const setLevel = useCallback(
    (index: number, level: number) => {
      setLevels((prev) => prev.map((v, i) => (i === index ? level : v)));
      const track = trackAt(index);
      if (track) {
        try {
          apiRef.current.changeTrackVolume([track], level);
        } catch {
          /* ignore */
        }
      }
    },
    [trackAt],
  );

  const toggleMute = useCallback(
    (index: number) => {
      setMuted((prev) => {
        const next = prev.map((v, i) => (i === index ? !v : v));
        const track = trackAt(index);
        if (track) {
          try {
            apiRef.current.changeTrackMute([track], next[index]);
          } catch {
            /* ignore */
          }
        }
        return next;
      });
    },
    [trackAt],
  );

  const toggleSolo = useCallback(
    (index: number) => {
      setSoloed((prev) => {
        const next = prev.map((v, i) => (i === index ? !v : v));
        const track = trackAt(index);
        if (track) {
          try {
            apiRef.current.changeTrackSolo([track], next[index]);
          } catch {
            /* ignore */
          }
        }
        return next;
      });
    },
    [trackAt],
  );

  const [sections, setSections] = useState<GpSongSection[]>(song.sections);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [draggedRange, setDraggedRange] = useState<BarRange | null>(null);

  const playback = useAlphaTabPlayback({
    speed,
    looping,
    volume: mix.volume,
    metronomeVolume: metronomeVolumeOf(mix),
    countInVolume: countInVolumeOf(mix),
    onLoopChange: (range) => {
      setDraggedRange(range);
      // A fresh drag replaces whichever saved section was looping.
      if (range) setActiveSectionId(null);
    },
  });

  const playSection = useCallback(
    (section: GpSongSection) => {
      setActiveSectionId(section.id);
      setDraggedRange(null);
      setLooping(true);
      playback.applyLoop({ startBar: section.startBar, endBar: section.endBar });
    },
    [playback],
  );

  const saveSection = useCallback(
    async (name: string) => {
      if (!draggedRange) return;
      const res = await fetch(`/api/gpsongs/${song.id}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...draggedRange }),
      });
      if (!res.ok) return;
      const created: GpSongSection = await res.json();
      setSections((prev) => [...prev, created]);
      setDraggedRange(null);
      setActiveSectionId(created.id);
    },
    [draggedRange, song.id],
  );

  const renameSection = useCallback(
    async (id: string, name: string) => {
      if (!name.trim()) return;
      setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name: name.trim() } : s)));
      await fetch(`/api/gpsongs/${song.id}/sections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      }).catch(() => {});
    },
    [song.id],
  );

  const deleteSection = useCallback(
    async (id: string) => {
      setSections((prev) => prev.filter((s) => s.id !== id));
      if (activeSectionId === id) {
        setActiveSectionId(null);
        playback.clearLoop();
      }
      await fetch(`/api/gpsongs/${song.id}/sections/${id}`, { method: "DELETE" }).catch(() => {});
    },
    [song.id, activeSectionId, playback],
  );

  const handlePlayPause = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    try {
      if (isPlaying) api.pause();
      else api.play();
    } catch {
      /* ignore */
    }
  }, [isPlaying]);

  const handleSpeedChange = useCallback(
    (next: number) => {
      setSpeed(next);
      onUpdate({ playbackSpeed: next });
    },
    [onUpdate],
  );

  // Record that this song was practised.
  //
  // Not usePracticeSessionTracker: its PlayedRef has slots for a track, jam
  // track, book video and video, and adding a fifth means reshaping
  // TrackableItem, playedRefForItem, PlayedRef and the metrics route — four
  // files of shared plumbing for one column. Same four-second threshold as
  // that hook, kept local.
  const markedPlayedRef = useRef(false);
  useEffect(() => {
    if (!isPlaying) return;
    if (markedPlayedRef.current) return;
    const timer = setTimeout(() => {
      markedPlayedRef.current = true;
      onUpdate({ lastPlayedAt: new Date().toISOString() });
    }, 4000);
    return () => clearTimeout(timer);
  }, [isPlaying, onUpdate]);

  // While this player is open it owns the window-level shortcuts that
  // BottomPlayer binds — Space above all, which would otherwise start an
  // audio jam track playing behind it.
  useEffect(() => claimGlobalShortcuts(), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      const el = event.target as HTMLElement | null;
      if (el?.closest("input, textarea, [contenteditable]")) return;
      event.preventDefault();
      handlePlayPause();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // Names come from the row so the picker can render before the file has
  // loaded. A corrupt trackNames column leaves it empty, so fall back to
  // numbered parts rather than showing nothing.
  const trackNames =
    song.trackNames.length > 0
      ? song.trackNames
      : Array.from({ length: 1 }, (_, i) => `Track ${i + 1}`);

  const selectTrack = useCallback(
    (index: number) => {
      setTrackIndex(index);
      onUpdate({ lastTrackIndex: index });
      const api = apiRef.current;
      const track = api?.score?.tracks?.[index];
      if (track) {
        try {
          api.renderTracks([track]);
        } catch {
          /* ignore — a re-render will follow anyway */
        }
      }
    },
    [onUpdate],
  );

  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;
    let destroyed = false;
    let detachPlayback: (() => void) | null = null;

    const init = async () => {
      try {
        setError(null);
        setReady(false);
        const alphaTab = await import("@coderline/alphatab");
        const { AlphaTabApi, Settings, Environment } = alphaTab;
        if (destroyed || !containerRef.current) return;

        // Worker/worklet URLs must be explicit — alphaTab otherwise
        // auto-detects from import.meta.url, which points at the bundled
        // chunk and breaks.
        if (!Environment.isRunningInWorker) {
          Environment.initializeMain(
            () => new Worker("/alphaTab.worker.mjs", { type: "module" }),
            (ctx: AudioContext) => ctx.audioWorklet.addModule("/alphaTab.worklet.mjs"),
          );
        }

        const settings = new Settings();
        settings.core.fontDirectory = "/font/";
        // No `core.tex`: this loads Guitar Pro bytes, not AlphaTex.
        settings.player.playerMode = alphaTab.PlayerMode.EnabledSynthesizer;
        settings.player.soundFont = "/soundfont/sonivox.sf2";
        settings.player.enableCursor = true;

        const api = new AlphaTabApi(containerRef.current, settings);
        apiRef.current = api;
        detachPlayback = playback.attach(api, alphaTab);

        api.playerStateChanged.on((e: any) => {
          if (!destroyed) setIsPlaying(e.state === 1); // synth.PlayerState.Playing
        });

        // alphaTab reports far more than "cannot read this file" here — a
        // failed soundfont fetch and any caught render exception come through
        // the same channel. Replacing the score with the message would throw
        // away notation you were reading, with no way back short of
        // reselecting the song, so once it has drawn the error becomes a
        // banner beneath it instead. ScoreCanvas does the same.
        api.error.on((e: any) => {
          if (destroyed) return;
          const inner = e?.error || e?.innerError;
          setError(inner?.message || e?.message || "alphaTab could not read this file");
        });

        // Draw one part only. Done on scoreLoaded rather than after load()
        // resolves, because the tracks do not exist until then.
        api.scoreLoaded.on((score: any) => {
          if (destroyed) return;
          const index = Math.min(Math.max(trackIndex, 0), (score.tracks?.length ?? 1) - 1);
          const track = score.tracks?.[index];
          if (track) {
            try {
              api.renderTracks([track]);
            } catch {
              /* the default render stands */
            }
          }
          // Push whatever the mixer is already holding. Its state can be
          // changed before the score exists, and without this the buttons
          // would sit lit while the part played at full volume.
          try {
            (score.tracks ?? []).forEach((t: any, i: number) => {
              api.changeTrackVolume([t], mixRef.current.levels[i] ?? 1);
              api.changeTrackMute([t], mixRef.current.muted[i] ?? false);
              api.changeTrackSolo([t], mixRef.current.soloed[i] ?? false);
            });
          } catch {
            /* ignore */
          }
          setReady(true);
        });

        const response = await fetch(gpFileUrl(song.filePath));
        if (!response.ok) {
          // The row outlived its file. Say so and stay mounted, so the song
          // can still be deleted — do not retry in a loop.
          throw new Error(
            response.status === 404
              ? "This song's file is missing from disk."
              : `Could not load this song (${response.status}).`,
          );
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (destroyed) return;
        api.load(bytes);
      } catch (err) {
        if (!destroyed) {
          setError(err instanceof Error ? err.message : "Could not open this song");
        }
      }
    };

    init();

    return () => {
      destroyed = true;
      detachPlayback?.();
      detachPlayback = null;
      try {
        apiRef.current?.stop();
        apiRef.current?.destroy();
      } catch {
        /* ignore */
      }
      apiRef.current = null;
    };
    // Re-initialises only when the file changes; the track choice is applied
    // through renderTracks, not by rebuilding alphaTab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.filePath, playback]);

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      <style jsx global>{`
        .gp-song-host {
          ${SCORE_SURFACE_CSS}
        }
      `}</style>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <button
          type="button"
          disabled={!ready}
          onClick={handlePlayPause}
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="px-2 py-1 text-xs rounded bg-gray-600 border border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPlaying ? "⏸ Pause" : "▶ Play"}
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            try {
              apiRef.current?.stop();
            } catch {
              /* ignore */
            }
          }}
          aria-label="Stop"
          className="px-2 py-1 text-xs rounded bg-gray-600 border border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ⏹ Stop
        </button>
        <button
          type="button"
          onClick={() => setLooping((prev) => !prev)}
          aria-label="Repeat"
          aria-pressed={looping}
          className={`px-2 py-1 text-xs rounded border focus:outline-none focus:border-blue-500 ${
            looping
              ? "bg-green-700 border-green-600 text-white hover:bg-green-600"
              : "bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white"
          }`}
        >
          ⟳ Repeat
        </button>
        <PlaybackSpeedControl speed={speed} onChange={handleSpeedChange} />
        <PlaybackMixControl
          volume={mix.volume}
          onVolumeChange={(volume) => updateMix({ volume })}
          metronome={mix.metronome}
          metronomeOn={mix.metronomeOn}
          onMetronomeToggle={() => updateMix({ metronomeOn: !mix.metronomeOn })}
          onMetronomeChange={(metronome) => updateMix({ metronome: Math.max(0.05, metronome) })}
          countIn={mix.countIn}
          onCountInToggle={() => updateMix({ countIn: !mix.countIn })}
        />
        <GpTrackPicker
          trackNames={trackNames}
          activeIndex={trackIndex}
          onSelect={selectTrack}
          disabled={!ready}
        />
        <GpTrackMixer
          disabled={!ready}
          open={mixerOpen}
          onToggleOpen={toggleMixer}
          trackNames={trackNames}
          levels={levels}
          muted={muted}
          soloed={soloed}
          onLevelChange={setLevel}
          onMuteToggle={toggleMute}
          onSoloToggle={toggleSolo}
        />
        <span className="text-xs text-gray-400">
          {song.artist ? `${song.artist} · ` : ""}
          {song.barCount} bars
          {song.tempo ? ` · ${song.tempo} BPM` : ""}
        </span>
      </div>

      <div className="flex-1 min-h-0 flex gap-2">
        <div className="relative flex-1 min-w-0 overflow-auto bg-gray-600 rounded border border-gray-500">
          {/*
            The host always stays mounted AND always laid out. Unmounting it
            on an error would take alphaTab's canvas with it, so an error
            raised after the score drew would wipe readable notation — but
            hiding it with `display: none` was worse: alphaTab measured a
            zero-width container, laid out into nothing, and the score never
            appeared at all until a track switch forced a re-render. Anything
            shown over it is positioned absolutely for the same reason.
          */}
          <div className="gp-song-host relative">
            <div ref={containerRef} className="w-full" />
          </div>
          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 pointer-events-none">
              Loading the score…
            </div>
          )}
          {error && !ready && (
            <div className="absolute inset-0 p-4 text-sm text-red-400">{error}</div>
          )}
          {error && ready && (
            <div className="sticky bottom-0 left-0 right-0 bg-gray-900/90 text-red-400 text-xs px-2 py-1 border-t border-gray-500">
              {error}
            </div>
          )}
        </div>
        <GpSectionsPanel
          sections={sections}
          activeId={activeSectionId}
          draggedRange={draggedRange}
          onPlay={playSection}
          onSave={saveSection}
          onRename={renameSection}
          onDelete={deleteSection}
        />
      </div>
    </div>
  );
}
