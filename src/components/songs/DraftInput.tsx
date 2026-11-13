"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface DraftInputProps<T> {
  /** The saved value, as the box shows it when not being typed in. */
  value: string;
  /** What the typed text saves as, or null while it is not a value that can be saved. */
  parse(text: string): T | null;
  onCommit(value: T): void;
  delayMs?: number;
  className?: string;
  "aria-label": string;
  inputMode?: "text" | "numeric";
  maxLength?: number;
  /** The id of a <datalist> offering suggestions. */
  list?: string;
  /** Shown while the box is empty (a value not set yet). */
  placeholder?: string;
}

const DEFAULT_DELAY_MS = 600;

/**
 * A text box that saves what is typed into it a moment after typing stops,
 * on Enter, on leaving it, and when it goes away mid-edit. While focused it
 * shows the typed text, so a save coming back never moves the caret; once
 * left it shows the saved value again (Escape drops an unsaved edit).
 */
export default function DraftInput<T>({
  value,
  parse,
  onCommit,
  delayMs = DEFAULT_DELAY_MS,
  className = "",
  inputMode = "text",
  ...rest
}: DraftInputProps<T>) {
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingText = useRef("");
  const latest = useRef({ value, parse, onCommit });
  useEffect(() => {
    latest.current = { value, parse, onCommit };
  });

  const commit = useCallback((text: string) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const { value: saved, parse: toValue, onCommit: save } = latest.current;
    const next = toValue(text);
    if (next !== null && String(next) !== saved) save(next);
  }, []);

  // Leaving mid-edit (another riff picked, Tab it out) still saves the edit.
  useEffect(
    () => () => {
      if (timer.current) commit(pendingText.current);
    },
    [commit],
  );

  const invalid = draft !== null && parse(draft) === null;
  return (
    <input
      type="text"
      inputMode={inputMode}
      value={draft ?? value}
      aria-invalid={invalid || undefined}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        pendingText.current = text;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => commit(text), delayMs);
      }}
      onBlur={() => {
        if (timer.current) commit(pendingText.current);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          if (timer.current) commit(pendingText.current);
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          if (timer.current) clearTimeout(timer.current);
          timer.current = null;
          setDraft(null);
        }
      }}
      className={`rounded-lg border bg-gray-700 px-2 py-1.5 text-sm text-gray-100 focus:outline-none ${
        invalid ? "border-red-500 focus:border-red-400" : "border-gray-600 focus:border-amber-500"
      } ${className}`}
      {...rest}
    />
  );
}
