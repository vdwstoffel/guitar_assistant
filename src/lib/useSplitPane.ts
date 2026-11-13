"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { DEFAULT_SPLIT, loadSplit, saveSplit, splitFromPointer } from "./splitPane";

/**
 * A divider between two side-by-side panes, as on the Jam Tracks view: drag
 * it to resize, double-click it to even up, and the balance is remembered
 * under `key`. The stored split is read in the initialiser, so this is for a
 * component that only ever renders in the browser.
 */
export function useSplitPane(key: string) {
  const [split, setSplit] = useState(() => loadSplit(key));
  const containerRef = useRef<HTMLDivElement>(null);

  // alphaTab lays a score out on window resize only: once the drag is over,
  // in a frame of its own so the new width is in the DOM when it measures.
  const relayout = () => requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));

  // Pointer capture, so the drag survives the cursor crossing the score.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    let latest: number | null = null;
    const onMove = (ev: PointerEvent) => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return;
      latest = splitFromPointer(ev.clientX, bounds);
      setSplit(latest);
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      if (latest !== null) saveSplit(latest, key);
      relayout();
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  const onDoubleClick = () => {
    setSplit(DEFAULT_SPLIT);
    saveSplit(DEFAULT_SPLIT, key);
    relayout();
  };

  return {
    split,
    containerRef,
    dividerProps: {
      onPointerDown,
      onDoubleClick,
      role: "separator",
      "aria-orientation": "vertical",
      "aria-valuenow": Math.round(split * 100),
      title: "Drag to resize · double-click to even up",
    } as const,
  };
}
