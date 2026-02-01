"use client";

import { useRef } from "react";
import { Author } from "@/types";

interface AuthorSidebarProps {
  authors: Author[];
  selectedAuthor: Author | null;
  onAuthorSelect: (author: Author) => void;
  onScan: () => void;
  onUpload: (files: FileList) => Promise<void>;
  isScanning: boolean;
  isUploading: boolean;
  inProgressCount: number;
  isInProgressSelected: boolean;
  onInProgressSelect: () => void;
}

export default function AuthorSidebar({
  authors,
  selectedAuthor,
  onAuthorSelect,
  onScan,
  onUpload,
  isScanning,
  isUploading,
  inProgressCount,
  isInProgressSelected,
  onInProgressSelect,
}: AuthorSidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isBusy = isScanning || isUploading;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await onUpload(e.target.files);
      e.target.value = "";
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold text-gray-400 uppercase tracking-wider">Authors</h2>
      </div>

      {/* Author List */}
      <div className="flex-1 overflow-y-auto">
        {/* In Progress Section */}
        <button
          onClick={onInProgressSelect}
          className={`w-full px-4 py-3 text-left transition-colors border-b border-gray-700 ${
            isInProgressSelected
              ? "bg-gray-800 text-yellow-400 border-l-2 border-yellow-500"
              : "hover:bg-gray-800 text-gray-300 border-l-2 border-transparent"
          }`}
        >
          <span className="font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            In Progress
          </span>
          <span className="block text-xs text-gray-500 mt-0.5">
            {inProgressCount} book{inProgressCount !== 1 ? "s" : ""}
          </span>
        </button>

        {authors.length === 0 ? (
          <div className="text-gray-500 text-center p-6 text-sm">
            <p>No authors found.</p>
            <p className="mt-2">Add audio files and scan your library.</p>
          </div>
        ) : (
          <ul className="py-2">
            {authors.map((author) => (
              <li key={author.id}>
                <button
                  onClick={() => onAuthorSelect(author)}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    selectedAuthor?.id === author.id
                      ? "bg-gray-800 text-green-400 border-l-2 border-green-500"
                      : "hover:bg-gray-800 text-gray-300 border-l-2 border-transparent"
                  }`}
                >
                  <span className="font-medium">{author.name}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    {author.books.length} book{author.books.length !== 1 ? "s" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-gray-700 p-3 space-y-2">
        <button
          onClick={onScan}
          disabled={isBusy}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:text-gray-600 rounded text-sm transition-colors"
        >
          {isScanning ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          Scan Library
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:text-gray-600 rounded text-sm transition-colors"
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
          Upload Files
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".mp3,.flac,.wav,.ogg,.m4a,.aac"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
