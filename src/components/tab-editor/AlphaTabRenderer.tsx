'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  applyAlphaTabSink,
  getAudioSinkPreference,
  subscribeToAudioSinkChanges,
} from '@/lib/audioSink';

export interface Track {
  index: number;
  name: string;
}

interface AlphaTabRendererProps {
  fileUrl: string;
  tempo?: number;
  selectedTrackIndices?: number[];
  onPlayerStateChange?: (isPlaying: boolean) => void;
  onError?: (error: string) => void;
  onTracksLoaded?: (tracks: Track[]) => void;
}

export interface AlphaTabRendererRef {
  play: () => void;
  pause: () => void;
  stop: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setVolume: (volume: number) => void;
  setLooping: (loop: boolean) => void;
}

const AlphaTabRenderer = forwardRef<AlphaTabRendererRef, AlphaTabRendererProps>(
  ({ fileUrl, selectedTrackIndices, onPlayerStateChange, onError, onTracksLoaded }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const apiRef = useRef<any>(null);
    const isInitialLoad = useRef(true);
    const lastRenderedTracksRef = useRef<string>('');

    // Store callbacks in refs to prevent stale closures
    const onPlayerStateChangeRef = useRef(onPlayerStateChange);
    const onErrorRef = useRef(onError);
    const onTracksLoadedRef = useRef(onTracksLoaded);
    const selectedTrackIndicesRef = useRef(selectedTrackIndices);

    useEffect(() => {
      onPlayerStateChangeRef.current = onPlayerStateChange;
      onErrorRef.current = onError;
      onTracksLoadedRef.current = onTracksLoaded;
      selectedTrackIndicesRef.current = selectedTrackIndices;
    });

    // Effect 1: API lifecycle (only depends on fileUrl)
    useEffect(() => {
      if (!containerRef.current || typeof window === 'undefined') return;

      // Reset for new file
      isInitialLoad.current = true;
      lastRenderedTracksRef.current = '';

      const initAlphaTab = async () => {
        try {
          const alphaTab = await import('@coderline/alphatab');
          const { AlphaTabApi, Settings, Environment } = alphaTab;

          // Initialize web worker and audio worklet for synthesizer playback
          if (!Environment.isRunningInWorker) {
            Environment.initializeMain(
              () => new Worker("/alphaTab.worker.mjs", { type: "module" }),
              (ctx: AudioContext) => ctx.audioWorklet.addModule("/alphaTab.worklet.mjs")
            );
          }

          const settings = new Settings();
          settings.core.fontDirectory = '/font/';
          settings.display.layoutMode = alphaTab.LayoutMode.Page;
          settings.display.stretchForce = 0.95;
          settings.display.scale = 0.98;
          settings.player.playerMode = alphaTab.PlayerMode.EnabledSynthesizer;
          settings.player.soundFont = "/soundfont/sonivox.sf2";
          settings.player.enableCursor = true;
          settings.player.scrollMode = alphaTab.ScrollMode.Continuous;
          settings.player.scrollElement = containerRef.current!;

          apiRef.current = new AlphaTabApi(containerRef.current!, settings);

          // Route synth output to the user-selected audio device.
          const applySink = () => {
            void applyAlphaTabSink(apiRef.current?.player?.output, getAudioSinkPreference());
          };
          apiRef.current.playerReady.on(applySink);
          const unsubscribeSink = subscribeToAudioSinkChanges(applySink);
          apiRef.current.__unsubscribeSink = unsubscribeSink;

          // Set up event listeners
          apiRef.current.scoreLoaded.on(() => {
            if (!apiRef.current || !apiRef.current.score) return;

            // Only call onTracksLoaded on initial load to populate dropdown
            if (isInitialLoad.current) {
              const tracks: Track[] = apiRef.current.score.tracks.map((track: any, index: number) => ({
                index,
                name: track.name || `Track ${index + 1}`
              }));
              onTracksLoadedRef.current?.(tracks);
              isInitialLoad.current = false;
            }
          });

          apiRef.current.error.on((e: any) => {
            onErrorRef.current?.(e.message || 'Unknown error');
          });

          apiRef.current.playerStateChanged.on((args: any) => {
            onPlayerStateChangeRef.current?.(args.state === 1);
          });

          // Load the file
          apiRef.current.load(fileUrl);

        } catch (error) {
          onErrorRef.current?.('Failed to initialize: ' + error);
        }
      };

      initAlphaTab();

      return () => {
        if (apiRef.current) {
          try {
            const unsub = apiRef.current.__unsubscribeSink;
            if (typeof unsub === 'function') unsub();
            apiRef.current.destroy();
            apiRef.current = null;
          } catch (e) {
            console.warn('Error destroying alphaTab:', e);
          }
        }
      };
    }, [fileUrl]); // Only re-initialize when file changes

    // Effect 2: Apply track filtering when track selection changes
    const trackKey = selectedTrackIndices?.join(',') || 'all';

    useEffect(() => {
      if (!apiRef.current || !apiRef.current.score) return;
      if (trackKey === lastRenderedTracksRef.current) return;

      lastRenderedTracksRef.current = trackKey;

      try {
        let tracksToRender;
        if (selectedTrackIndices && selectedTrackIndices.length > 0) {
          tracksToRender = selectedTrackIndices
            .map(index => apiRef.current.score.tracks[index])
            .filter(Boolean);
        } else {
          tracksToRender = [apiRef.current.score.tracks[0]];
        }

        if (tracksToRender.length > 0) {
          apiRef.current.renderTracks(tracksToRender);
        }
      } catch (error) {
        console.error('Error rendering tracks:', error);
      }
    }, [trackKey, selectedTrackIndices]);

    useImperativeHandle(ref, () => ({
      play: () => apiRef.current?.play(),
      pause: () => apiRef.current?.pause(),
      stop: () => apiRef.current?.stop(),
      setPlaybackSpeed: (speed: number) => {
        if (apiRef.current) apiRef.current.playbackSpeed = speed;
      },
      setVolume: (volume: number) => {
        if (apiRef.current) apiRef.current.masterVolume = volume;
      },
      setLooping: (loop: boolean) => {
        if (apiRef.current) apiRef.current.isLooping = loop;
      },
    }));

    return (
      <div className="bg-gray-900 rounded border border-gray-700 p-4">
        <style jsx global>{`
          .at-surface {
            background: white !important;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            margin: 0 auto 16px auto;
            overflow: hidden;
            width: 100% !important;
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
          .at-selection div {
            background: rgba(64, 64, 255, 0.1);
          }
        `}</style>
        <div
          ref={containerRef}
          className="w-full overflow-y-auto"
          style={{
            width: '100%',
            height: '700px',
            background: '#1f2937',
            borderRadius: '4px',
            padding: '8px',
            overflowX: 'hidden'
          }}
        />
      </div>
    );
  }
);

AlphaTabRenderer.displayName = 'AlphaTabRenderer';

export default AlphaTabRenderer;
