"use client";

/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab's api and model types are only reachable through namespaces that
 * cannot be imported as types across the bundle boundary (as in
 * useAlphaTabPlayback). These `any`s are that interop boundary.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useAlphaTabPlayback } from "@/components/gp/useAlphaTabPlayback";
import { routeContextToSink, subscribeToAudioSinkChanges } from "@/lib/audioSink";
import { mixGains } from "@/lib/songwriting/riffMix";
import { barIndexAtTick, takeSlice, ticksToSeconds, trackSegment, type Segment, type SegmentState } from "@/lib/songwriting/riffPlayback";
import { brokenTabsMessage, buildPlayableSongTex, heardTabTexts, songSegments } from "@/lib/songwriting/riffPlayable";
import { heardTabs, heardTakes } from "@/lib/songwriting/riffScore";
import { takeSrc, takeWindow } from "@/lib/songwriting/riffView";
import type { Riff } from "@/types";
import { createHiddenScorePlayer, type HiddenScorePlayer } from "./hiddenScorePlayer";

/** The synth's level; the takes play at their own level. */
const MASTER_VOLUME = 0.8;
/** How long (in 100 ms checks) a play may wait for the recordings to decode. */
const MAX_POLLS = 300;
/** Time constant of a take's level change, so a mute or a solo does not click. */
const GAIN_GLIDE = 0.015;
/**
 * The tempo a riff's score is built at before one is tapped. Nothing plays it:
 * Play riff waits for a real tempo, Play song skips the riff, and recording a
 * take has no guide until then.
 */
const NO_TEMPO_YET = 120;

export interface RiffPlayerInput {
  /**
   * What plays, in order: a riff (the Riffs view), or a song's sections, each
   * its riff `repeats` times — back to back in one score, so nothing stops
   * between them.
   */
  sections: { riff: Riff; repeats: number }[];
  /** Loop until stopped (one section, once round); otherwise play through and call `onFinished`. */
  loop: boolean;
  /** Played through: the last pass has finished playing. Not called after `stop()`. */
  onFinished?: () => void;
}

export interface RiffPlayer {
  /** Give this to an element that is laid out but off-screen (HIDDEN_PLAYER_STYLE). */
  containerRef: RefObject<HTMLDivElement | null>;
  /** The synth is ready and every heard recording has been decoded (or failed): Play can work. */
  ready: boolean;
  /** Playing, or starting/resuming after a change. */
  playing: boolean;
  play(): void;
  stop(): void;
  /** Zero-based bar within the riff (within the current pass) that is sounding; null while stopped. */
  currentBar: number | null;
  /** Index in `sections` of the section sounding; null while stopped. */
  currentSection: number | null;
  /** Something could not be played (a recording that would not load plays silent); null when all is well. */
  error: string | null;
}

/** What one generated score was built from, and how to read its clock (each pass as it plays, repeats taken). */
interface RiffScore {
  tex: string;
  /** Part id of each tab track, in track order; the silent clock track comes last. */
  tabPartIds: string[];
  /** Each pass of each section, in ticks: the takes restart at every one. */
  segments: Segment[];
  /** Each section's tempo: a segment's ticks are seconds at its section's tempo. */
  tempos: number[];
  /** Start tick of every bar as it plays (a repeated bar once per time). */
  barStarts: number[];
  loop: boolean;
}

interface ScoreSectionInput {
  tempo: number;
  tsNum: number;
  tsDen: number;
  /** With no tabs: a pass is the longest take, in 16ths at the tempo. */
  takeSixteenths?: number;
  passes: number;
  /** By part id only: a part's name is not in the score, so renaming one never reloads it. */
  tabs: { id: string; tex: string }[];
}

interface ScoreInput {
  loop: boolean;
  sections: ScoreSectionInput[];
}

/** What the heard tabs' texts are worked out from (heardTabTexts' input). */
type TabSource = Parameters<typeof heardTabTexts>[0];

interface TakeSpec {
  partId: string;
  name: string;
  audioPath: string;
  trimStart: number;
  /** Null: up to the end of the recording. */
  trimEnd: number | null;
}

interface Gains {
  parts: Record<string, number>;
}

