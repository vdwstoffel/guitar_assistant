"use client";

import { useState, useMemo, memo } from "react";
import { AuthorSummary, BookSummary } from "@/types";
import { getBookCoverUrl } from "@/lib/covers";

const BookCard = memo(function BookCard({ book, authorName, onClick }: { book: BookSummary; authorName: string; onClick: () => void }) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const artUrl = getBookCoverUrl(book);

  // Calculate progress percentage
  const progressPercentage = book.totalCount && book.totalCount > 0
    ? Math.round((book.completedCount || 0) / book.totalCount * 100)
    : 0;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors group text-left w-full"
    >
      {/* Book Cover */}
      {artUrl && !hasError ? (
        <div className="relative w-40 h-52 mb-3">
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
        <div className="w-40 h-52 bg-gray-700 rounded-lg flex items-center justify-center mb-3">
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
        {book.trackCount === 0 && book.pdfPath
          ? "PDF only"
          : `${book.trackCount} track${book.trackCount !== 1 ? "s" : ""}`}
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
  onUploadClick: () => void;
  isScanning: boolean;
  isUploading: boolean;
}

type SortOption = "author" | "book" | "completion";

const BookGrid = memo(function BookGrid({
  books,
  onBookSelect,
  onScan,
  onUploadClick,
  isScanning,
  isUploading,
}: BookGridProps) {
  const [sortBy, setSortBy] = useState<SortOption>("author");

  const sortBooks = (list: { book: BookSummary; author: AuthorSummary }[]) => {
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "author":
          return a.author.name.localeCompare(b.author.name) || a.book.name.localeCompare(b.book.name);
        case "book":
          return a.book.name.localeCompare(b.book.name);
        case "completion": {
          const aPct = a.book.totalCount ? (a.book.completedCount || 0) / a.book.totalCount : 0;
          const bPct = b.book.totalCount ? (b.book.completedCount || 0) / b.book.totalCount : 0;
          return bPct - aPct || a.book.name.localeCompare(b.book.name);
        }
      }
    });
  };

  const { inProgressBooks, otherBooks } = useMemo(() => {
    const ip = books.filter(({ book }) => book.inProgress);
    const other = books.filter(({ book }) => !book.inProgress);
    return { inProgressBooks: sortBooks(ip), otherBooks: sortBooks(other) };
  }, [books, sortBy]);

  const totalTracks = useMemo(() =>
    books.reduce((acc, { book }) => acc + book.trackCount, 0),
    [books]
  );

  return (
    <div className="h-full overflow-y-auto bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Lessons</h1>
          <p className="text-gray-400 mt-1">
            {books.length} book{books.length !== 1 ? "s" : ""} &bull; {totalTracks} tracks
          </p>
        </div>

        {/* Actions toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sort options */}
          <div className="flex gap-0.5 bg-gray-800 rounded-lg p-0.5">
            {([
              { value: "author" as SortOption, label: "Author" },
              { value: "book" as SortOption, label: "Book" },
              { value: "completion" as SortOption, label: "Completion" },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  sortBy === opt.value
                    ? "bg-gray-700 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

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
            onClick={onUploadClick}
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

        </div>
      </div>

      {/* Book Grid */}
      {books.length === 0 ? (
        <div className="text-gray-500 text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <p className="text-lg">No books in your library</p>
          <p className="mt-2 text-sm">Click Scan to discover music or Upload to add files</p>
        </div>
      ) : (
        <div className="space-y-6">
          {inProgressBooks.length > 0 && (
            <div className="flex flex-col items-center">
              <h2 className="text-sm font-medium text-yellow-400 mb-3 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                In Progress ({inProgressBooks.length})
              </h2>
              <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                {inProgressBooks.map(({ book, author }) => (
                  <div key={book.id} className="w-[150px] sm:w-[200px]">
                    <BookCard
                      book={book}
                      authorName={author.name}
                      onClick={() => onBookSelect(book, author)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {otherBooks.length > 0 && (
            <div>
              {inProgressBooks.length > 0 && (
                <h2 className="text-sm font-medium text-gray-400 mb-3">All Books</h2>
              )}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,200px))] gap-2 sm:gap-3">
                {otherBooks.map(({ book, author }) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    authorName={author.name}
                    onClick={() => onBookSelect(book, author)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default BookGrid;
