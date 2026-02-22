"use client";

import { useState, useEffect, useMemo } from "react";
import { AuthorSummary } from "@/types";

interface FavoriteTrack {
  trackId: string;
  title: string;
  bookId: string;
  bookName: string;
  authorId: string;
  authorName: string;
}

interface FavoriteJamTrack {
  jamTrackId: string;
  title: string;
}

interface RecentTrack {
  trackId: string | null;
  jamTrackId: string | null;
  bookVideoId: string | null;
  videoId: string | null;
  title: string;
  bookName: string | null;
  authorId: string | null;
  bookId: string | null;
  lastPracticed: string;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
}

interface Props {
  onGoToTrack: (trackId: string | null, jamTrackId: string | null, authorId: string | null, bookId: string | null, bookVideoId?: string | null, videoId?: string | null) => void;
  authors: AuthorSummary[];
}

export default function HomeView({ onGoToTrack, authors }: Props) {
  const [tracks, setTracks] = useState<FavoriteTrack[]>([]);
  const [jamTracks, setJamTracks] = useState<FavoriteJamTrack[]>([]);
  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [favRes, recentRes] = await Promise.all([
          fetch("/api/favorites"),
          fetch("/api/metrics/top-tracks?days=7&sortBy=lastPracticed&limit=50"),
        ]);
        if (favRes.ok) {
          const data = await favRes.json();
          setTracks(data.tracks);
          setJamTracks(data.jamTracks);
        }
        if (recentRes.ok) {
          setRecentTracks(await recentRes.json());
        }
      } catch {
        // Silently handle errors
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Sort: not-yet-practiced-today first, then already-done-today
  const sortedRecentTracks = useMemo(
    () => [...recentTracks].sort((a, b) => {
      const aToday = isToday(a.lastPracticed) ? 1 : 0;
      const bToday = isToday(b.lastPracticed) ? 1 : 0;
      return aToday - bToday;
    }),
    [recentTracks]
  );

  const inProgressBooks = useMemo(() => {
    const books: { id: string; name: string; authorId: string; authorName: string; completedCount: number; totalCount: number; coverTrackPath: string | null }[] = [];
    for (const author of authors) {
      for (const book of author.books) {
        if (book.inProgress) {
          books.push({
            id: book.id,
            name: book.name,
            authorId: author.id,
            authorName: author.name,
            completedCount: book.completedCount ?? 0,
            totalCount: book.totalCount ?? 0,
            coverTrackPath: book.coverTrackPath ?? null,
          });
        }
      }
    }
    return books;
  }, [authors]);

  const hasFavorites = tracks.length > 0 || jamTracks.length > 0;

  return (
    <div className="h-full overflow-hidden bg-gray-900 p-4 sm:p-6">
      {/* Loading */}
      {isLoading && (
        <div className="max-w-4xl mx-auto space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && (
        <div className="h-full flex flex-col lg:flex-row gap-4 lg:gap-6">
          {/* Left column - 50% */}
          <div className="lg:w-1/2 min-h-0 flex flex-col gap-4">
          {/* What to Practice Next */}
          {sortedRecentTracks.length > 0 && (
            <div className="flex-3 min-h-0 flex flex-col bg-gray-800 rounded-lg border border-gray-700 p-4">
              <h2 className="text-white font-medium mb-3 flex items-center gap-2 shrink-0">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                What to Practice Next
              </h2>
              <div className="space-y-1 overflow-y-auto min-h-0 flex-1">
                {sortedRecentTracks.map((rt) => {
                  const doneToday = isToday(rt.lastPracticed);
                  return (
                    <button
                      key={rt.trackId ?? rt.jamTrackId ?? rt.bookVideoId ?? rt.videoId}
                      onClick={() => onGoToTrack(rt.trackId, rt.jamTrackId, rt.authorId, rt.bookId, rt.bookVideoId, rt.videoId)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-gray-700/50 transition-colors text-left group ${doneToday ? 'opacity-50' : ''}`}
                    >
                      {doneToday ? (
                        <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : rt.videoId ? (
                        <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded shrink-0">YouTube</span>
                      ) : rt.jamTrackId ? (
                        <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded shrink-0">Jam</span>
                      ) : rt.bookVideoId ? (
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded shrink-0">Video</span>
                      ) : (
                        <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      )}
                      <div className="min-w-0 flex-1">
                        <span className={`text-sm truncate block ${doneToday ? 'text-gray-400 line-through' : 'text-white'}`}>{rt.title}</span>
                        {rt.bookName && (
                          <span className="text-gray-500 text-xs truncate block">{rt.bookName}</span>
                        )}
                      </div>
                      <span className="text-gray-500 text-xs shrink-0">{doneToday ? 'Done today' : formatRelativeDate(rt.lastPracticed)}</span>
                      <svg className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* In Progress Books */}
          {inProgressBooks.length > 0 && (
            <div className="flex-1 min-h-0 flex flex-col bg-gray-800 rounded-lg border border-gray-700 p-4">
              <h2 className="text-white font-medium mb-3 flex items-center gap-2 shrink-0">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                In Progress
              </h2>
              <div className="flex flex-wrap gap-3 overflow-y-auto min-h-0 flex-1 content-start">
                {inProgressBooks.map((book) => {
                  const artUrl = book.coverTrackPath ? `/api/albumart/${encodeURIComponent(book.coverTrackPath)}` : null;
                  const progressPct = book.totalCount > 0 ? Math.round((book.completedCount / book.totalCount) * 100) : 0;
                  return (
                    <button
                      key={book.id}
                      onClick={() => onGoToTrack(null, null, book.authorId, book.id)}
                      className="flex flex-col items-center shrink-0 w-32 group"
                    >
                      {artUrl ? (
                        <img
                          src={artUrl}
                          alt={`${book.name} cover`}
                          className="w-32 h-32 rounded-md object-cover bg-gray-700 mb-1.5"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-32 h-32 bg-gray-700 rounded-md flex items-center justify-center mb-1.5">
                          <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                      )}
                      <h3 className="text-white text-[11px] font-medium truncate w-full text-center group-hover:text-green-400 transition-colors">{book.name}</h3>
                      <p className="text-gray-500 text-[10px] truncate w-full text-center">{book.authorName}</p>
                      {book.totalCount > 0 && (
                        <div className="w-full mt-1">
                          <div className="w-full bg-gray-700 rounded-full h-1 overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${progressPct}%` }} />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          </div>

          {/* Favorites - right column - 50% */}
          <div className="lg:w-1/2 min-h-0 flex flex-col">
            <div className="flex items-center gap-3 mb-4 shrink-0">
              <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <h1 className="text-xl font-bold text-white">Favorites</h1>
            </div>

            <div className="space-y-4 overflow-y-auto min-h-0 flex-1">
              {/* Favorites Empty state */}
              {!hasFavorites && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
                  <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <p className="text-gray-400">No favorites yet.</p>
                  <p className="text-gray-500 text-sm mt-1">Star tracks or jam tracks to see them here.</p>
                </div>
              )}

              {/* Favorite Tracks */}
              {tracks.length > 0 && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <h2 className="text-white font-medium mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    Tracks
                  </h2>
                  <div className="space-y-1">
                    {tracks.map((track) => (
                      <button
                        key={track.trackId}
                        onClick={() => onGoToTrack(track.trackId, null, track.authorId, track.bookId)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-gray-700/50 transition-colors text-left group"
                      >
                        <svg className="w-4 h-4 text-yellow-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <div className="min-w-0 flex-1">
                          <span className="text-white text-sm truncate block">{track.title}</span>
                          <span className="text-gray-500 text-xs truncate block">{track.authorName} - {track.bookName}</span>
                        </div>
                        <svg className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Favorite Jam Tracks */}
              {jamTracks.length > 0 && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <h2 className="text-white font-medium mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    Jam Tracks
                  </h2>
                  <div className="space-y-1">
                    {jamTracks.map((jt) => (
                      <button
                        key={jt.jamTrackId}
                        onClick={() => onGoToTrack(null, jt.jamTrackId, null, null)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-gray-700/50 transition-colors text-left group"
                      >
                        <svg className="w-4 h-4 text-yellow-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <div className="min-w-0 flex-1">
                          <span className="text-white text-sm truncate block">{jt.title}</span>
                          <span className="text-xs text-purple-400">Jam Track</span>
                        </div>
                        <svg className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