/** The score, and the ids of the parts whose tab alphaTab cannot read (left out, so the rest still plays). */
function buildScore(input: ScoreInput): { score: RiffScore; broken: string[] } {
  const { tex, sections, broken, played, passes } = buildPlayableSongTex(
    input.sections.map((sec) => ({
      tempo: sec.tempo,
      tsNum: sec.tsNum,
      tsDen: sec.tsDen,
      takeSixteenths: sec.takeSixteenths,
      repeats: sec.passes,
      // Each track is named by its part's id (the hidden score shows no names).
      tabs: sec.tabs.map((t) => ({ ...t, name: t.id })),
    })),
  );
  const score: RiffScore = {
    tex,
    tabPartIds: [...new Set(sections.flat().map((t) => t.id))],
    segments: songSegments(played, passes),
    tempos: input.sections.map((sec) => sec.tempo),
    barStarts: played.starts.length > 0 ? played.starts : [0],
    loop: input.loop,
  };
  return { score, broken: [...new Set(broken.map((t) => t.id))] };
}

/**
 * Plays a riff, or a song's sections one after another: the tab parts on a
 * hidden alphaTab, all in one score (the clock, with a silent track that
 * keeps time when there are no tabs, and each section's tempo on its first
 * bar), and the recorded takes as Web Audio buffers that start again from
 * their trim start at every pass of their section, so nothing drifts (spec
 * decisions 10, 11 and 20) and nothing stops between sections.
 *
 * - The mix (levels, mute, solo) applies live: alphaTab's per-track volume
 *   and mute for the tabs, a gain per take, all by one rule
 *   (riffScore's effectiveGains).
 * - Each tab plays in the riff's tuning (a bass in the one derived from it),
 *   as the editor opens it; repeats and endings in a tab play as written, and
 *   a pass is as long as it plays.
 * - A change to what is played (tempo, tuning, a tab, tab/recording, the
 *   sections, `loop`, `repeats`) builds a new score; while playing it reloads
 *   and carries on from the top.
 * - A tab alphaTab cannot read (the editor saves unparseable drafts) is left
 *   out and named in `error`; the other tabs and the takes play.
 * - `loop: false` plays every section through, then calls `onFinished`. To
 *   play something else (after `stop()`), pass it in and call `play()` from
 *   an effect (after the render that passed it): the score loads at once,
 *   and `play()` waits for it and its recordings.
 * - Stops on `stop()` and on unmount; no take ever sounds after either.
 */
