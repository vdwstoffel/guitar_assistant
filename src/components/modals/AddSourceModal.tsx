"use client";

import { ReactNode, useEffect, useRef } from "react";

interface AddSourceModalProps {
  /** "Add audio" or "Add tab" — what is being added, not where from. */
  title: string;
  linkLabel: string;
  linkPlaceholder: string;
  url: string;
  onUrlChange: (url: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  /** Opens the native picker; the modal closes on the way. */
  onChooseFile: () => void;
  /** The extensions the picker will accept, named for the person. */
  fileHint: string;
  busy?: boolean;
  busyNote?: string;
  error?: string;
  /**
   * Fields this kind needs and the other does not — the YouTube import's
   * fallback title, say. Rendered under the link field.
   */
  children?: ReactNode;
}

/**
 * The chrome shared by "Add audio" and "Add tab": a link, or a file.
 *
 * Only the chrome. The two kinds validate differently and recover from
 * failure differently, and folding that into one component meant a run of
 * conditionals that said less than two plain callers do. What is actually
 * the same is the frame around them, so that is what lives here.
 */
export default function AddSourceModal({
  title,
  linkLabel,
  linkPlaceholder,
  url,
  onUrlChange,
  onSubmit,
  onCancel,
  onChooseFile,
  fileHint,
  busy,
  busyNote,
  error,
  children,
}: AddSourceModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
        <h3 className="text-lg font-semibold mb-4 text-white">{title}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">{linkLabel}</label>
            <input
              ref={inputRef}
              type="text"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && url.trim() && !busy) onSubmit();
                if (e.key === "Escape") onCancel();
              }}
              placeholder={linkPlaceholder}
              disabled={busy}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
            />
          </div>

          {children}

          <div className="flex items-center gap-3 pt-1">
            <span className="h-px flex-1 bg-gray-700" />
            <span className="text-xs text-gray-500">or</span>
            <span className="h-px flex-1 bg-gray-700" />
          </div>

          <div>
            <button
              type="button"
              onClick={onChooseFile}
              disabled={busy}
              className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-sm text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              📁 Choose a file…
            </button>
            <p className="text-[10px] text-gray-500 mt-1 text-center">{fileHint}</p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {busy && busyNote && <p className="text-sm text-gray-400">{busyNote}</p>}
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={busy || !url.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors text-white flex items-center gap-2"
          >
            {busy && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {busy ? "Importing..." : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
