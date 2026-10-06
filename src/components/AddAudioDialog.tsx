"use client";

import { useRef, useState } from "react";

interface AddAudioDialogProps {
  onCancel: () => void;
  /** An audio file was chosen. */
  onFiles: (files: FileList) => void;
  /** A YouTube link was pasted. */
  onUrl: (url: string) => void;
  /** A download or upload is running; both ways in are disabled. */
  busy?: boolean;
  /** What went wrong last time, shown rather than alerted. */
  error?: string | null;
}

const ACCEPT = ".mp3,.flac,.wav,.ogg,.m4a,.aac";

/**
 * The two ways a song gets its recording: a file you have, or a YouTube link.
 *
 * One dialog behind the existing "Add audio" button rather than a second
 * button beside it — both produce the same jam track, and which source it
 * came from stops mattering the moment it exists.
 *
 * The link is downloaded while this is open, which takes a while, so the
 * dialog stays up and says so instead of closing optimistically; a failure
 * then has somewhere to appear, with yt-dlp's own message.
 *
 * Mounted only while open, by the caller, so the typed URL starts empty
 * every time without an effect having to clear it.
 */
export default function AddAudioDialog({
  onCancel,
  onFiles,
  onUrl,
  busy,
  error,
}: AddAudioDialogProps) {
  const [url, setUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitUrl = () => {
    const trimmed = url.trim();
    if (trimmed && !busy) onUrl(trimmed);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={() => !busy && onCancel()}
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white mb-1">Add audio</h3>
        <p className="text-sm text-gray-400 mb-4">
          The recording for this song, to switch to alongside the tab.
        </p>

        <label className="block text-sm text-gray-400 mb-2" htmlFor="add-audio-url">
          YouTube link
        </label>
        <div className="flex gap-2 mb-4">
          <input
            id="add-audio-url"
            autoFocus
            type="url"
            value={url}
            disabled={busy}
            placeholder="https://www.youtube.com/watch?v=…"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitUrl();
              else if (e.key === "Escape" && !busy) onCancel();
            }}
            className="flex-1 min-w-0 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-green-500 disabled:opacity-40"
          />
          <button
            type="button"
            onClick={submitUrl}
            disabled={busy || !url.trim()}
            className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-700" />
          <span className="text-xs text-gray-500 uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-gray-700" />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Choose an audio file
        </button>

        {busy && (
          <p className="mt-4 text-sm text-gray-400" role="status">
            Fetching the audio — this can take a minute.
          </p>
        )}
        {error && !busy && (
          <p className="mt-4 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
