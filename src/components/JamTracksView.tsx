"use client";

import { useState, useRef, memo } from "react";
import { JamTrack } from "@/types";

interface JamTrackEditModalProps {
  jamTrack: JamTrack;
  onClose: () => void;
  onSave: (jamTrackId: string, title: string, tempo: number | null, timeSignature: string) => Promise<void>;
}

function JamTrackEditModal({ jamTrack, onClose, onSave }: JamTrackEditModalProps) {
  const [editTitle, setEditTitle] = useState(jamTrack.title);
  const [editTempo, setEditTempo] = useState<number | null>(jamTrack.tempo);
  const [editTimeSignature, setEditTimeSignature] = useState(jamTrack.timeSignature || "4/4");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!editTitle.trim()) return;
    setIsSaving(true);
    try {
      await onSave(jamTrack.id, editTitle.trim(), editTempo, editTimeSignature);
      onClose();
    } catch (error) {
      console.error("Failed to save jam track:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
        <h3 className="text-lg font-semibold mb-4 text-white">Edit Jam Track</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Tempo (BPM)</label>
              <input
                type="number"
                min={20}
                max={300}
                value={editTempo ?? ''}
                onChange={(e) => setEditTempo(e.target.value ? Math.min(300, Math.max(20, parseInt(e.target.value) || 20)) : null)}
                placeholder="None"
                className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Time Signature</label>
              <select
                value={editTimeSignature}
                onChange={(e) => setEditTimeSignature(e.target.value)}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500"
              >
                <option value="4/4">4/4</option>
                <option value="3/4">3/4</option>
                <option value="2/4">2/4</option>
                <option value="6/8">6/8</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500">Set tempo for click track count-in when jumping to markers</p>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !editTitle.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors text-white"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface JamTracksViewProps {
  jamTracks: JamTrack[];
  currentJamTrack: JamTrack | null;
  onJamTrackSelect: (jamTrack: JamTrack) => void;
  onJamTrackUpdate?: (jamTrackId: string, title: string, tempo: number | null, timeSignature: string) => Promise<void>;
  onJamTrackComplete?: (jamTrackId: string, completed: boolean) => Promise<void>;
  onJamTrackDelete?: (jamTrackId: string) => Promise<void>;
  onShowPdf?: (pdfPath: string) => void;
  onPdfUpload?: (jamTrackId: string, file: File) => Promise<void>;
  onPdfDelete?: (jamTrackId: string) => Promise<void>;
  onTabUpload?: (jamTrackId: string, file: File) => Promise<void>;
  onTabDelete?: (jamTrackId: string) => Promise<void>;
  onUpload?: (files: FileList) => Promise<void>;
  isUploading?: boolean;
}

const JamTracksView = memo(function JamTracksView({
  jamTracks,
  currentJamTrack,
  onJamTrackSelect,
  onJamTrackUpdate,
  onJamTrackComplete,
  onJamTrackDelete,
  onShowPdf,
  onPdfUpload,
  onPdfDelete,
  onTabUpload,
  onTabDelete,
  onUpload,
  isUploading,
}: JamTracksViewProps) {
  const [editingJamTrack, setEditingJamTrack] = useState<JamTrack | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const tabInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleDelete = async (jamTrackId: string) => {
    if (!onJamTrackDelete) return;
    setDeletingId(jamTrackId);
    try {
      await onJamTrackDelete(jamTrackId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-900 p-6">
      {/* Edit Modal */}
      {editingJamTrack && onJamTrackUpdate && (
        <JamTrackEditModal
          jamTrack={editingJamTrack}
          onClose={() => setEditingJamTrack(null)}
          onSave={onJamTrackUpdate}
        />
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            Jam Tracks
          </h1>
          {onUpload && (
            <>
              <button
                onClick={() => uploadInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm font-medium text-white transition-colors"
              >
                {isUploading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                )}
                {isUploading ? "Uploading..." : "Upload Tracks"}
              </button>
              <input
                ref={uploadInputRef}
                type="file"
                multiple
                accept=".mp3,.flac,.wav,.ogg,.m4a,.aac"
                onChange={async (e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    await onUpload(e.target.files);
                    e.target.value = "";
                  }
                }}
                className="hidden"
              />
            </>
          )}
        </div>
        <p className="text-gray-400 mt-1">
          {jamTracks.length} track{jamTracks.length !== 1 ? "s" : ""} - Play along with your favorite songs
        </p>
      </div>

      {jamTracks.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <p className="text-lg">No jam tracks found</p>
          <p className="mt-2">Use the upload button to add jam tracks</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {jamTracks.map((jamTrack) => (
            <div
              key={jamTrack.id}
              className={`rounded-lg transition-colors ${
                currentJamTrack?.id === jamTrack.id
                  ? "bg-purple-900/30 border border-purple-500/50"
                  : "bg-gray-800/50 hover:bg-gray-800 border border-transparent"
              }`}
            >
              <div
                onClick={() => onJamTrackSelect(jamTrack)}
                onKeyDown={(e) => e.key === "Enter" && onJamTrackSelect(jamTrack)}
                role="button"
                tabIndex={0}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer group"
              >
                {/* Play Icon */}
                <span className="w-8 text-center flex-shrink-0">
                  {currentJamTrack?.id === jamTrack.id ? (
                    <svg className="w-5 h-5 mx-auto text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 mx-auto text-gray-500 group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </span>

                {/* Title */}
                <span className={`flex-1 truncate font-medium ${
                  currentJamTrack?.id === jamTrack.id ? "text-purple-300" : "text-gray-200"
                }`}>
                  {jamTrack.title}
                </span>

                {/* Tab indicator */}
                {jamTrack.tabPath && (
                  <span className="text-purple-400 text-xs flex-shrink-0">TAB</span>
                )}

                {/* PDF indicator */}
                {jamTrack.pdfPath && (
                  <span className="text-blue-400 text-xs flex-shrink-0">PDF</span>
                )}

                {/* Completion circle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onJamTrackComplete?.(jamTrack.id, !jamTrack.completed);
                  }}
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
                    jamTrack.completed
                      ? "bg-purple-500 border-purple-500"
                      : "border-gray-500 hover:border-purple-400"
                  }`}
                  title={jamTrack.completed ? "Mark as not completed" : "Mark as completed"}
                >
                  {jamTrack.completed && (
                    <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* Duration */}
                <span className="text-gray-500 text-sm tabular-nums flex-shrink-0 w-12 text-right">
                  {formatDuration(jamTrack.duration)}
                </span>

                {/* Edit button */}
                {onJamTrackUpdate && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingJamTrack(jamTrack);
                    }}
                    className="p-1 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    title="Edit jam track"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Actions row */}
              <div className="flex items-center gap-2 px-4 pb-3 pt-0 flex-wrap">
                {/* Tab controls */}
                {jamTrack.tabPath ? (
                  <>
                    <span className="flex items-center gap-1 px-2 py-1 bg-purple-600/20 rounded text-xs text-purple-300">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      Tab loaded
                    </span>
                    {onTabDelete && (
                      <button
                        onClick={() => onTabDelete(jamTrack.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove Tab
                      </button>
                    )}
                  </>
                ) : onTabUpload && (
                  <label className="flex items-center gap-1 px-2 py-1 bg-purple-700 hover:bg-purple-600 rounded text-xs text-white cursor-pointer">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Tab
                    <input
                      type="file"
                      accept=".gp,.gp3,.gp4,.gp5,.gpx"
                      className="hidden"
                      ref={(el) => {
                        if (el) tabInputRefs.current.set(jamTrack.id, el);
                      }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onTabUpload(jamTrack.id, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}

                {/* PDF controls */}
                {jamTrack.pdfPath ? (
                  <>
                    <button
                      onClick={() => onShowPdf?.(jamTrack.pdfPath!)}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      View PDF
                    </button>
                    {onPdfDelete && (
                      <button
                        onClick={() => onPdfDelete(jamTrack.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove PDF
                      </button>
                    )}
                  </>
                ) : onPdfUpload && (
                  <label className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300 cursor-pointer">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add PDF
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      ref={(el) => {
                        if (el) fileInputRefs.current.set(jamTrack.id, el);
                      }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onPdfUpload(jamTrack.id, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}

                {onJamTrackDelete && (
                  <button
                    onClick={() => handleDelete(jamTrack.id)}
                    disabled={deletingId === jamTrack.id}
                    className="ml-auto text-xs text-red-400 hover:text-red-300 disabled:text-gray-500"
                  >
                    {deletingId === jamTrack.id ? "Deleting..." : "Delete"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default JamTracksView;
