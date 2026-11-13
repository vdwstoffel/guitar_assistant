"use client";

import { useEffect, useRef, type RefObject } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { type Region } from "wavesurfer.js/dist/plugins/regions.js";
import type { DecodedTake } from "./useTakeTrim";

export type Trim = { start: number; end: number };

interface TakeWaveformProps {
  blob: Blob;
  /** The take as one channel, drawn as it is so wavesurfer neither fetches nor decodes it (it may rescale it in place). */
  peaks: Float32Array;
  duration: number;
  /** Where the region sits; null until the parent first places it. */
  trim: Trim | null;
  /** While an edge is being dragged. */
  onDrag(t: Trim): void;
  /** When an edge's drag ends. The parent answers with the trim it keeps, and the region moves there. */
  onCommit(t: Trim): void;
  /** Where the loop check is (or was paused) in the take, in seconds; null before it first plays (useLoopCheck). */
  playhead?: RefObject<number | null>;
  /** A click or drag on the waveform: move the playhead there. */
  onSeek?(time: number): void;
}

/** The least the waveform is drawn at; it takes the height its box has beyond that. */
const HEIGHT = 128;
/** Room kept under the waveform for its scrollbar (zoomed in), in px. */
const SCROLLBAR_ROOM = 10;
/** The waveform's scrollbar, styled to the app: put inside wavesurfer's shadow DOM, where page CSS cannot reach. */
const SCROLLBAR_CSS = `
  .scroll::-webkit-scrollbar { height: 8px; }
  .scroll::-webkit-scrollbar-track { background: transparent; }
  .scroll::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 4px; }
  .scroll::-webkit-scrollbar-thumb:hover { background: #f59e0b; }
  @supports not selector(::-webkit-scrollbar) {
    .scroll { scrollbar-width: thin; scrollbar-color: #4b5563 transparent; }
  }
`;
/** How far the wheel zooms in: 1 fits the whole take. */
const MAX_ZOOM = 64;
/** Zoom per pixel of wheel travel (a notch is about 100 px): about 16% a notch. */
const ZOOM_PER_PIXEL = 0.0015;

/**
 * The take's waveform with one region, the part kept, whose edges drag (its
 * body does not: a click or drag there moves the playhead instead). The mouse
 * wheel zooms in and out around the pointer; Shift+wheel (or a sideways
 * swipe) moves along it. The playhead is a line in the waveform itself, so it
 * scrolls with it; while it moves out of view, the view follows it.
 */
