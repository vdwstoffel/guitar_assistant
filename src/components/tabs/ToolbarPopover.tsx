"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface ToolbarPopoverProps {
  /** The button's face; the ▾ is added. */
  label: ReactNode;
  title: string;
  ariaLabel: string;
  /**
   * Lit purple, like a pressed technique: something is set in here that is
   * worth seeing without opening it (a repeat sign on the caret's bar).
   */
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}

const BUTTON =
  "px-2 py-1 text-xs rounded border focus:outline-none focus:border-blue-500 " +
  "disabled:opacity-40 disabled:cursor-not-allowed";
const OFF =
  "bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500 hover:text-white";
const OPEN = "bg-gray-500 border-gray-400 text-white";
const ON = "bg-purple-800 border-purple-600 text-white hover:bg-purple-700";

/**
 * A toolbar button that folds a group of controls behind it — the editor's
 * speed, mix, tab settings and bar settings. Unlike the technique list, the
 * panel stays open while you use it, so a tempo can be nudged three times or
 * a bar given a repeat and an ending in one visit; a click anywhere else, or
 * Escape, closes it.
 */
export default function ToolbarPopover({
  label,
  title,
  ariaLabel,
  active = false,
  disabled = false,
  children,
}: ToolbarPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Blur first: the tempo and speed boxes commit what was typed on blur,
    // and an input unmounted while focused never gets one — closing the
    // panel would silently throw the typed number away.
    const close = () => {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && rootRef.current?.contains(focused)) focused.blur();
      setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={title}
        className={`${BUTTON} ${active ? ON : open ? OPEN : OFF}`}
      >
        {label} ▾
      </button>
      {open && !disabled && (
        <div
          role="group"
          aria-label={ariaLabel}
          className="absolute left-0 top-full mt-1 z-30 w-max flex flex-col gap-2 p-2 rounded border border-gray-500 bg-gray-700 shadow-lg"
        >
          {children}
        </div>
      )}
    </div>
  );
}
