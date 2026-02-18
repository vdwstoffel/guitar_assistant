"use client";

import { useState, useMemo, useRef, memo } from "react";
import { AuthorSummary, BookSummary } from "@/types";

const BookCard = memo(function BookCard({ book, authorName, onClick }: { book: BookSummary; authorName: string; onClick: () => void }) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Use coverTrackPath for book cover art
  const artUrl = book.coverTrackPath ? `/api/albumart/${encodeURIComponent(book.coverTrackPath)}` : null;

  // Calculate progress percentage
  const progressPercentage = book.totalCount && book.totalCount > 0
    ? Math.round((book.completedCount || 0) / book.totalCount * 100)
    : 0;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center p-4 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors group text-left w-full"
    >
      {/* Book Cover */}
      {artUrl && !hasError ? (
        <div className="relative w-full aspect-square mb-3">
          {!isLoaded && (
            <div className="absolute inset-0 bg-gray-700 rounded-lg flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-gray-600 border-t-gray-400 rounded-full animate-spin"></div>
            </div>
          )}
          <img
            src={artUrl}
            alt={`${book.name} cover`}
            className={`w-full h-full rounded-lg object-cover bg-gray-700 transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            loading="lazy"
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
          />
        </div>
      ) : (
        <div className="w-full aspect-square bg-gray-700 rounded-lg flex items-center justify-center mb-3">
          <svg className="w-16 h-16 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
      )}

      {/* Book Name */}
      <h3 className="text-white font-medium text-sm truncate w-full text-center group-hover:text-green-400 transition-colors">
        {book.name}
      </h3>

      {/* Author Name */}
      <p className="text-gray-400 text-xs mt-0.5 truncate w-full text-center">
        {authorName}
      </p>

      {/* Track Count */}
      <p className="text-gray-500 text-xs mt-1">
        {book.trackCount} track{book.trackCount !== 1 ? "s" : ""}
      </p>

      {/* Progress Bar - Show if book has content */}
      {book.totalCount && book.totalCount > 0 && (
        <div className="w-full mt-2 space-y-0.5">
          {/* Progress bar */}
          <div className="w-full bg-gray-700 rounded-full h-1 overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          {/* Progress text - only show if any completion */}
          {progressPercentage > 0 && (
            <p className="text-xs text-gray-500 text-center">
              {progressPercentage}% complete
            </p>
          )}
        </div>
      )}
    </button>
  );
});

interface BookGridProps {
  books: { book: BookSummary; author: AuthorSummary }[];
  onBookSelect: (book: BookSummary, author: AuthorSummary) => void;
  onScan: () => void;
  onUpload: (files: FileList) => void;
  onVideoUploadClick: () => void;
  isScanning: boolean;
  isUploading: boolean;
}

const BookGrid = memo(function BookGrid({
  books,
  onBookSelect,
  onScan,
  onUpload,
  onVideoUploadClick,
  isScanning,
  isUploading,
}: BookGridProps) {
  const [showInProgressOnly, setShowInProgressOnly] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayedBooks = useMemo(() =>
    showInProgressOnly ? books.filter(({ book }) => book.inProgress) : books,
    [books, showInProgressOnly]
  );

  const inProgressCount = useMemo(() =>
    books.filter(({ book }) => book.inProgress).length,
    [books]
  );

  const totalTracks = useMemo(() =>
    books.reduce((acc, { book }) => acc + book.trackCount, 0),
    [books]
  );

  return (
    <div className="h-full overflow-y-auto bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Library</h1>
          <p className="text-gray-400 mt-1">
            {books.length} book{books.length !== 1 ? "s" : ""} &bull; {totalTracks} tracks
          </p>
        </div>

        {/* Actions toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* In Progress filter */}
          {inProgressCount > 0 && (
            <button
              onClick={() => setShowInProgressOnly(!showInProgressOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                showInProgressOnly
                  ? "bg-yellow-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              In Progress ({inProgressCount})
            </button>
          )}

          <button
            onClick={onScan}
            disabled={isScanning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {isScanning ? (
              <div className="w-4 h-4 border-2 border-gray-500 border-t-gray-300 rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Scan
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {isUploading ? (
              <div className="w-4 h-4 border-2 border-gray-500 border-t-gray-300 rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*,.pdf,.psarc"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onUpload(e.target.files);
                e.target.value = "";
              }
            }}
          />

          <button
            onClick={onVideoUploadClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Videos
          </button>
        </div>
      </div>

      {/* Book Grid */}
      {displayedBooks.length === 0 ? (
        <div className="text-gray-500 text-center py-12">
          {showInProgressOnly ? (
            <>
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg">No books in progress</p>
              <p className="mt-2 text-sm">Open a book and click the clock icon to add it here</p>
            </>
          ) : (
            <>
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <p className="text-lg">No books in your library</p>
              <p className="mt-2 text-sm">Click Scan to discover music or Upload to add files</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {displayedBooks.map(({ book, author }) => (
            <BookCard
              key={book.id}
              book={book}
              authorName={author.name}
              onClick={() => onBookSelect(book, author)}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default BookGrid;