export default function TakeWaveform({ blob, peaks, duration, trim, onDrag, onCommit, playhead, onSeek }: TakeWaveformProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  // The latest props, for wavesurfer's callbacks: the instance is built once per take.
  const latest = useRef({ trim, onDrag, onCommit, onSeek, playhead });
  const syncRef = useRef<() => void>(() => {});
  useEffect(() => {
    latest.current = { trim, onDrag, onCommit, onSeek, playhead };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const url = URL.createObjectURL(blob);
    const regions = RegionsPlugin.create();
    const ws = WaveSurfer.create({
      container: host,
      height: Math.max(HEIGHT, Math.round(host.clientHeight)),
      waveColor: "#9ca3af",
      progressColor: "#9ca3af",
      cursorWidth: 0,
      normalize: true,
      // Clicks and drags on the waveform are the playhead's (onSeek); wavesurfer plays nothing itself.
      interact: true,
      dragToSeek: true,
      autoScroll: false,
      plugins: [regions],
    });
    const root = ws.getWrapper().getRootNode();
    if (root instanceof ShadowRoot) {
      const style = document.createElement("style");
      style.textContent = SCROLLBAR_CSS;
      root.appendChild(style);
    }
    // wavesurfer redraws for a new width only: a taller box (the panel resized) is redrawn here.
    // The host is placed absolutely in its box, so what is drawn (the scrollbar, zoomed in)
    // can never make it taller: only the box can, and the box is sized by the panel.
    let drawnHeight = Math.max(HEIGHT, Math.round(host.clientHeight));
    const heightWatch = new ResizeObserver(() => {
      const h = Math.max(HEIGHT, Math.round(host.clientHeight));
      if (h === drawnHeight) return;
      drawnHeight = h;
      ws.setOptions({ height: h });
    });
    heightWatch.observe(host);
    let ready = false;
    let region: Region | null = null;
    let line: HTMLDivElement | null = null;
    let frame = 0;
    let zoom = 1;
    // Put the region where the parent's trim says (creating it the first time).
    const sync = () => {
      const t = latest.current.trim;
      if (!ready || !t) return;
      if (!region) {
        region = regions.addRegion({ start: t.start, end: t.end, color: "rgba(245, 158, 11, 0.2)", drag: false, resize: true });
        // Only the edges take the pointer: a press in the body goes through to the waveform.
        if (region.element) region.element.style.pointerEvents = "none";
        region.element?.querySelectorAll<HTMLElement>('[part~="region-handle"]').forEach((h) => {
          h.style.width = "10px";
          h.style.borderColor = "#f59e0b";
          h.style.borderWidth = "3px";
          h.style.pointerEvents = "all";
        });
      } else if (region.start !== t.start || region.end !== t.end) {
        region.setOptions({ start: t.start, end: t.end });
      }
    };
    syncRef.current = sync;
    const pxPerSec = () => (host.clientWidth / duration) * zoom;
    const visibleSeconds = () => host.clientWidth / pxPerSec();
    // The wheel zooms around the pointer: the moment under it stays under it.
    const onWheel = (e: WheelEvent) => {
      if (!ready || e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // sideways: the waveform scrolls
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 800 : e.deltaY;
      const next = Math.min(MAX_ZOOM, Math.max(1, zoom * Math.exp(-dy * ZOOM_PER_PIXEL)));
      if (next === zoom) return;
      const x = e.clientX - host.getBoundingClientRect().left;
      const at = (ws.getScroll() + x) / pxPerSec();
      zoom = next;
      ws.zoom(zoom <= 1 ? 0 : pxPerSec());
      if (zoom > 1) ws.setScroll(Math.max(0, at * pxPerSec() - x));
    };
    host.addEventListener("wheel", onWheel, { passive: false });
    // The playhead line follows the loop check; moving, it is kept in view.
    let last: number | null = null;
    const follow = () => {
      const at = latest.current.playhead?.current ?? null;
      if (line) {
        line.style.display = at === null ? "none" : "block";
        if (at !== null) line.style.left = `${Math.min(100, Math.max(0, (at / duration) * 100))}%`;
      }
      if (at !== null && last !== null && at !== last && zoom > 1) {
        const from = ws.getScroll() / pxPerSec();
        if (at < from || at > from + visibleSeconds()) ws.setScrollTime(Math.max(0, at - visibleSeconds() * 0.1));
      }
      last = at;
      frame = requestAnimationFrame(follow);
    };
    ws.on("ready", () => {
      ready = true;
      sync();
      line = document.createElement("div");
      line.setAttribute("aria-hidden", "true");
      line.dataset.playhead = "";
      Object.assign(line.style, {
        position: "absolute",
        top: "0",
        bottom: "0",
        width: "2px",
        marginLeft: "-1px",
        background: "#ffffff",
        boxShadow: "0 0 4px rgba(255,255,255,0.8)",
        pointerEvents: "none",
        zIndex: "5",
        display: "none",
      });
      ws.getWrapper().appendChild(line);
      frame = requestAnimationFrame(follow);
    });
    ws.on("interaction", (time) => latest.current.onSeek?.(time));
    regions.on("region-update", (r) => latest.current.onDrag({ start: r.start, end: r.end }));
    regions.on("region-updated", (r) => latest.current.onCommit({ start: r.start, end: r.end }));
    void ws.load(url, [peaks], duration).catch(() => {});

    return () => {
      cancelAnimationFrame(frame);
      heightWatch.disconnect();
      host.removeEventListener("wheel", onWheel);
      syncRef.current = () => {};
      ws.destroy();
      URL.revokeObjectURL(url);
    };
  }, [blob, peaks, duration]);

  // Follow the parent's trim.
  useEffect(() => syncRef.current(), [trim]);

  return <div ref={hostRef} className="absolute inset-x-0 top-0" style={{ bottom: SCROLLBAR_ROOM }} />;
}

const secs = (s: number) => `${s.toFixed(2)} s`;

interface TrimBoxProps {
  /** The take once decoded; until then a status (or `loadError`) shows in its place. */
  take: DecodedTake | null;
  loadError: string | null;
  trim: Trim | null;
  /** The handles as they are while dragged (else the trim). */
  live: Trim | null;
  /** How long the take is, as the handles may use it. */
  duration: number;
  onDrag(t: Trim): void;
  onCommit(t: Trim): void;
  /** Where the loop check is (or was paused) in the take, in seconds; null before it first plays (useLoopCheck). */
  playhead?: RefObject<number | null>;
  /** A click or drag on the waveform: move the playhead there (useLoopCheck's seek). */
  onSeek?(time: number): void;
}

/**
 * A trim panel's waveform with its region, where the handles are, and zoom:
 * the capture panel's and the part take's. A line follows the loop check
 * across the waveform and stays where it was paused; a click or drag on the
 * waveform moves it, so the end of the playing can be found and the end
 * handle dragged there. The wheel zooms in to place an edge exactly.
 */
export function TrimBox({ take, loadError, trim, live, duration, onDrag, onCommit, playhead, onSeek }: TrimBoxProps) {
  return (
    <>
      {/* Takes the panel's spare height (TrimDialog is resizable); the waveform fills it from inside, never sizing it. */}
      <div className="relative min-h-[140px] flex-1 rounded-lg border border-gray-700 bg-gray-800">
        {take ? (
          <TakeWaveform
            blob={take.blob}
            peaks={take.mono}
            duration={take.buffer.duration}
            trim={trim}
            onDrag={onDrag}
            onCommit={onCommit}
            playhead={playhead}
            onSeek={onSeek}
          />
        ) : (
          <div role={loadError ? "alert" : "status"} className={`h-32 grid place-items-center text-sm ${loadError ? "text-red-400" : "text-gray-400"}`}>
            {loadError ?? "Reading the take…"}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-gray-400 tabular-nums min-h-4">
          {live && `${secs(live.start)} → ${secs(live.end)} · keeps ${secs(live.end - live.start)} of ${secs(duration)}`}
        </div>
        {take && <div className="text-xs text-gray-500">Scroll to zoom · Shift+scroll to move along</div>}
      </div>
    </>
  );
}

/** The loop check's switch. */
export function LoopCheckButton({
  looping,
  disabled,
  onToggle,
  onRewind,
}: {
  looping: boolean;
  disabled: boolean;
  onToggle(): void;
  /** Back to the start of the kept part (playing on if it was playing). */
  onRewind(): void;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        aria-pressed={looping}
        disabled={disabled}
        onClick={onToggle}
        title="Play the kept part on repeat; a hiccup at the join means an edge is off. Pause keeps your place."
        className="rounded-lg px-3 py-1.5 text-sm font-semibold border border-amber-500 text-amber-300 hover:bg-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {looping ? "❚❚ Pause" : "▶ Loop check"}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onRewind}
        aria-label="Back to the start of the kept part"
        title="Back to the start"
        className="rounded-lg border border-gray-600 bg-gray-700 px-2.5 py-1.5 text-sm text-gray-200 hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ⏮
      </button>
    </span>
  );
}
