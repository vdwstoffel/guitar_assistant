"use client";

import { useState, useRef, useEffect, memo } from "react";
import { JamTrack } from "@/types";
import InProgressIndicator from "./InProgressIndicator";
import { formatDuration } from "@/lib/formatting";

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
  onPdfUpload?: (jamTrackId: string, file: File, name: string) => Promise<void>;
  onPdfDelete?: (jamTrackId: string, pdfId: string) => Promise<void>;
  onUpload?: (files: FileList) => Promise<void>;
  isUploading?: boolean;
  onYouTubeImport?: (url: string, title?: string) => Promise<void>;
  isImportingFromYouTube?: boolean;
  onPsarcImport?: (file: File) => Promise<void>;
  isImportingPsarc?: boolean;
}

const JamTracksView = memo(function JamTracksView({
  jamTracks,
  currentJamTrack,
  onJamTrackSelect,
  onJamTrackUpdate,
  onJamTrackComplete,
  onJamTrackDelete,
  onPdfUpload,
  onPdfDelete,
  onUpload,
  isUploading,
  onYouTubeImport,
  isImportingFromYouTube,
  onPsarcImport,
  isImportingPsarc,
}: JamTracksViewProps) {
  const [editingJamTrack, setEditingJamTrack] = useState<JamTrack | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pdfUpload, setPdfUpload] = useState<{ jamTrackId: string; file: File } | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [showYouTubeModal, setShowYouTubeModal] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeError, setYoutubeError] = useState("");
  const [youtubeNeedsTitle, setYoutubeNeedsTitle] = useState(false);
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const psarcInputRef = useRef<HTMLInputElement>(null);
  const youtubeInputRef = useRef<HTMLInputElement>(null);
  const pdfNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pdfUpload && pdfNameInputRef.current) {
      pdfNameInputRef.current.focus();
      pdfNameInputRef.current.select();
    }
  }, [pdfUpload]);

  useEffect(() => {
    if (showYouTubeModal && youtubeInputRef.current) {
      youtubeInputRef.current.focus();
    }
  }, [showYouTubeModal]);

  const isValidYouTubeUrl = (url: string) =>
    /^https?:\/\/(www\.)?(youtube\.com\/(watch\?.*v=|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?.*v=)/.test(url);

  const handleYouTubeSubmit = async () => {
    if (!onYouTubeImport || !youtubeUrl.trim()) return;
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
      setShowYouTubeModal(false);
      setYoutubeUrl("");
      setYoutubeTitle("");
      setYoutubeNeedsTitle(false);
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


  const handleDelete = async (jamTrackId: string) => {
    if (!onJamTrackDelete) return;
    setDeletingId(jamTrackId);
    try {
      await onJamTrackDelete(jamTrackId);
    } finally {
      setDeletingId(null);
    }
  };

  const handlePdfUploadClick = (jamTrackId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setPdfName(file.name.replace(/\.pdf$/i, ""));
        setPdfUpload({ jamTrackId, file });
      }
    };
    input.click();
  };

  const handlePdfUploadConfirm = async () => {
    if (!pdfUpload || !pdfName.trim() || !onPdfUpload) return;
    setIsUploadingPdf(true);
    try {
      await onPdfUpload(pdfUpload.jamTrackId, pdfUpload.file, pdfName.trim());
      setPdfUpload(null);
      setPdfName("");
    } catch (error) {
      console.error("Failed to upload PDF:", error);
    } finally {
      setIsUploadingPdf(false);
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

      {/* PDF Upload Name Modal */}
      {pdfUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-white">Add PDF</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  ref={pdfNameInputRef}
                  type="text"
                  value={pdfName}
                  onChange={(e) => setPdfName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && pdfName.trim()) handlePdfUploadConfirm();
                    if (e.key === "Escape") { setPdfUpload(null); setPdfName(""); }
                  }}
                  placeholder="e.g. Rhythm Guitar"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <p className="text-xs text-gray-500">
                File: {pdfUpload.file.name}
              </p>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => { setPdfUpload(null); setPdfName(""); }}
                disabled={isUploadingPdf}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePdfUploadConfirm}
                disabled={isUploadingPdf || !pdfName.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors text-white"
              >
                {isUploadingPdf ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YouTube Import Modal */}
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
                    if (e.key === "Escape") { setShowYouTubeModal(false); setYoutubeUrl(""); setYoutubeError(""); setYoutubeTitle(""); setYoutubeNeedsTitle(false); }
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
                      if (e.key === "Escape") { setShowYouTubeModal(false); setYoutubeUrl(""); setYoutubeError(""); setYoutubeTitle(""); setYoutubeNeedsTitle(false); }
                    }}
                    placeholder="Enter a name for this track"
                    disabled={isImportingFromYouTube}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                    autoFocus
                  />
                </div>
              )}
              {youtubeError && (
                <p className="text-sm text-red-400">{youtubeError}</p>
              )}
              {isImportingFromYouTube && (
                <p className="text-sm text-gray-400">Importing... this may take a moment</p>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => { setShowYouTubeModal(false); setYoutubeUrl(""); setYoutubeError(""); setYoutubeTitle(""); setYoutubeNeedsTitle(false); }}
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
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            Jam Tracks
          </h1>
          <div className="flex items-center gap-2">
            {onPsarcImport && (
              <>
                <button
                  onClick={() => psarcInputRef.current?.click()}
                  disabled={isImportingPsarc}
                  className="flex items-center gap-2 px-3 py-2 border border-orange-600 hover:bg-orange-600/20 disabled:border-gray-600 disabled:cursor-not-allowed rounded text-sm font-medium text-orange-300 transition-colors"
                >
                  {isImportingPsarc ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  )}
                  {isImportingPsarc ? "Importing..." : "Rocksmith"}
                </button>
                <input
                  ref={psarcInputRef}
                  type="file"
                  accept=".psarc"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      await onPsarcImport(file);
                      e.target.value = "";
                    }
                  }}
                  className="hidden"
                />
              </>
            )}
            {onYouTubeImport && (
              <button
                onClick={() => setShowYouTubeModal(true)}
                disabled={isImportingFromYouTube}
                className="flex items-center gap-2 px-3 py-2 border border-purple-600 hover:bg-purple-600/20 disabled:border-gray-600 disabled:cursor-not-allowed rounded text-sm font-medium text-purple-300 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                YouTube
              </button>
            )}
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
                  {isUploading ? "Uploading..." : "Upload Files"}
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

                {/* PDF/Tab count indicator */}
                {jamTrack.pdfs.length > 0 && (
                  <span className={`text-xs flex-shrink-0 ${
                    jamTrack.pdfs.some((p: any) => p.fileType === "alphatex") ? "text-orange-400" : "text-blue-400"
                  }`}>
                    {jamTrack.pdfs.some((p: any) => p.fileType === "alphatex")
                      ? `${jamTrack.pdfs.length} Tab${jamTrack.pdfs.length !== 1 ? "s" : ""}`
                      : jamTrack.pdfs.length === 1 ? "PDF" : `${jamTrack.pdfs.length} PDFs`}
                  </span>
                )}

                {/* In Progress indicator */}
                <InProgressIndicator
                  trackId={jamTrack.id}
                  completed={jamTrack.completed}
                  playbackSpeed={jamTrack.playbackSpeed}
                  isJamTrack
                />

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
                {/* PDF list */}
                {jamTrack.pdfs.map((pdf) => (
                  <div key={pdf.id} className="flex items-center gap-1 px-2 py-1 bg-blue-600/20 rounded text-xs text-blue-300">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>{pdf.name}</span>
                    {onPdfDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPdfDelete(jamTrack.id, pdf.id);
                        }}
                        className="text-red-400 hover:text-red-300 ml-1"
                        title="Remove PDF"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}

                {/* Add PDF button */}
                {onPdfUpload && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePdfUploadClick(jamTrack.id);
                    }}
                    className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add PDF
                  </button>
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
