"use client";

import { useState, useRef, useEffect } from "react";
import { JamTrack } from "@/types";
import { formatDuration } from "@/lib/formatting";

interface JamTrackListProps {
  jamTracks: JamTrack[];
  currentJamTrackId: string | null;
  onSelect: (id: string) => void;
  onUpload: (files: FileList) => void;
  isUploading: boolean;
  /** Called with url + optional title when user submits the YouTube import modal. */
  onYouTubeImport: (url: string, title?: string) => Promise<void>;
  isImportingFromYouTube: boolean;
}

export default function JamTrackList({
  jamTracks,
  currentJamTrackId,
  onSelect,
  onUpload,
  isUploading,
  onYouTubeImport,
  isImportingFromYouTube,
}: JamTrackListProps) {
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const youtubeInputRef = useRef<HTMLInputElement>(null);

  const [showYouTubeModal, setShowYouTubeModal] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeError, setYoutubeError] = useState("");
  const [youtubeNeedsTitle, setYoutubeNeedsTitle] = useState(false);
  const [youtubeTitle, setYoutubeTitle] = useState("");

  useEffect(() => {
    if (showYouTubeModal && youtubeInputRef.current) {
      youtubeInputRef.current.focus();
    }
  }, [showYouTubeModal]);

  const isValidYouTubeUrl = (url: string) =>
    /^https?:\/\/(www\.)?(youtube\.com\/(watch\?.*v=|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?.*v=)/.test(url);

  const handleYouTubeSubmit = async () => {
    if (!youtubeUrl.trim()) return;
    if (!isValidYouTubeUrl(youtubeUrl.trim())) {
      setYoutubeError("Please enter a valid YouTube URL");
      return;
    }
    if (youtubeNeedsTitle && !youtubeTitle.trim()) {
      setYoutubeError("Please enter a title");
      return;
    }
    setYoutubeError("");
    try {
      await onYouTubeImport(youtubeUrl.trim(), youtubeNeedsTitle ? youtubeTitle.trim() : undefined);
      closeYouTubeModal();
    } catch (err: unknown) {
      const error = err as Error & { needsTitle?: boolean };
      if (error.needsTitle) {
        setYoutubeNeedsTitle(true);
        setYoutubeError("Could not fetch video title automatically. Please enter a name.");
      } else {
        setYoutubeError(error.message || "Failed to import from YouTube");
      }
    }
  };

  const closeYouTubeModal = () => {
    setShowYouTubeModal(false);
    setYoutubeUrl("");
    setYoutubeError("");
    setYoutubeTitle("");
    setYoutubeNeedsTitle(false);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* YouTube import modal */}
      {showYouTubeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-white">Import from YouTube</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">YouTube URL</label>
                <input
                  ref={youtubeInputRef}
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => { setYoutubeUrl(e.target.value); setYoutubeError(""); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && youtubeUrl.trim() && !isImportingFromYouTube) handleYouTubeSubmit();
                    if (e.key === "Escape") closeYouTubeModal();
                  }}
                  placeholder="https://www.youtube.com/watch?v=..."
                  disabled={isImportingFromYouTube}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                />
              </div>
              {youtubeNeedsTitle && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Track Title</label>
                  <input
                    type="text"
                    value={youtubeTitle}
                    onChange={(e) => { setYoutubeTitle(e.target.value); setYoutubeError(""); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && youtubeTitle.trim() && !isImportingFromYouTube) handleYouTubeSubmit();
                      if (e.key === "Escape") closeYouTubeModal();
                    }}
                    placeholder="Enter a name for this track"
                    disabled={isImportingFromYouTube}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                    autoFocus
                  />
                </div>
              )}
              {youtubeError && <p className="text-sm text-red-400">{youtubeError}</p>}
              {isImportingFromYouTube && (
                <p className="text-sm text-gray-400">Importing... this may take a moment</p>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={closeYouTubeModal}
                disabled={isImportingFromYouTube}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleYouTubeSubmit}
                disabled={isImportingFromYouTube || !youtubeUrl.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors text-white flex items-center gap-2"
              >
                {isImportingFromYouTube && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {isImportingFromYouTube ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="shrink-0 px-3 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-purple-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <h2 className="text-base font-bold text-white">Jam Tracks</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowYouTubeModal(true)}
            disabled={isImportingFromYouTube}
            className="flex items-center gap-1.5 px-2 py-1.5 border border-purple-600 hover:bg-purple-600/20 disabled:border-gray-600 disabled:cursor-not-allowed rounded text-xs font-medium text-purple-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            YouTube
          </button>
          <button
            onClick={() => uploadInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-2 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs font-medium text-white transition-colors"
          >
            {isUploading ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
            {isUploading ? "Uploading..." : "Upload"}
          </button>
          <input
            ref={uploadInputRef}
            type="file"
            multiple
            accept=".mp3,.flac,.wav,.ogg,.m4a,.aac"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onUpload(e.target.files);
                e.target.value = "";
              }
            }}
            className="hidden"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1.5">
          {jamTracks.length} track{jamTracks.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto py-1">
        {jamTracks.length === 0 ? (
          <div className="text-center text-gray-500 py-8 px-3">
            <svg className="w-10 h-10 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <p className="text-sm">No jam tracks yet</p>
            <p className="text-xs mt-1">Upload audio or import from YouTube</p>
          </div>
        ) : (
          jamTracks.map((jt) => {
            const isSelected = jt.id === currentJamTrackId;
            return (
              <button
                key={jt.id}
                onClick={() => onSelect(jt.id)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors group ${
                  isSelected
                    ? "bg-purple-900/40 border-l-2 border-purple-400"
                    : "border-l-2 border-transparent hover:bg-gray-800"
                }`}
              >
                <svg
                  className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-purple-400" : "text-gray-600 group-hover:text-gray-400"}`}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>

                <span
                  className={`flex-1 truncate text-sm ${
                    isSelected ? "text-purple-200 font-medium" : "text-gray-300"
                  }`}
                >
                  {jt.title}
                </span>

                {/* Completion badge */}
                {jt.completed && (
                  <span className="shrink-0 w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center" title="Completed">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}

                {/* In-progress badge */}
                {jt.inProgress && !jt.completed && (
                  <span
                    className="shrink-0 w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500 flex items-center justify-center"
                    title="In progress"
                  >
                    <svg className="w-2.5 h-2.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                )}

                <span className="shrink-0 text-xs text-gray-500 tabular-nums">
                  {formatDuration(jt.duration)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
