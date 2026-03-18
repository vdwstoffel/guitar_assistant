"use client";

import { useState, useEffect, useRef } from "react";

interface InProgressItem {
  trackId: string | null;
  jamTrackId: string | null;
  bookVideoId: string | null;
  videoId: string | null;
  title: string;
  bookName: string | null;
  authorId: string | null;
  bookId: string | null;
  lastPracticed: string | null;
}

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

interface Props {
  onGoToTrack: (
    trackId: string | null,
    jamTrackId: string | null,
    authorId: string | null,
    bookId: string | null,
    bookVideoId?: string | null,
    videoId?: string | null
  ) => void;
}

export default function PracticeNextDropdown({ onGoToTrack }: Props) {
  const [items, setItems] = useState<InProgressItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch data on first hover
  const fetchItems = async () => {
    if (loaded) return;
    try {
      const res = await fetch("/api/in-progress");
      if (res.ok) {
        setItems(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setLoaded(true);
    }
  };

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    fetchItems();
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => setIsOpen(false), 200);
  };

  const handleItemClick = (item: InProgressItem) => {
    onGoToTrack(item.trackId, item.jamTrackId, item.authorId, item.bookId, item.bookVideoId, item.videoId);
    setIsOpen(false);
  };

  const notDoneItems = items.filter((it) => !it.lastPracticed || !isToday(it.lastPracticed));
  const doneItems = items.filter((it) => it.lastPracticed && isToday(it.lastPracticed));

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Button */}
      <button
        onClick={() => { fetchItems(); setIsOpen(!isOpen); }}
        className={`flex items-center gap-1 px-2 py-2 rounded-md text-sm font-medium transition-colors ${
          isOpen
            ? "bg-green-600/20 text-green-400"
            : "text-gray-400 hover:text-green-400 hover:bg-gray-700/50"
        }`}
        title="What to Practice Next"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl max-h-96 overflow-y-auto z-50">
          <div className="px-3 py-2 border-b border-gray-700 flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-sm font-medium text-white">Practice Next</span>
          </div>

          {!loaded && (
            <div className="p-3 text-center text-gray-400 text-sm">Loading...</div>
          )}

          {loaded && items.length === 0 && (
            <div className="p-3 text-center text-gray-400 text-sm">
              No items in progress
            </div>
          )}

          {loaded && items.length > 0 && (
            <div className="py-1">
              {notDoneItems.map((item) => (
                <button
                  key={item.trackId ?? item.jamTrackId ?? item.bookVideoId ?? item.videoId}
                  onClick={() => handleItemClick(item)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-700/50 transition-colors text-left group"
                >
                  {item.videoId ? (
                    <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded shrink-0">YouTube</span>
                  ) : item.jamTrackId ? (
                    <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded shrink-0">Jam</span>
                  ) : item.bookVideoId ? (
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded shrink-0">Video</span>
                  ) : (
                    <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="text-sm text-white truncate block">{item.title}</span>
                    {item.bookName && (
                      <span className="text-gray-500 text-xs truncate block">{item.bookName}</span>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              ))}

              {doneItems.length > 0 && notDoneItems.length > 0 && (
                <div className="border-t border-gray-700 my-1" />
              )}

              {doneItems.map((item) => (
                <button
                  key={item.trackId ?? item.jamTrackId ?? item.bookVideoId ?? item.videoId}
                  onClick={() => handleItemClick(item)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-700/50 transition-colors text-left group opacity-50"
                >
                  <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm text-gray-400 line-through truncate block">{item.title}</span>
                    {item.bookName && (
                      <span className="text-gray-500 text-xs truncate block">{item.bookName}</span>
                    )}
                  </div>
                  <span className="text-gray-500 text-xs shrink-0">Done</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
