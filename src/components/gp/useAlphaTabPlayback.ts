/* eslint-disable @typescript-eslint/no-explicit-any --
 * alphaTab's api and model types are only reachable through namespaces that
 * cannot be imported as types across the bundle boundary. These `any`s are
 * the interop boundary with that untyped surface, not unexamined typing.
 */
import { useEffect, useMemo, useRef } from "react";
import {
  applyAlphaTabSink,
  getAudioSinkPreference,
  routeContextToSink,
  subscribeToAudioSinkChanges,
} from "@/lib/audioSink";
import { speedToRate } from "@/lib/playbackSpeed";
import {
  advanceClicks,
  buildClickTrack,
  countInClicks,
  seekClicks,
  type Click,
  type ClickBar,
} from "@/lib/tabscore/clickTrack";

/** One tone for every beat: see `playClick`. */
const CLICK_HZ = 800;
/** How much quieter the beats after the first are — roughly 7dB down. */
const OFFBEAT_GAIN = 0.45;
/**
 * A count-in volume for alphaTab that makes the phase run without being
 * heard: zero would make it skip the count-in entirely.
 */
const INAUDIBLE = 0.0001;

export interface BarRange {
  /** Zero-based, inclusive. */
  startBar: number;
  endBar: number;
}

export interface PlaybackOptions {
  /** Practice speed as a whole percentage, 10-200. */
  speed?: number;
  /** Repeat on finish. */
  looping?: boolean;
  /** Score playback volume, 0-1. */
  volume?: number;
  /** Metronome click volume, 0-1. Zero is off. */
  metronomeVolume?: number;
  /** Count-in tick volume, 0-1. Zero means no count-in. */
  countInVolume?: number;
  /** A bar range was dragged out, or dropped. */
  onLoopChange?: (range: BarRange | null) => void;
}

export interface PlaybackHandle {
  /**
   * Wire playback into a freshly created api. Call once, from inside the
   * setup that created it, with the alphaTab module in scope. Returns the
   * detach function to call during teardown.
   */
  attach(api: any, alphaTab: any): () => void;
  /** Drop any drag-selected practice range. */
  clearLoop(): void;
  /** Loop a bar range directly, as clicking a saved section does. */
  applyLoop(range: BarRange): void;
}

/**
 * Everything about playing an alphaTab score that is not about editing one:
 * the click and count-in, the output device, drag-across-bars to loop, and
 * the speed/volume/looping properties.
 *
 * Extracted from the tab editor's ScoreCanvas so the Guitar Pro player can
 * have the same transport without a second copy. What stayed behind is
 * everything editor-shaped — the caret, the AlphaTex model, the six-string
 * assumption — none of which a read-only multi-track score wants.
 *
 * Takes its options through refs internally, so the long-lived alphaTab
 * subscriptions never close over stale values.
 */
