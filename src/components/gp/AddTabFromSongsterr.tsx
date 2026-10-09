"use client";

import { useState } from "react";

interface AddTabFromSongsterrProps {
  /** Resolves to a message to show, or null when the import succeeded. */
  onImport: (url: string) => Promise<string | null>;
  busy?: boolean;
}

/**
 * The second way to give a song its tab: a Songsterr link instead of a file.
 *
 * Folded away behind a button until asked for, because the file picker is
 * the more usual route and two input fields side by side would make the
 * empty panel read as a form rather than an offer.
 *
 * Failures are shown here rather than in an alert: a mistyped link is this
 * field's problem, and an alert over the panel reads as the page objecting.
 */
export default function AddTabFromSongsterr({ onImport, busy }: AddTabFromSongsterrProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={busy}
        className="px-3 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        🎸 Import from Songsterr
      </button>
    );
  }

  const submit = async () => {
    if (!url.trim() || busy) return;
    setError(null);
    const message = await onImport(url);
    if (message) {
      setError(message);
      return;
    }
    // Only on success: a rejected link stays in the box to be corrected.
    setUrl("");
    setOpen(false);
  };

  return (
    <div className="w-full max-w-md flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="url"
          autoFocus
          value={url}
          disabled={busy}
          placeholder="https://www.songsterr.com/a/wsa/…"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
            if (e.key === "Escape") setOpen(false);
          }}
          className="flex-1 min-w-0 px-2 py-1.5 text-xs rounded bg-gray-900 border border-gray-600 text-gray-200 focus:outline-none focus:border-blue-500 disabled:opacity-40"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !url.trim()}
          className="px-3 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? "Importing…" : "Import"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={busy}
          className="px-2 py-1.5 text-xs rounded text-gray-400 hover:text-gray-200 disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-400 text-left">{error}</p>}
      {busy && (
        // The wait is a few seconds of someone else's servers plus a
        // rebuild of the score, with nothing to show in the meantime.
        <p className="text-xs text-gray-500 text-left">Fetching the score from Songsterr…</p>
      )}
    </div>
  );
}
