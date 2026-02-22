"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  SearchResults,
  SearchResultTrack,
  SearchResultBook,
  SearchResultJamTrack,
} from "@/types";

interface GlobalSearchProps {
  onTrackSelect: (result: SearchResultTrack) => void;
  onBookSelect: (result: SearchResultBook) => void;
  onJamTrackSelect: (result: SearchResultJamTrack) => void;
}

type FlatResult =
  | { type: "book"; data: SearchResultBook }
  | { type: "track"; data: SearchResultTrack }
  | { type: "jamTrack"; data: SearchResultJamTrack };

export default function GlobalSearch({
  onTrackSelect,
  onBookSelect,
  onJamTrackSelect,
}: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flatten results for keyboard navigation
  const flatResults: FlatResult[] = results
    ? [
        ...results.books.map(
          (b) => ({ type: "book" as const, data: b })
        ),
        ...results.tracks.map(
          (t) => ({ type: "track" as const, data: t })
        ),
        ...results.jamTracks.map(
          (jt) => ({ type: "jamTrack" as const, data: jt })
        ),
      ]
    : [];

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setResults(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`
        );
        if (res.ok) {
          const data: SearchResults = await res.json();
          setResults(data);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleSelect = useCallback(
    (item: FlatResult) => {
      switch (item.type) {
        case "track":
          onTrackSelect(item.data);
          break;
        case "book":
          onBookSelect(item.data);
          break;
        case "jamTrack":
          onJamTrackSelect(item.data);
          break;
      }
      setIsOpen(false);
      setQuery("");
      setResults(null);
      inputRef.current?.blur();
    },
    [onTrackSelect, onBookSelect, onJamTrackSelect]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || flatResults.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, flatResults.length - 1)
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (flatResults[selectedIndex]) {
          handleSelect(flatResults[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const hasResults =
    results &&
    (results.tracks.length > 0 ||
      results.books.length > 0 ||
      results.jamTracks.length > 0);

  // Helper to compute the global index for a result item
  const getGlobalIndex = (
    type: "book" | "track" | "jamTrack",
    idx: number
  ) => {
    if (!results) return -1;
    if (type === "book") return idx;
    if (type === "track") return results.books.length + idx;
    return results.books.length + results.tracks.length + idx;
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Input */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (query.length >= 2) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          className="w-full bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Results Dropdown */}
      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl max-h-96 overflow-y-auto z-50">
          {isLoading && (
            <div className="p-3 text-center text-gray-400 text-sm">
              Searching...
            </div>
          )}

          {!isLoading && !hasResults && (
            <div className="p-3 text-center text-gray-400 text-sm">
              No results for &quot;{query}&quot;
            </div>
          )}

          {!isLoading && hasResults && (
            <>
              {/* Books */}
              {results!.books.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase bg-gray-900/50">
                    Books
                  </div>
                  {results!.books.map((book, idx) => {
                    const globalIdx = getGlobalIndex("book", idx);
                    return (
                      <button
                        key={book.id}
                        onClick={() =>
                          handleSelect({ type: "book", data: book })
                        }
                        className={`w-full text-left px-4 py-2 hover:bg-gray-700/50 transition-colors ${
                          selectedIndex === globalIdx
                            ? "bg-gray-700/50"
                            : ""
                        }`}
                      >
                        <div className="text-white text-sm truncate">
                          {book.name}
                        </div>
                        <div className="text-gray-400 text-xs truncate">
                          {book.author.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Tracks */}
              {results!.tracks.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase bg-gray-900/50">
                    Tracks
                  </div>
                  {results!.tracks.map((track, idx) => {
                    const globalIdx = getGlobalIndex("track", idx);
                    return (
                      <button
                        key={track.id}
                        onClick={() =>
                          handleSelect({ type: "track", data: track })
                        }
                        className={`w-full text-left px-4 py-2 hover:bg-gray-700/50 transition-colors ${
                          selectedIndex === globalIdx
                            ? "bg-gray-700/50"
                            : ""
                        }`}
                      >
                        <div className="text-white text-sm truncate">
                          {track.title}
                        </div>
                        <div className="text-gray-400 text-xs truncate">
                          {track.book.author.name} &middot;{" "}
                          {track.book.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Jam Tracks */}
              {results!.jamTracks.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase bg-gray-900/50">
                    Jam Tracks
                  </div>
                  {results!.jamTracks.map((jt, idx) => {
                    const globalIdx = getGlobalIndex("jamTrack", idx);
                    return (
                      <button
                        key={jt.id}
                        onClick={() =>
                          handleSelect({
                            type: "jamTrack",
                            data: jt,
                          })
                        }
                        className={`w-full text-left px-4 py-2 hover:bg-gray-700/50 transition-colors ${
                          selectedIndex === globalIdx
                            ? "bg-gray-700/50"
                            : ""
                        }`}
                      >
                        <div className="text-white text-sm truncate">
                          {jt.title}
                        </div>
                        <div className="text-gray-400 text-xs">
                          Jam Track
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