export function useAlphaTabPlayback(options: PlaybackOptions): PlaybackHandle {
  const apiRef = useRef<any>(null);

  const speedRef = useRef(options.speed);
  const loopingRef = useRef(options.looping);
  const volumeRef = useRef(options.volume);
  const metronomeVolumeRef = useRef(options.metronomeVolume);
  const countInVolumeRef = useRef(options.countInVolume);
  const onLoopChangeRef = useRef(options.onLoopChange);

  // Synced in an effect rather than during render: the long-lived alphaTab
  // subscriptions read these from handlers, which only ever fire long after
  // the commit.
  useEffect(() => {
    speedRef.current = options.speed;
    loopingRef.current = options.looping;
    volumeRef.current = options.volume;
    metronomeVolumeRef.current = options.metronomeVolume;
    countInVolumeRef.current = options.countInVolume;
    onLoopChangeRef.current = options.onLoopChange;
  });

  // The properties alphaTab holds itself, pushed whenever they change.
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    try {
      api.playbackSpeed = speedToRate(options.speed);
      api.isLooping = !!options.looping;
      if (options.volume !== undefined) api.masterVolume = options.volume;
      api.metronomeVolume = 0;
      api.countInVolume = (options.countInVolume ?? 0) > 0 ? INAUDIBLE : 0;
    } catch {
      /* ignore — the api may be mid-teardown */
    }
  }, [options.speed, options.looping, options.volume, options.countInVolume]);

  // Which phase alphaTab is in: the two click volumes mean different things
  // during the count-in and during playback, and alphaTab exposes no flag.
  const countingInRef = useRef(false);
  const clickContextRef = useRef<AudioContext | null>(null);

  // The click grid, and how far through it playback has got. Rebuilt whenever
  // the score is re-rendered, because an edit moves every tick after it.
  const clickBarsRef = useRef<ClickBar[]>([]);
  const clickTrackRef = useRef<Click[]>([]);
  const clickCursorRef = useRef(0);
  const lastTickRef = useRef(0);
  // One count-in is scheduled in full from its first tick, so later ticks of
  // the same count-in are ignored.
  const countInScheduledRef = useRef(false);

  // Drag state. Refs, not state: these change many times per drag and must
  // not re-render the score underneath it.
  const dragStartBeatRef = useRef<any>(null);
  const draggedRef = useRef(false);
  const dragPreviewRef = useRef<BarRange | null>(null);
  const loopBarsRef = useRef<BarRange | null>(null);

  // Built once, inside a memo: every helper below reads its inputs through
  // refs, so nothing goes stale, and a fresh handle each render would be an
  // unstable dependency that forced the caller's setup effect to tear
  // alphaTab down and rebuild it on every render. Refs are exempt from
  // exhaustive-deps, so the empty dependency list is honest.
  return useMemo<PlaybackHandle>(() => {
    /**
     * One click, every beat, with the downbeat louder — same tone, same decay,
     * only the gain differs, because two different tones are distracting to
     * play along to.
     *
     * `inSeconds` schedules it ahead on the audio clock instead of playing it
     * now, which is how the count-in stays even: its ticks are handed to us
     * all at the wrong moments (see `clickTrack`), but their spacing is known.
     */
    const playClick = (level: number, accent: boolean, inSeconds = 0) => {
      try {
        let ctx = clickContextRef.current;
        if (!ctx) {
          ctx = new AudioContext();
          clickContextRef.current = ctx;
          void routeContextToSink(ctx);
        }
        if (ctx.state === "suspended") void ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = CLICK_HZ;
        const at = ctx.currentTime + Math.max(0, inSeconds);
        gain.gain.setValueAtTime(level * (accent ? 1 : OFFBEAT_GAIN), at);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.05);
        osc.start(at);
        osc.stop(at + 0.05);
      } catch {
        /* no audio output available — the score itself still plays */
      }
    };

    /**
     * What alphaTab itself gets, which is not what the user chose.
     *
     * Its metronome is silenced outright: every tick is played above instead.
     * The count-in cannot be silenced the same way, because a count-in volume
     * of zero makes alphaTab skip the count-in phase altogether rather than
     * run it quietly — so it gets a whisper, far below anything audible, which
     * is enough to make the phase happen and emit its ticks.
     */
    const applyClickVolumes = (api: any) => {
      api.metronomeVolume = 0;
      api.countInVolume = (countInVolumeRef.current ?? 0) > 0 ? INAUDIBLE : 0;
    };

    /**
     * Rebuild the click grid from alphaTab's tick cache — the order bars are
     * actually played in, repeats and all — and put the cursor back where
     * playback currently is, so a rebuild never replays what has been heard.
     */
    const rebuildClickTrack = () => {
      const lookups = apiRef.current?.tickCache?.masterBars ?? [];
      const bars: ClickBar[] = [];
      for (const mb of lookups) {
        const master = mb?.masterBar;
        if (!master || !Number.isFinite(mb.start) || !Number.isFinite(mb.end)) continue;
        bars.push({
          start: mb.start,
          end: mb.end,
          numerator: master.timeSignatureNumerator,
          denominator: master.timeSignatureDenominator,
        });
      }
      clickBarsRef.current = bars;
      clickTrackRef.current = buildClickTrack(bars);
      clickCursorRef.current = seekClicks(clickTrackRef.current, lastTickRef.current);
    };

    /** A click the playhead has just reached, at whatever volume is set now. */
    const emitClick = (click: Click) => {
      const level = metronomeVolumeRef.current ?? 0;
      if (level > 0) playClick(level, click.accent);
    };

    /**
     * The whole count-in, scheduled from its first tick.
     *
     * Only the first tick arrives at an honest moment — the start of the audio
     * — so the rest are laid out from it on the audio clock at the spacing the
     * event itself reports, divided by the practice speed. Waiting for each
     * tick to be delivered instead is what made the count-in uneven.
     */
    const scheduleCountIn = (midi: any) => {
      const level = countInVolumeRef.current ?? 0;
      if (level <= 0) return;
      const rate = speedToRate(speedRef.current);
      const spacing = (midi?.metronomeDurationInMilliseconds ?? 0) / 1000 / (rate || 1);
      const count = countInClicks(clickBarsRef.current, apiRef.current?.tickPosition ?? 0);
      for (let k = 0; k < count; k++) playClick(level, k === 0, k * spacing);
    };

    /**
     * Bars of the track currently DRAWN, not of the score's first track.
     *
     * The editor only ever renders one track so the two are the same there,
     * but the GP player draws whichever part you picked. Reading tracks[0]
     * would highlight beats belonging to a track that is not on screen, so a
     * drag over the Bass staff would select against the Lead's beats.
     * `api.tracks` is what renderTracks last drew.
     */
    const barsOf = () => {
      const api = apiRef.current;
      const rendered = api?.tracks?.[0] ?? api?.score?.tracks?.[0];
      return rendered?.staves?.[0]?.bars ?? [];
    };

    const highlightBars = (aIndex: number, bIndex: number): BarRange | null => {
      const bars = barsOf();
      const start = Math.min(aIndex, bIndex);
      const end = Math.max(aIndex, bIndex);
      const firstBeat = bars[start]?.voices?.[0]?.beats?.[0];
      const endBeats = bars[end]?.voices?.[0]?.beats;
      const lastBeat = endBeats?.[endBeats.length - 1];
      if (!firstBeat || !lastBeat) return null;
      try {
        apiRef.current?.highlightPlaybackRange(firstBeat, lastBeat);
      } catch {
        return null;
      }
      return { startBar: start, endBar: end };
    };

    /**
     * Put the stored range back after a render.
     *
     * In the editor every edit re-parses and calls renderScore with a brand
     * new Score, whose Beats are different objects from the ones the range was
     * built from. The loop deliberately survives editing, so it is re-applied
     * from bar indices rather than left to alphaTab. The GP player re-renders
     * on every track switch, which is the same problem.
     */
    const reapplyLoop = () => {
      const wanted = loopBarsRef.current;
      if (!wanted) return;
      const bars = barsOf();
      if (wanted.startBar >= bars.length) {
        // The bars it covered are gone; drop it rather than guess.
        loopBarsRef.current = null;
        try {
          apiRef.current?.clearPlaybackRangeHighlight();
          if (apiRef.current) apiRef.current.playbackRange = null;
        } catch {
          /* ignore */
        }
        onLoopChangeRef.current?.(null);
        return;
      }
      const end = Math.min(wanted.endBar, bars.length - 1);
      if (!highlightBars(wanted.startBar, end)) return;
      try {
        apiRef.current?.applyPlaybackRangeFromHighlight();
      } catch {
        return;
      }
      if (end !== wanted.endBar) {
        loopBarsRef.current = { startBar: wanted.startBar, endBar: end };
        onLoopChangeRef.current?.(loopBarsRef.current);
      }
    };

    /**
     * Ends a drag with whatever bars it last covered. Called from beatMouseUp
     * for a release over the score, and from the window listener for one that
     * lands anywhere else — alphaTab binds mouseup to its own canvas element,
     * so a release past the right edge of the last bar (the natural way to
     * select "to the end") never reaches it, and without this the drag would
     * hang: its own _isBeatMouseDown stays set, and plain hovering would then
     * keep extending the selection.
     */
    const commitDrag = () => {
      const range = dragPreviewRef.current;
      dragStartBeatRef.current = null;
      dragPreviewRef.current = null;
      if (!draggedRef.current) return false;
      draggedRef.current = false;
      if (!range || !highlightBars(range.startBar, range.endBar)) return false;
      try {
        apiRef.current?.applyPlaybackRangeFromHighlight();
      } catch {
        return false;
      }
      loopBarsRef.current = range;
      onLoopChangeRef.current?.(range);
      return true;
    };

    const attach = (api: any, alphaTab: any): (() => void) => {
      apiRef.current = api;
      let detached = false;

      try {
        api.playbackSpeed = speedToRate(speedRef.current);
        api.isLooping = !!loopingRef.current;
        // Applied at attach as well as in the effects the caller runs: those
        // run before an async setup finishes, so a value chosen before the api
        // existed would otherwise be silently dropped.
        if (volumeRef.current !== undefined) api.masterVolume = volumeRef.current;
        applyClickVolumes(api);
      } catch {
        /* ignore */
      }

      api.playerStateChanged.on((e: any) => {
        if (detached) return;
        // alphaTab runs the count-in first when countInVolume is above zero,
        // and emits the same metronome events for it. There is no public flag
        // for the phase, so track it here: it ends as soon as the position
        // starts moving.
        if (e.state === 1) {
          countingInRef.current = (countInVolumeRef.current ?? 0) > 0;
          countInScheduledRef.current = false;
          // The grid only exists once alphaTab has generated the midi, which
          // it certainly has by the time it plays.
          lastTickRef.current = api.tickPosition ?? 0;
          rebuildClickTrack();
        }
      });

      // The click, driven off the playhead rather than off alphaTab's own
      // metronome events: a tick position is correct in real time at every
      // practice speed, and those events are not (see `clickTrack`). alphaTab
      // reports a position roughly every 3ms, so a click lands within that of
      // its beat — the same accuracy the old path happened to get at 100%.
      api.playerPositionChanged.on((e: any) => {
        if (detached) return;
        if (e?.currentTime > 0) countingInRef.current = false;
        const tick = e?.currentTick ?? 0;
        // A seek, or a loop that has just wrapped, has not played the clicks
        // it skipped over.
        const jumped = !!e?.isSeek || tick < lastTickRef.current;
        lastTickRef.current = tick;
        // The cursor advances whether or not the click is audible, so turning
        // the metronome on mid-bar does not let off everything missed.
        clickCursorRef.current = advanceClicks(
          clickTrackRef.current,
          clickCursorRef.current,
          tick,
          jumped,
          emitClick,
        );
      });

      // Only the count-in is still taken from alphaTab's metronome events: it
      // is a phase of its own, with no position updates to drive it, and its
      // first tick is the one honest marker of where the audio actually began.
      // alphaTab plays all its own ticks at one fixed velocity and its
      // synthesiser ignores the beat number the event carries, so there is no
      // way to accent a downbeat through it — and a second, different tone
      // layered on top just sounds like two instruments. Its own click is
      // silenced (see applyClickVolumes) and every tick is played here
      // instead: one sound throughout, the downbeat simply louder.
      api.midiEventsPlayedFilter = [alphaTab.midi.MidiEventType.AlphaTabMetronome];
      api.midiEventsPlayed.on((e: any) => {
        if (detached || !countingInRef.current || countInScheduledRef.current) return;
        for (const midi of e?.events ?? []) {
          if (!midi?.isMetronome) continue;
          countInScheduledRef.current = true;
          scheduleCountIn(midi);
          return;
        }
      });

      // Respect the app-wide output device. Applied on playerReady (the output
      // does not exist before then) and again whenever it changes elsewhere.
      const applySink = () => {
        void applyAlphaTabSink(api.player?.output, getAudioSinkPreference());
      };
      api.playerReady.on(applySink);
      const unsubscribeSink = subscribeToAudioSinkChanges(applySink);

      api.postRenderFinished.on(() => {
        if (detached) return;
        reapplyLoop();
        rebuildClickTrack();
      });

      api.beatMouseDown.on((beat: any) => {
        if (detached) return;
        dragStartBeatRef.current = beat;
        draggedRef.current = false;
      });

      api.beatMouseMove.on((beat: any) => {
        if (detached) return;
        const startBar = dragStartBeatRef.current?.voice?.bar;
        const overBar = beat?.voice?.bar;
        if (!startBar || !overBar) return;
        // Only a genuine drag — moving within the beat it started on is still
        // a click as far as the caller is concerned.
        if (overBar.index === startBar.index && beat === dragStartBeatRef.current) return;
        draggedRef.current = true;
        dragPreviewRef.current = highlightBars(startBar.index, overBar.index);
      });

      api.beatMouseUp.on((beat: any) => {
        if (detached) return;
        const startBar = dragStartBeatRef.current?.voice?.bar;
        const overBar = beat?.voice?.bar;
        // Prefer the bar actually released over; fall back to the last one the
        // drag passed through when the release was off a beat.
        if (draggedRef.current && startBar && overBar) {
          dragPreviewRef.current = { startBar: startBar.index, endBar: overBar.index };
          if (overBar.index < startBar.index) {
            dragPreviewRef.current = { startBar: overBar.index, endBar: startBar.index };
          }
        }
        if (commitDrag()) return;
        // A plain click. alphaTab's own handler has already run by now, and
        // for a click (its _selectionEnd is unset, or equals _selectionStart)
        // it sets playbackRange to null. Editing a note inside the section you
        // are drilling is exactly what you do while practising, so put the
        // section back.
        reapplyLoop();
      });

      // Bubble phase, so alphaTab's capture-phase handler on its own canvas
      // has already committed the drag by the time this runs for a release
      // over the score; commitDrag then no-ops.
      const onWindowMouseUp = () => {
        if (!detached) commitDrag();
      };
      window.addEventListener("mouseup", onWindowMouseUp);

      return () => {
        detached = true;
        unsubscribeSink();
        window.removeEventListener("mouseup", onWindowMouseUp);
        // The click's own context is separate from alphaTab's output and would
        // otherwise outlive the player.
        void clickContextRef.current?.close().catch(() => {});
        clickContextRef.current = null;
        apiRef.current = null;
      };
    };

    return {
      attach,
      clearLoop: () => {
        loopBarsRef.current = null;
        try {
          apiRef.current?.clearPlaybackRangeHighlight();
          if (apiRef.current) apiRef.current.playbackRange = null;
        } catch {
          /* ignore */
        }
        onLoopChangeRef.current?.(null);
      },
      applyLoop: (range: BarRange) => {
        loopBarsRef.current = range;
        reapplyLoop();
      },
      };
  }, []);
}

/** Applied by both players so a score looks the same in either. */
export const SCORE_SURFACE_CSS = `
  .at-surface {
    width: 100% !important;
    margin: 0 !important;
    background: white !important;
    overflow: hidden;
  }
  .at-surface svg {
    display: block;
    width: 100% !important;
    height: auto;
  }
  .at-cursor-bar {
    background: rgba(255, 242, 0, 0.25);
  }
  .at-beat-cursor {
    background: rgba(64, 64, 255, 0.75);
    width: 3px;
  }
  /*
    The drag-selected practice range. alphaTab positions this overlay but
    gives it no background of its own, so without this rule a selected
    section looks identical to an unselected one. Blue, to stay distinct
    from the yellow current-bar cursor, which sits under it.
  */
  .at-selection div {
    background: rgba(59, 130, 246, 0.22);
  }
`;