export function useRiffPlayer({ sections, loop, onFinished }: RiffPlayerInput): RiffPlayer {
  const containerRef = useRef<HTMLDivElement>(null);

  // --- What to play, split three ways so a mix change never rebuilds the score.
  // Each section's heard tabs as its riff plays them, in its tuning: worked
  // out again only when a tab or what they read of the riff changes (each is
  // parsed twice, and the mixer re-renders on every slider move).
  const tabSource = JSON.stringify(
    sections.map(({ riff }) => ({
      tempo: riff.tempo,
      tsNum: riff.tsNum,
      tsDen: riff.tsDen,
      tuning: riff.tuning,
      parts: heardTabs(riff.parts).map((p) => ({
        id: p.id,
        kind: p.kind,
        alphatex: p.alphatex,
        audioPath: p.audioPath,
        listen: p.listen,
      })),
    }) satisfies TabSource),
  );
  const tabs = useMemo(() => (JSON.parse(tabSource) as TabSource[]).map(heardTabTexts), [tabSource]);
  const takeSpecs = sections.map(({ riff }) =>
    heardTakes(riff.parts).map((p): TakeSpec => {
      const w = takeWindow(p);
      return {
        partId: p.id,
        name: p.name,
        audioPath: p.audioPath as string,
        trimStart: w.trimStart,
        trimEnd: Number.isFinite(w.trimEnd) ? w.trimEnd : null,
      };
    }),
  );
  const scoreKey = JSON.stringify({
    loop,
    sections: sections.map(({ riff, repeats }, i) => {
      const tempo = riff.tempo ?? NO_TEMPO_YET;
      // With no tab to set a pass's length, it is the longest take's kept part.
      const longestTake = Math.max(0, ...takeSpecs[i].map((t) => (t.trimEnd === null ? 0 : t.trimEnd - t.trimStart)));
      return {
        tempo,
        tsNum: riff.tsNum,
        tsDen: riff.tsDen,
        ...(tabs[i].length === 0 && longestTake > 0 ? { takeSixteenths: (longestTake * tempo) / 15 } : {}),
        passes: loop ? 1 : Math.max(1, Math.floor(repeats)),
        tabs: tabs[i],
      };
    }),
  } satisfies ScoreInput);
  const takesKey = JSON.stringify(takeSpecs);
  // Each riff's mix by its own rule (a solo silences that riff's other parts), keyed by part id.
  const gainsKey = JSON.stringify({ parts: Object.assign({}, ...sections.map(({ riff }) => mixGains(riff).parts)) });

  const score = useMemo(() => {
    try {
      const built = buildScore(JSON.parse(scoreKey) as ScoreInput);
      return { score: built.score, broken: built.broken, error: null };
    } catch (err) {
      // Never expected (broken tabs are left out above); the takes alone still play.
      const parsed = JSON.parse(scoreKey) as ScoreInput;
      const input = { ...parsed, sections: parsed.sections.map((sec) => ({ ...sec, tabs: [] })) };
      const message = err instanceof Error ? err.message : String(err);
      return { score: buildScore(input).score, broken: [], error: `Could not play this riff's tabs: ${message}` };
    }
  }, [scoreKey]);
  // Named as the parts are now.
  const brokenError = brokenTabsMessage(
    score.broken.map((id) => sections.flatMap((sec) => sec.riff.parts).find((p) => p.id === id)?.name ?? "A part"),
  );
  const takes = useMemo(() => JSON.parse(takesKey) as TakeSpec[][], [takesKey]);
  const gains = useMemo(() => JSON.parse(gainsKey) as Gains, [gainsKey]);

  // The newest of each, for the long-lived player to read.
  const scoreRef = useRef(score.score);
  const takesRef = useRef(takes);
  const gainsRef = useRef(gains);
  const onFinishedRef = useRef(onFinished);
  useEffect(() => {
    onFinishedRef.current = onFinished;
  });

  const [synthReady, setSynthReady] = useState(false);
  const [takesReady, setTakesReady] = useState(takes.every((t) => t.length === 0));
  const [takeError, setTakeError] = useState<string | null>(null);
  // alphaTab could not read the generated score (cleared by the next one it reads).
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pending, setPending] = useState(false);
  const [bar, setBar] = useState(0);
  const [section, setSection] = useState(0);

  const controllerRef = useRef<{
    scoreChanged(s: RiffScore): void;
    takesChanged(t: TakeSpec[][]): void;
    gainsChanged(): void;
    play(): void;
    stop(): void;
  } | null>(null);

  // Output device routing, looping and the master volume are the shared hook's.
  const playback = useAlphaTabPlayback({ looping: loop, volume: MASTER_VOLUME });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    // --- The takes: their own context, routed to the output device.
    let ctx: AudioContext | null = null;
    let unsubscribeSink: (() => void) | null = null;
    const audio = (): AudioContext => {
      if (!ctx) {
        const c = new AudioContext();
        ctx = c;
        void routeContextToSink(c);
        unsubscribeSink = subscribeToAudioSinkChanges(() => void routeContextToSink(c));
      }
      return ctx;
    };
    /** Decoded recordings by audio path; `done` once decoded or failed. */
    const buffers = new Map<string, { buffer: AudioBuffer | null; error: string | null; done: boolean }>();
    /** One gain per part, made when its take first plays. */
    const gainNodes = new Map<string, GainNode>();
    /** The one source playing (or about to) per part. */
    const sources = new Map<string, { node: AudioBufferSourceNode; audioPath: string }>();
    // Takes run between alphaTab saying it plays and the next stop, pause or finish.
    let takesLive = false;
    let segmentState: SegmentState | null = null;
    // play() arms onFinished; stop() disarms it, so a stop never reads as the end.
    let finishArmed = false;
    let barNow = -1;
    let sectionNow = -1;

    /** Every section's takes, each recording once. */
    const allTakes = (): TakeSpec[] => {
      const seen = new Set<string>();
      return takesRef.current.flat().filter((t) => !seen.has(t.audioPath) && Boolean(seen.add(t.audioPath)));
    };
    const takesSettled = () => allTakes().every((t) => buffers.get(t.audioPath)?.done);

    const refreshTakes = () => {
      if (disposed) return;
      setTakesReady(takesSettled());
      const failed = allTakes().filter((t) => buffers.get(t.audioPath)?.error);
      setTakeError(
        failed.length === 0
          ? null
          : `Could not load the recording of ${failed.map((t) => t.name).join(", ")} — it plays silent. (${buffers.get(failed[0].audioPath)?.error})`,
      );
    };

    const decode = (spec: TakeSpec) => {
      if (buffers.has(spec.audioPath)) return;
      const entry: { buffer: AudioBuffer | null; error: string | null; done: boolean } = {
        buffer: null,
        error: null,
        done: false,
      };
      buffers.set(spec.audioPath, entry);
      const c = audio();
      void fetch(takeSrc(spec.audioPath))
        .then(async (response) => {
          if (!response.ok) throw new Error(`the server said ${response.status}`);
          return c.decodeAudioData(await response.arrayBuffer());
        })
        .then((buffer) => {
          entry.buffer = buffer;
        })
        .catch((err) => {
          entry.error = err instanceof Error ? err.message : String(err);
        })
        .finally(() => {
          entry.done = true;
          refreshTakes();
        });
    };

    const stopSource = (partId: string) => {
      const held = sources.get(partId);
      if (!held) return;
      sources.delete(partId);
      try {
        held.node.stop();
      } catch {
        /* already stopped */
      }
      held.node.disconnect();
    };
    const stopTakes = () => {
      for (const partId of [...sources.keys()]) stopSource(partId);
    };

    const gainFor = (c: AudioContext, partId: string): GainNode => {
      let node = gainNodes.get(partId);
      if (!node) {
        node = c.createGain();
        node.gain.value = gainsRef.current.parts[partId] ?? 0;
        node.connect(c.destination);
        gainNodes.set(partId, node);
      }
      return node;
    };

    /**
     * A segment (a pass of a section) began `elapsedTicks` ago: the takes
     * sounding stop, and its section's takes start again from their trim
     * start (that far in), each for the pass's length.
     */
    const startSegment = (s: RiffScore, index: number, elapsedTicks: number) => {
      const c = ctx;
      const segment = s.segments[index];
      if (!c || !segment) return;
      const tempo = s.tempos[segment.section];
      const elapsed = ticksToSeconds(elapsedTicks, tempo);
      const passSeconds = ticksToSeconds(segment.end - segment.start, tempo);
      const now = c.currentTime;
      stopTakes();
      for (const spec of takesRef.current[segment.section] ?? []) {
        const buffer = buffers.get(spec.audioPath)?.buffer;
        if (!buffer) continue;
        const slice = takeSlice(
          { trimStart: spec.trimStart, trimEnd: spec.trimEnd ?? Infinity },
          buffer.duration,
          passSeconds,
          elapsed,
        );
        if (!slice) continue;
        const node = c.createBufferSource();
        node.buffer = buffer;
        node.connect(gainFor(c, spec.partId));
        node.start(now, slice.offset, slice.duration);
        const held = { node, audioPath: spec.audioPath };
        node.onended = () => {
          if (sources.get(spec.partId) !== held) return;
          sources.delete(spec.partId);
          node.disconnect();
        };
        sources.set(spec.partId, held);
      }
    };

    /** The mix onto the loaded score's tracks: tab track i is tab part i; the clock, last, is silent. */
    const applyTrackGains = (api: any, tracks: any[], s: RiffScore) => {
      const g = gainsRef.current;
      tracks.forEach((track, i) => {
        const gain = i < s.tabPartIds.length ? (g.parts[s.tabPartIds[i]] ?? 0) : 0;
        try {
          api.changeTrackVolume([track], gain);
          api.changeTrackMute([track], gain <= 0);
        } catch {
          /* mid-teardown */
        }
      });
    };

    const player: HiddenScorePlayer<RiffScore> = createHiddenScorePlayer<RiffScore>({
      container,
      playback,
      name: "riff",
      latest: () => scoreRef.current,
      texOf: (s) => s.tex,
      canPlay: takesSettled,
      maxPolls: MAX_POLLS,
      onReady: setSynthReady,
      // alphaTab, on every readyForPlayback (each score load and sound bank),
      // sets the rendered track — the first — back to its own volume. Its
      // handler runs before this one, so these messages reach the synth after.
      onPlayerReady: () => {
        const api = player.api;
        const s = player.loaded;
        if (api && s) applyTrackGains(api, api.score?.tracks ?? [], s);
      },
      onPending: setPending,
      onPlaying: (playing) => {
        setIsPlaying(playing);
        segmentState = null;
        if (playing) {
          takesLive = true;
          // The first playhead report starts the takes (riffPlayback.ts).
          if (ctx && ctx.state !== "running") void ctx.resume().catch(() => {});
        } else {
          takesLive = false;
          stopTakes();
        }
      },
      onScoreLoaded: (loaded: any, s) => {
        setLoadError(null);
        // Before the score's midi reaches the synth, so it starts mixed. The
        // first track's volume is reset once its midi is in: onPlayerReady
        // puts it back.
        applyTrackGains(player.api, loaded?.tracks ?? [], s);
      },
      onPosition: (e: any) => {
        const s = player.loaded;
        if (!s) return;
        const tick = e?.currentTick ?? 0;
        const report = trackSegment(segmentState, tick, s.segments, s.loop);
        // The bar within its pass, as played (through a repeat the playhead's
        // ticks run on), and the section it is in; past the end, as they were.
        const segment = s.segments[report.segment];
        if (segment) {
          const nextBar = barIndexAtTick(s.barStarts, tick) - segment.firstBar;
          if (nextBar !== barNow) {
            barNow = nextBar;
            setBar(nextBar);
          }
          if (segment.section !== sectionNow) {
            sectionNow = segment.section;
            setSection(segment.section);
          }
        }
        if (!takesLive) return;
        segmentState = report.state;
        if (report.started) startSegment(s, report.segment, report.elapsed);
      },
      onFinished: () => {
        const s = player.loaded;
        // While looping alphaTab fires this at every wrap.
        if (!s || s.loop) return;
        takesLive = false;
        stopTakes();
        if (!finishArmed) return;
        finishArmed = false;
        onFinishedRef.current?.();
      },
      onError: (e: any, whileLoading) => {
        if (!whileLoading) return; // logged by the player; not about the riff
        const err = e?.error ?? e?.innerError ?? e;
        setLoadError(`Could not play this riff's tabs: ${err instanceof Error ? err.message : String(err)}`);
      },
    });

    const takesChanged = (bySection: TakeSpec[][]) => {
      const specs = bySection.flat();
      const wanted = new Set(specs.map((t) => t.audioPath));
      for (const path of [...buffers.keys()]) if (!wanted.has(path)) buffers.delete(path);
      // A take no longer heard (or replaced) falls silent at once; a new one joins at the next pass.
      for (const [partId, held] of [...sources]) {
        if (!specs.some((t) => t.partId === partId && t.audioPath === held.audioPath)) stopSource(partId);
      }
      specs.forEach(decode);
      refreshTakes();
    };

    controllerRef.current = {
      scoreChanged: (s) => player.changed(s),
      takesChanged,
      gainsChanged: () => {
        const api = player.api;
        const s = player.loaded;
        if (api && s) applyTrackGains(api, api.score?.tracks ?? [], s);
        const c = ctx;
        if (!c) return;
        for (const [partId, node] of gainNodes) {
          node.gain.setTargetAtTime(gainsRef.current.parts[partId] ?? 0, c.currentTime, GAIN_GLIDE);
        }
      },
      play: () => {
        if (!player.api) return;
        finishArmed = true;
        // Inside the click, so the takes' context may start.
        const c = audio();
        if (c.state !== "running") void c.resume().catch(() => {});
        player.start();
      },
      stop: () => {
        finishArmed = false;
        takesLive = false;
        segmentState = null;
        stopTakes();
        player.stop();
      },
    };
    takesChanged(takesRef.current);

    return () => {
      disposed = true;
      controllerRef.current = null;
      takesLive = false;
      stopTakes();
      player.dispose();
      unsubscribeSink?.();
      const c = ctx;
      ctx = null;
      if (c) void c.close().catch(() => {});
    };
  }, [playback]);

  // Every later change. A freshly built player starts from the refs.
  useEffect(() => {
    scoreRef.current = score.score;
    controllerRef.current?.scoreChanged(score.score);
  }, [score]);
  useEffect(() => {
    takesRef.current = takes;
    controllerRef.current?.takesChanged(takes);
  }, [takes]);
  useEffect(() => {
    gainsRef.current = gains;
    controllerRef.current?.gainsChanged();
  }, [gains]);

  const play = useCallback(() => controllerRef.current?.play(), []);
  const stop = useCallback(() => controllerRef.current?.stop(), []);

  const playing = isPlaying || pending;
  return {
    containerRef,
    ready: synthReady && takesReady,
    playing,
    play,
    stop,
    currentBar: playing ? bar : null,
    currentSection: playing ? section : null,
    error: [brokenError, score.error, loadError, takeError].filter(Boolean).join(" ") || null,
  };
}
