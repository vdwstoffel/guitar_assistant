"use client";

import { useState, memo } from "react";
import { AuthorSummary, BookSummary } from "@/types";

const BookCard = memo(function BookCard({ book, onClick }: { book: BookSummary; onClick: () => void }) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Use coverTrackPath for book cover art
  const artUrl = book.coverTrackPath ? `/api/albumart/${encodeURIComponent(book.coverTrackPath)}` : null;

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

      {/* Track Count */}
      <p className="text-gray-500 text-xs mt-1">
        {book.trackCount} track{book.trackCount !== 1 ? "s" : ""}
      </p>
    </button>
  );
});

interface BookGridProps {
  author: AuthorSummary;
  onBookSelect: (book: BookSummary) => void;
}

export default function BookGrid({ author, onBookSelect }: BookGridProps) {
  return (
    <div className="h-full overflow-y-auto bg-gray-900 p-6">
      {/* Author Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">{author.name}</h1>
        <p className="text-gray-400 mt-1">
          {author.books.length} book{author.books.length !== 1 ? "s" : ""} •{" "}
          {author.books.reduce((acc, book) => acc + book.trackCount, 0)} tracks
        </p>
      </div>

      {/* Book Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {author.books.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            onClick={() => onBookSelect(book)}
          />
        ))}
      </div>
    </div>
  );
}
