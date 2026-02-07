"use client";

import { useState, memo } from "react";
import { AuthorSummary, BookSummary } from "@/types";

interface InProgressBookCardProps {
  book: BookSummary;
  author: AuthorSummary;
  onClick: () => void;
}

function InProgressBookCard({ book, author, onClick }: InProgressBookCardProps) {
  const [hasError, setHasError] = useState(false);

  const artUrl = book.coverTrackPath ? `/api/albumart/${encodeURIComponent(book.coverTrackPath)}` : null;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center p-4 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors group text-left w-full"
    >
      {/* Book Cover */}
      {artUrl && !hasError ? (
        <img
          src={artUrl}
          alt={`${book.name} cover`}
          className="w-full aspect-square rounded-lg object-cover bg-gray-700 mb-3"
          onError={() => setHasError(true)}
        />
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
        {author.name}
      </p>

      {/* Track Count */}
      <p className="text-gray-500 text-xs mt-1">
        {book.trackCount} track{book.trackCount !== 1 ? "s" : ""}
      </p>
    </button>
  );
}

interface InProgressGridProps {
  books: { book: BookSummary; author: AuthorSummary }[];
  onBookSelect: (book: BookSummary, author: AuthorSummary) => void;
}

const InProgressGrid = memo(function InProgressGrid({ books, onBookSelect }: InProgressGridProps) {
  return (
    <div className="h-full overflow-y-auto bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          In Progress
        </h1>
        <p className="text-gray-400 mt-1">
          {books.length} book{books.length !== 1 ? "s" : ""} you&apos;re currently working on
        </p>
      </div>

      {books.length === 0 ? (
        <div className="text-gray-500 text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg">No books in progress</p>
          <p className="mt-2 text-sm">Open a book and click the clock icon to add it here</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {books.map(({ book, author }) => (
            <InProgressBookCard
              key={book.id}
              book={book}
              author={author}
              onClick={() => onBookSelect(book, author)}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default InProgressGrid;
