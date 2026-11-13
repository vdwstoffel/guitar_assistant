"use client";

import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

/** The size the trim panels were last dragged to, shared by both and kept across visits. */
const STORAGE_KEY = "guitar-assistant.trimDialogSize";
const DEFAULT_WIDTH = 768;
const MIN_WIDTH = 420;
const MIN_HEIGHT = 300;
/** Kept clear around the panel, in px. */
const MARGIN = 16;

type Size = { w: number; h: number };

function loadSize(): Size | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return v && Number.isFinite(v.w) && Number.isFinite(v.h) ? { w: v.w, h: v.h } : null;
  } catch {
    return null;
  }
}

function saveSize(size: Size): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(size));
  } catch {
    /* the size just will not be remembered */
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * A trim panel's frame: modal over the page, resized by dragging its
 * bottom-right corner (the waveform takes any height added). It opens
 * centred, at the size it was last left at; resizing leaves its top-left
 * corner where it is, so the grip stays under the pointer.
 */
export default function TrimDialog({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size | null>(() => {
    const saved = loadSize();
    return saved && { w: clamp(saved.w, MIN_WIDTH, window.innerWidth - 2 * MARGIN), h: clamp(saved.h, MIN_HEIGHT, window.innerHeight - 2 * MARGIN) };
  });
  // Centred once, before it is first painted, at the size it opens at. Set on
  // the element (not in state): React never renders these, so resizing
  // leaves the panel where it is.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    const top = Math.max(MARGIN, (window.innerHeight - r.height) / 2);
    box.style.left = `${Math.max(MARGIN, (window.innerWidth - r.width) / 2)}px`;
    box.style.top = `${top}px`;
    box.style.maxHeight = `calc(100vh - ${top + MARGIN}px)`;
    box.style.visibility = "visible";
  }, []);

  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    const box = boxRef.current;
    if (!box) return;
    e.preventDefault();
    const grip = e.currentTarget;
    grip.setPointerCapture(e.pointerId);
    const r = box.getBoundingClientRect();
    const from = { x: e.clientX, y: e.clientY };
    let next: Size = { w: r.width, h: r.height };
    const onMove = (ev: PointerEvent) => {
      next = {
        w: clamp(r.width + ev.clientX - from.x, MIN_WIDTH, window.innerWidth - r.left - MARGIN),
        h: clamp(r.height + ev.clientY - from.y, MIN_HEIGHT, window.innerHeight - r.top - MARGIN),
      };
      setSize(next);
    };
    const onUp = () => {
      grip.removeEventListener("pointermove", onMove);
      grip.removeEventListener("pointerup", onUp);
      grip.removeEventListener("pointercancel", onUp);
      saveSize(next);
    };
    grip.addEventListener("pointermove", onMove);
    grip.addEventListener("pointerup", onUp);
    grip.addEventListener("pointercancel", onUp);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70">
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        style={{
          position: "absolute",
          width: size?.w ?? Math.min(DEFAULT_WIDTH, window.innerWidth - 2 * MARGIN),
          height: size?.h,
          visibility: "hidden",
        }}
        className="flex flex-col rounded-xl border border-gray-700 bg-gray-900 shadow-xl"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">{children}</div>
        <div
          onPointerDown={startResize}
          role="separator"
          aria-label="Resize the panel"
          title="Drag to resize"
          className="absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize touch-none text-gray-500 hover:text-amber-400"
        >
          <svg viewBox="0 0 20 20" className="h-full w-full" aria-hidden>
            <path d="M18 8 L8 18 M18 13 L13 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
