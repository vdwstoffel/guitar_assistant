"use client";

import { useState, useRef } from "react";
import { AuthorSummary } from "@/types";

type UploadMode = "audio" | "pdf" | "video";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAudioUpload: (files: FileList) => Promise<void>;
  onPdfBookUpload: (file: File, authorName: string, bookName: string) => Promise<void>;
  onVideoUpload: (files: File[], authorName: string, bookName: string) => Promise<void>;
  authors: AuthorSummary[];
}

export default function UploadModal({
  isOpen,
  onClose,
  onAudioUpload,
  onPdfBookUpload,
  onVideoUpload,
  authors,
}: UploadModalProps) {
  const [mode, setMode] = useState<UploadMode>("audio");
  const [isUploading, setIsUploading] = useState(false);

  // Audio state
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // PDF state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Video state
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Shared book target state (for PDF and video modes)
  const [bookTarget, setBookTarget] = useState<"existing" | "new">("new");
  const [selectedBookKey, setSelectedBookKey] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [bookName, setBookName] = useState("");

  const resetState = () => {
    setAudioFiles([]);
    setPdfFile(null);
    setVideoFiles([]);
    setBookTarget("new");
    setSelectedBookKey("");
    setAuthorName("");
    setBookName("");
    setIsUploading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleModeChange = (newMode: UploadMode) => {
    setMode(newMode);
    resetState();
  };

  const handleBookSelect = (key: string) => {
    setSelectedBookKey(key);
    if (key) {
      const [authorIdx, bookIdx] = key.split("-").map(Number);
      const author = authors[authorIdx];
      const book = author?.books[bookIdx];
      if (author && book) {
        setAuthorName(author.name);
        setBookName(book.name);
      }
    } else {
      setAuthorName("");
      setBookName("");
    }
  };

  const handleAudioUpload = async () => {
    if (audioFiles.length === 0) return;
    setIsUploading(true);
    try {
      const dt = new DataTransfer();
      audioFiles.forEach((f) => dt.items.add(f));
      await onAudioUpload(dt.files);
      handleClose();
    } catch (error) {
      console.error("Error uploading audio:", error);
      alert("Failed to upload audio files");
    } finally {
      setIsUploading(false);
    }
  };

  const handlePdfUpload = async () => {
    if (!pdfFile || !authorName.trim() || !bookName.trim()) return;
    setIsUploading(true);
    try {
      await onPdfBookUpload(pdfFile, authorName.trim(), bookName.trim());
      handleClose();
    } catch (error) {
      console.error("Error uploading PDF book:", error);
      alert("Failed to upload PDF book");
    } finally {
      setIsUploading(false);
    }
  };

  const handleVideoUploadSubmit = async () => {
    if (videoFiles.length === 0 || !authorName.trim() || !bookName.trim()) return;
    setIsUploading(true);
    try {
      await onVideoUpload(videoFiles, authorName.trim(), bookName.trim());
      handleClose();
    } catch (error) {
      console.error("Error uploading videos:", error);
      alert("Failed to upload videos");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpload =
    mode === "audio" ? handleAudioUpload :
    mode === "pdf" ? handlePdfUpload :
    handleVideoUploadSubmit;

  const canUpload =
    mode === "audio"
      ? audioFiles.length > 0
      : mode === "pdf"
        ? pdfFile !== null && authorName.trim() !== "" && bookName.trim() !== ""
        : videoFiles.length > 0 && authorName.trim() !== "" && bookName.trim() !== "";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Upload</h2>
          <p className="text-sm text-gray-400 mt-1">
            Upload audio files or a PDF book
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Mode Toggle */}
          <div className="flex rounded overflow-hidden border border-gray-600">
            {([
              { value: "audio" as UploadMode, label: "Audio Files" },
              { value: "pdf" as UploadMode, label: "PDF Book" },
              { value: "video" as UploadMode, label: "Course Videos" },
            ]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleModeChange(opt.value)}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  mode === opt.value
                    ? "bg-green-600 text-white"
                    : "bg-gray-700 text-gray-400 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* ---- Audio Files Mode ---- */}
          {mode === "audio" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Audio Files *</label>
                <button
                  onClick={() => audioInputRef.current?.click()}
                  className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 border-2 border-dashed border-gray-600 rounded text-gray-300 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  {audioFiles.length === 0
                    ? "Select Audio Files"
                    : `${audioFiles.length} file(s) selected`}
                </button>
                <input
                  ref={audioInputRef}
                  type="file"
                  multiple
                  accept=".mp3,.flac,.wav,.ogg,.m4a,.aac"
                  onChange={(e) => {
                    if (e.target.files) setAudioFiles(Array.from(e.target.files));
                  }}
                  className="hidden"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supported: MP3, FLAC, WAV, OGG, M4A, AAC. Author/book info is read from metadata.
                </p>
              </div>

              {audioFiles.length > 0 && (
                <div className="border border-gray-700 rounded p-3">
                  <p className="text-sm text-gray-400 mb-2">Selected Files:</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {audioFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-700 rounded px-3 py-1.5">
                        <span className="text-sm text-white truncate">{file.name}</span>
                        <button
                          onClick={() => setAudioFiles((f) => f.filter((_, idx) => idx !== i))}
                          className="ml-2 p-1 text-gray-400 hover:text-red-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---- Book Target Picker (shared by PDF and Video modes) ---- */}
          {(mode === "pdf" || mode === "video") && (
            <div className="space-y-4">
              <div className="flex rounded overflow-hidden border border-gray-600">
                <button
                  type="button"
                  onClick={() => { setBookTarget("existing"); setAuthorName(""); setBookName(""); setSelectedBookKey(""); }}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    bookTarget === "existing"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-400 hover:text-white"
                  }`}
                >
                  Existing Book
                </button>
                <button
                  type="button"
                  onClick={() => { setBookTarget("new"); setAuthorName(""); setBookName(""); setSelectedBookKey(""); }}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    bookTarget === "new"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-400 hover:text-white"
                  }`}
                >
                  New Book
                </button>
              </div>

              {bookTarget === "existing" ? (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Select Book *</label>
                  <select
                    value={selectedBookKey}
                    onChange={(e) => handleBookSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select a book...</option>
                    {authors.map((author, authorIdx) => (
                      <optgroup key={author.id} label={author.name}>
                        {author.books.map((book, bookIdx) => (
                          <option key={book.id} value={`${authorIdx}-${bookIdx}`}>
                            {book.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {selectedBookKey && (
                    <p className="text-xs text-gray-500 mt-1">
                      {authorName} &mdash; {bookName}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Author Name *</label>
                    <input
                      type="text"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      placeholder="e.g., Joseph Alexander"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Book Name *</label>
                    <input
                      type="text"
                      value={bookName}
                      onChange={(e) => setBookName(e.target.value)}
                      placeholder="e.g., Complete Technique for Modern Guitar"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* ---- PDF File Picker ---- */}
          {mode === "pdf" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">PDF File *</label>
                <button
                  onClick={() => pdfInputRef.current?.click()}
                  className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 border-2 border-dashed border-gray-600 rounded text-gray-300 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  {pdfFile ? pdfFile.name : "Select PDF"}
                </button>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setPdfFile(e.target.files[0]);
                  }}
                  className="hidden"
                />
              </div>

              {pdfFile && (
                <div className="flex items-center justify-between bg-gray-700 rounded px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className="w-4 h-4 flex-shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-white truncate">{pdfFile.name}</span>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      ({(pdfFile.size / 1024 / 1024).toFixed(1)} MB)
                    </span>
                  </div>
                  <button
                    onClick={() => setPdfFile(null)}
                    className="ml-2 p-1 text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ---- Video File Picker ---- */}
          {mode === "video" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Video Files *</label>
                <button
                  onClick={() => videoInputRef.current?.click()}
                  className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 border-2 border-dashed border-gray-600 rounded text-gray-300 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {videoFiles.length === 0
                    ? "Select Videos"
                    : `${videoFiles.length} video(s) selected`}
                </button>
                <input
                  ref={videoInputRef}
                  type="file"
                  multiple
                  accept=".mp4,.mov,.webm,.m4v"
                  onChange={(e) => {
                    if (e.target.files) setVideoFiles(Array.from(e.target.files));
                  }}
                  className="hidden"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supported: MP4, MOV, WebM, M4V
                </p>
              </div>

              {videoFiles.length > 0 && (
                <div className="border border-gray-700 rounded p-3">
                  <p className="text-sm text-gray-400 mb-2">Selected Videos:</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {videoFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-700 rounded px-3 py-1.5">
                        <span className="text-sm text-white truncate">{file.name}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                          ({(file.size / 1024 / 1024).toFixed(1)} MB)
                        </span>
                        <button
                          onClick={() => setVideoFiles((f) => f.filter((_, idx) => idx !== i))}
                          className="ml-2 p-1 text-gray-400 hover:text-red-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:text-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={isUploading || !canUpload}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white rounded transition-colors flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
