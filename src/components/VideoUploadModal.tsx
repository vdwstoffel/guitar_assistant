"use client";

import { useState, useRef } from "react";
import { Author } from "@/types";

interface VideoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[], authorName: string, bookName: string) => Promise<void>;
  authors: Author[];
}

export default function VideoUploadModal({
  isOpen,
  onClose,
  onUpload,
  authors,
}: VideoUploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [authorName, setAuthorName] = useState("");
  const [bookName, setBookName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedBookKey, setSelectedBookKey] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleModeChange = (newMode: "existing" | "new") => {
    setMode(newMode);
    setAuthorName("");
    setBookName("");
    setSelectedBookKey("");
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !authorName.trim() || !bookName.trim()) {
      alert("Please select videos and fill in author and book name");
      return;
    }

    setIsUploading(true);
    try {
      await onUpload(selectedFiles, authorName.trim(), bookName.trim());
      // Reset and close
      setSelectedFiles([]);
      setAuthorName("");
      setBookName("");
      setSelectedBookKey("");
      setMode("existing");
      onClose();
    } catch (error) {
      console.error("Error uploading videos:", error);
      alert("Failed to upload videos");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((files) => files.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Upload Course Videos</h2>
          <p className="text-sm text-gray-400 mt-1">
            Upload multiple videos for a book/course
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Mode Toggle */}
          <div className="flex rounded overflow-hidden border border-gray-600">
            <button
              type="button"
              onClick={() => handleModeChange("existing")}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                mode === "existing"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-400 hover:text-white"
              }`}
            >
              Existing Book
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("new")}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                mode === "new"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-400 hover:text-white"
              }`}
            >
              New Book
            </button>
          </div>

          {mode === "existing" ? (
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
              {/* Author Name */}
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

              {/* Book Name */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Book/Course Name *</label>
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

          {/* File Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Video Files *</label>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 border-2 border-dashed border-gray-600 rounded text-gray-300 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              {selectedFiles.length === 0 ? "Select Videos" : `${selectedFiles.length} video(s) selected`}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".mp4,.mov,.webm,.m4v"
              onChange={handleFileSelect}
              className="hidden"
            />
            <p className="text-xs text-gray-500 mt-1">
              Supported: MP4, MOV, WebM, M4V
            </p>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="border border-gray-700 rounded p-3">
              <p className="text-sm text-gray-400 mb-2">Selected Videos:</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-gray-700 rounded px-3 py-2"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <svg className="w-4 h-4 flex-shrink-0 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-sm text-white truncate">{file.name}</span>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        ({(file.size / 1024 / 1024).toFixed(1)} MB)
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="ml-2 p-1 text-gray-400 hover:text-red-400 transition-colors"
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:text-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={isUploading || selectedFiles.length === 0 || !authorName.trim() || !bookName.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded transition-colors flex items-center gap-2"
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
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
