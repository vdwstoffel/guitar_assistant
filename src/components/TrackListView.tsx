"use client";

import { useState, useMemo, memo, useEffect } from "react";
import { AuthorSummary, Book, Track, BookVideo, Chapter } from "@/types";
import ChapterSection from "./ChapterSection";
import InProgressIndicator from "./InProgressIndicator";
import { formatDuration } from "@/lib/formatting";
import BookEditModal from "./modals/BookEditModal";
import TrackEditModal from "./modals/TrackEditModal";
import VideoEditModal from "./modals/VideoEditModal";
import ChapterEditModal from "./modals/ChapterEditModal";

const BookCover = memo(function BookCover({ book }: { book: Book }) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const artUrl = book.coverTrackPath ? `/api/albumart/${encodeURIComponent(book.coverTrackPath)}` : null;

  if (!artUrl || hasError) {
    return (
      <div className="w-24 h-24 sm:w-32 sm:h-32 shrink-0 bg-gray-700 rounded-lg flex items-center justify-center">
        <svg className="w-10 h-10 sm:w-12 sm:h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      </div>
    );
  }

  return (
    <div className="relative w-24 h-24 sm:w-32 sm:h-32 shrink-0">
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-700 rounded-lg flex items-center justify-center">
          <div className="w-6 h-6 border-3 border-gray-600 border-t-gray-400 rounded-full animate-spin"></div>
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
  );
});

interface TrackListViewProps {
  author: AuthorSummary;
  book: Book;
  currentTrack: Track | null;
  selectedVideo: BookVideo | null;
  showVideo: boolean;
  onTrackSelect: (track: Track, author: AuthorSummary, book: Book) => void;
  onVideoSelect: (video: BookVideo) => void;
  onToggleVideo: () => void;
  onBack: () => void;
  onBookUpdate?: (bookId: string, bookName: string, authorName: string) => Promise<void>;
  onTrackUpdate?: (trackId: string, title: string, author: string, book: string, trackNumber: number, pdfPage?: number | null, tempo?: number | null, timeSignature?: string, chapterId?: string | null) => Promise<void>;
  onTrackComplete?: (trackId: string, completed: boolean) => Promise<void>;
  onBookInProgress?: (bookId: string, inProgress: boolean) => Promise<void>;
  onShowPdf?: (pdfPath: string, page?: number) => void;
  onPdfUpload?: (bookId: string, file: File) => Promise<void>;
  onPdfDelete?: (bookId: string) => Promise<void>;
  onPdfConvert?: (bookId: string) => Promise<void>;
  currentPdfPage?: number;
  onAssignPdfPage?: (trackId: string, page: number) => Promise<void>;
  onVideoUpload?: (bookId: string, file: File) => Promise<void>;
  onVideoDelete?: (bookId: string, videoId: string) => Promise<void>;
  onVideoUpdate?: (bookId: string, videoId: string, filename: string, sortOrder: number, title?: string | null, trackNumber?: number | null, pdfPage?: number | null, chapterId?: string | null) => Promise<void>;
  onVideoComplete?: (bookId: string, videoId: string, completed: boolean) => Promise<void>;
  onLibraryRefresh?: () => Promise<void>;
}

export default memo(function TrackListView({
  author,
  book,
  currentTrack,
  selectedVideo,
  showVideo,
  onTrackSelect,
  onVideoSelect,
  onToggleVideo,
  onBack,
  onBookUpdate,
  onTrackUpdate,
  onTrackComplete,
  onBookInProgress,
  onShowPdf,
  onPdfUpload,
  onPdfDelete,
  onPdfConvert,
  currentPdfPage,
  onAssignPdfPage,
  onVideoUpload,
  onVideoDelete,
  onVideoUpdate,
  onVideoComplete,
  onLibraryRefresh,
}: TrackListViewProps) {
  const [editingBook, setEditingBook] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [editingVideo, setEditingVideo] = useState<BookVideo | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [mediaTab, setMediaTab] = useState<"audio" | "video">("audio");

  // Chapter management state
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [newChapterName, setNewChapterName] = useState("");
  const [isCreatingChapter, setIsCreatingChapter] = useState(false);
  const [chapterFromTrack, setChapterFromTrack] = useState<string>("");
  const [chapterToTrack, setChapterToTrack] = useState<string>("");

  // Load expanded state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`expanded-chapters-${book.id}`);
    if (saved) {
      setExpandedChapters(new Set(JSON.parse(saved)));
    } else {
      // Default: expand the first chapter
      const firstChapter = book.chapters?.[0];
      setExpandedChapters(firstChapter ? new Set([firstChapter.id]) : new Set());
    }
  }, [book.id, book.chapters]);

  // Save expanded state to localStorage
  useEffect(() => {
    localStorage.setItem(
      `expanded-chapters-${book.id}`,
      JSON.stringify(Array.from(expandedChapters))
    );
  }, [expandedChapters, book.id]);

  // Determine if the book has both audio tracks and videos (to show tabs)
  const allBookVideos = useMemo(() => {
    const videos = [...(book.videos || [])];
    for (const chapter of book.chapters || []) {
      videos.push(...chapter.videos);
    }
    return videos;
  }, [book.videos, book.chapters]);

  // Compute all tracks in the book (uncategorized + all chapters)
  const allBookTracks = useMemo(() => {
    const tracks = [...(book.tracks || [])];
    for (const chapter of book.chapters || []) {
      tracks.push(...chapter.tracks);
    }
    return tracks;
  }, [book.tracks, book.chapters]);

  // Calculate book completion progress
  const bookProgress = useMemo(() => {
    const completedTracks = allBookTracks.filter(t => t.completed).length;
    const completedVideos = allBookVideos.filter(v => v.completed).length;
    const totalTracks = allBookTracks.length;
    const totalVideos = allBookVideos.length;
    const totalItems = totalTracks + totalVideos;
    const completedItems = completedTracks + completedVideos;

    const percentage = totalItems > 0
      ? Math.round((completedItems / totalItems) * 100)
      : 0;

    return {
      completedTracks,
      totalTracks,
      completedVideos,
      totalVideos,
      totalItems,
      completedItems,
      percentage
    };
  }, [allBookTracks, allBookVideos]);

  const hasMediaTabs = allBookTracks.length > 0 && allBookVideos.length > 0;
  const mediaFilter = hasMediaTabs ? mediaTab : undefined;

  // Compute tracks matching the from/to range for chapter creation
  const matchingTrackIds = useMemo(() => {
    const from = chapterFromTrack ? parseInt(chapterFromTrack, 10) : null;
    const to = chapterToTrack ? parseInt(chapterToTrack, 10) : null;
    if (from === null && to === null) return [];
    if (from !== null && isNaN(from)) return [];
    if (to !== null && isNaN(to)) return [];
    const low = from ?? to!;
    const high = to ?? from!;
    return allBookTracks
      .filter((t) => t.trackNumber >= low && t.trackNumber <= high)
      .map((t) => t.id);
  }, [allBookTracks, chapterFromTrack, chapterToTrack]);

  // Compute videos matching the from/to range for chapter creation
  const matchingVideoIds = useMemo(() => {
    const from = chapterFromTrack ? parseInt(chapterFromTrack, 10) : null;
    const to = chapterToTrack ? parseInt(chapterToTrack, 10) : null;
    if (from === null && to === null) return [];
    if (from !== null && isNaN(from)) return [];
    if (to !== null && isNaN(to)) return [];
    const low = from ?? to!;
    const high = to ?? from!;
    return allBookVideos
      .filter((v) => v.trackNumber && v.trackNumber >= low && v.trackNumber <= high)
      .map((v) => v.id);
  }, [allBookVideos, chapterFromTrack, chapterToTrack]);


  const toggleChapterExpanded = (chapterId: string) => {
    setExpandedChapters(prev => {
      if (prev.has(chapterId)) {
        return new Set();
      }
      return new Set([chapterId]);
    });
  };

  const handleCreateChapter = async () => {
    if (!newChapterName.trim()) return;
    setIsCreatingChapter(true);
    try {
      const payload: { name: string; trackIds?: string[]; videoIds?: string[] } = {
        name: newChapterName.trim(),
      };
      if (matchingTrackIds.length > 0) {
        payload.trackIds = matchingTrackIds;
      }
      if (matchingVideoIds.length > 0) {
        payload.videoIds = matchingVideoIds;
      }

      const res = await fetch(`/api/books/${book.id}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to create chapter");

      setNewChapterName("");
      setChapterFromTrack("");
      setChapterToTrack("");
      setShowAddChapter(false);
      await onLibraryRefresh?.();
    } catch (error) {
      console.error("Failed to create chapter:", error);
      alert("Failed to create chapter");
    } finally {
      setIsCreatingChapter(false);
    }
  };

  const handleEditChapter = async (chapterId: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      const res = await fetch(`/api/chapters/${chapterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (!res.ok) throw new Error("Failed to update chapter");

      setEditingChapter(null);
      await onLibraryRefresh?.();
    } catch (error) {
      console.error("Failed to update chapter:", error);
      alert("Failed to update chapter");
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    try {
      const res = await fetch(`/api/chapters/${chapterId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete chapter");

      await onLibraryRefresh?.();
    } catch (error) {
      console.error("Failed to delete chapter:", error);
      throw error;
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-900 p-6">
      {/* Book Edit Modal */}
      {editingBook && onBookUpdate && (
        <BookEditModal
          book={book}
          authorName={author.name}
          onClose={() => setEditingBook(false)}
          onSave={onBookUpdate}
        />
      )}

      {/* Track Edit Modal */}
      {editingTrack && onTrackUpdate && (
        <TrackEditModal
          track={editingTrack}
          authorName={author.name}
          bookName={book.name}
          bookHasPdf={!!book.pdfPath}
          chapters={book.chapters || []}
          onClose={() => setEditingTrack(null)}
          onSave={onTrackUpdate}
        />
      )}

      {/* Video Edit Modal */}
      {editingVideo && onVideoUpdate && (
        <VideoEditModal
          video={editingVideo}
          bookHasPdf={!!book.pdfPath}
          chapters={book.chapters || []}
          onClose={() => setEditingVideo(null)}
          onSave={async (videoId, filename, sortOrder, title, trackNumber, pdfPage, chapterId) => {
            await onVideoUpdate(book.id, videoId, filename, sortOrder, title, trackNumber, pdfPage, chapterId);
          }}
          onDelete={onVideoDelete ? async (videoId) => {
            await onVideoDelete(book.id, videoId);
          } : undefined}
        />
      )}

      {/* Chapter Edit Modal */}
      {editingChapter && (
        <ChapterEditModal
          chapter={editingChapter}
          onClose={() => setEditingChapter(null)}
          onSave={handleEditChapter}
        />
      )}

      {/* Add Chapter Modal */}
      {showAddChapter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-white">Add New Chapter</h3>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Chapter Name</label>
              <input
                type="text"
                value={newChapterName}
                onChange={(e) => setNewChapterName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="e.g., Chapter 1: Basic Techniques"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreateChapter()}
              />
            </div>
            <div className="mt-4">
              <label className="block text-sm text-gray-400 mb-1">Include Tracks (optional)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={chapterFromTrack}
                  onChange={(e) => setChapterFromTrack(e.target.value)}
                  className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500"
                  placeholder="From #"
                  min={1}
                />
                <span className="text-gray-400">to</span>
                <input
                  type="number"
                  value={chapterToTrack}
                  onChange={(e) => setChapterToTrack(e.target.value)}
                  className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500"
                  placeholder="To #"
                  min={1}
                />
              </div>
              {(matchingTrackIds.length > 0 || matchingVideoIds.length > 0) && (
                <p className="text-sm text-purple-400 mt-1">
                  {matchingTrackIds.length > 0 && `${matchingTrackIds.length} track${matchingTrackIds.length !== 1 ? "s" : ""}`}
                  {matchingTrackIds.length > 0 && matchingVideoIds.length > 0 && " and "}
                  {matchingVideoIds.length > 0 && `${matchingVideoIds.length} video${matchingVideoIds.length !== 1 ? "s" : ""}`}
                  {" will be added"}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddChapter(false);
                  setNewChapterName("");
                  setChapterFromTrack("");
                  setChapterToTrack("");
                }}
                disabled={isCreatingChapter}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateChapter}
                disabled={isCreatingChapter || !newChapterName.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors text-white"
              >
                {isCreatingChapter ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to books
      </button>

      {/* Book Header - Stack on mobile, side-by-side on sm+ */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-6">
        <BookCover book={book} />
        <div className="flex flex-col justify-center text-center sm:text-left flex-1">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white">{book.name}</h1>
            {onBookInProgress && (
              <button
                onClick={() => onBookInProgress(book.id, !book.inProgress)}
                className={`p-1 rounded transition-colors ${
                  book.inProgress
                    ? "text-yellow-400 hover:text-yellow-300 bg-yellow-400/10"
                    : "text-gray-400 hover:text-yellow-400 hover:bg-gray-700"
                }`}
                title={book.inProgress ? "Remove from In Progress" : "Add to In Progress"}
              >
                <svg className="w-4 h-4" fill={book.inProgress ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            )}
            {onBookUpdate && (
              <button
                onClick={() => setEditingBook(true)}
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title="Edit book info"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-sm sm:text-base text-gray-400">{author.name}</p>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            {book.trackCount} track{book.trackCount !== 1 ? "s" : ""}
          </p>

          {/* Book Progress - Show if there are any tracks or videos */}
          {bookProgress.totalItems > 0 && (
            <div className="mt-2 space-y-1">
              {/* Progress Bar */}
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${bookProgress.percentage}%` }}
                />
              </div>

              {/* Progress Text */}
              <div className="flex items-center justify-between text-xs sm:text-sm text-gray-400">
                <span>
                  {bookProgress.completedItems} of {bookProgress.totalItems} completed
                </span>
                <span className="font-medium text-green-400">
                  {bookProgress.percentage}%
                </span>
              </div>

              {/* Detailed breakdown if both tracks and videos exist */}
              {bookProgress.totalTracks > 0 && bookProgress.totalVideos > 0 && (
                <div className="text-xs text-gray-500">
                  {bookProgress.completedTracks}/{bookProgress.totalTracks} tracks · {bookProgress.completedVideos}/{bookProgress.totalVideos} videos
                </div>
              )}
            </div>
          )}

          {/* PDF controls */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
            {book.pdfPath ? (
              <>
                <button
                  onClick={() => {
                    if (selectedVideo) {
                      // Toggle between video and PDF when a video is selected
                      onToggleVideo();
                    } else {
                      // Just show PDF when no video is selected
                      onShowPdf?.(book.pdfPath!);
                    }
                  }}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showVideo ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    )}
                  </svg>
                  {showVideo ? "View PDF" : (selectedVideo ? "View Video" : "View PDF")}
                </button>
                {onPdfConvert && (
                  <button
                    onClick={async () => {
                      setIsConverting(true);
                      try {
                        await onPdfConvert(book.id);
                      } finally {
                        setIsConverting(false);
                      }
                    }}
                    disabled={isConverting}
                    className="text-xs text-yellow-400 hover:text-yellow-300 disabled:text-gray-500"
                    title="Convert PDF to fix rendering issues"
                  >
                    {isConverting ? "Converting..." : "Fix PDF"}
                  </button>
                )}
                <button
                  onClick={() => onPdfDelete?.(book.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </>
            ) : onPdfUpload && (
              <label className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300 cursor-pointer">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add PDF
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onPdfUpload(book.id, file);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>

        </div>
      </div>

      {/* Audio/Video Tab Bar */}
      {hasMediaTabs && (
        <div className="flex gap-1 mb-4 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setMediaTab("audio")}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              mediaTab === "audio"
                ? "bg-green-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            Audio
          </button>
          <button
            onClick={() => setMediaTab("video")}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              mediaTab === "video"
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Video
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 mb-4">
        {hasMediaTabs && mediaTab === "video" && onVideoUpload && (
          <label className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white transition-colors cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Upload Video
            <input
              type="file"
              accept=".mp4,.mov,.webm,.m4v"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onVideoUpload(book.id, file);
                e.target.value = '';
              }}
            />
          </label>
        )}
        <button
          onClick={() => setShowAddChapter(true)}
          className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Chapter
        </button>
      </div>

      {/* Chapters */}
      {book.chapters && book.chapters.length > 0 && (
        <div className="mb-4">
          {book.chapters
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((chapter) => (
              <ChapterSection
                key={chapter.id}
                chapter={chapter}
                author={author}
                book={book}
                currentTrack={currentTrack}
                selectedVideo={selectedVideo}
                bookHasPdf={!!book.pdfPath}
                currentPdfPage={currentPdfPage}
                isExpanded={expandedChapters.has(chapter.id)}
                mediaFilter={mediaFilter}
                onToggleExpanded={() => toggleChapterExpanded(chapter.id)}
                onTrackSelect={onTrackSelect}
                onVideoSelect={onVideoSelect}
                onTrackComplete={onTrackComplete}
                onVideoComplete={onVideoComplete}
                onAssignPdfPage={onAssignPdfPage}
                onTrackUpdate={(track) => setEditingTrack(track)}
                onVideoUpdate={(video) => setEditingVideo(video)}
                onVideoAssignPdfPage={async (bookId, video, page) => {
                  if (onVideoUpdate) {
                    await onVideoUpdate(bookId, video.id, video.filename, video.sortOrder, video.title, video.trackNumber, page);
                  }
                }}
                onChapterEdit={setEditingChapter}
                onChapterDelete={handleDeleteChapter}
                onShowPdf={onShowPdf}
                onToggleVideo={onToggleVideo}
                showVideo={showVideo}
              />
            ))}
        </div>
      )}

      {/* Uncategorized Tracks and Videos */}
      {(() => {
        const uncategorizedTracks = mediaFilter === "video" ? [] : book.tracks;
        const uncategorizedVideos = mediaFilter === "audio" ? [] : (book.videos || []);
        const hasUncategorized = uncategorizedTracks.length > 0 || uncategorizedVideos.length > 0;

        if (!hasUncategorized) return null;

        return (
          <>
            <h3 className="text-sm font-semibold text-gray-400 mb-2 px-3">Uncategorized</h3>
            <div className="flex flex-col gap-1">
              {/* Audio Tracks */}
              {uncategorizedTracks
                .sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0))
                .map((track) => (
                  <div
                    key={track.id}
                    onClick={() => onTrackSelect(track, author, book)}
                    onKeyDown={(e) => e.key === "Enter" && onTrackSelect(track, author, book)}
                    role="button"
                    tabIndex={0}
                    className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded transition-colors group cursor-pointer ${
                      currentTrack?.id === track.id
                        ? "bg-green-900/50 text-green-400"
                        : "hover:bg-gray-800 text-gray-300"
                    }`}
                  >
              {/* Track Number / Play Icon */}
              <span className="w-6 text-center text-xs sm:text-sm flex-shrink-0">
                {currentTrack?.id === track.id ? (
                  <svg className="w-4 h-4 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ) : (
                  <>
                    <span className="text-gray-500 group-hover:hidden">
                      {track.trackNumber || "-"}
                    </span>
                    <svg className="w-4 h-4 mx-auto hidden group-hover:block text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </>
                )}
              </span>

              {/* Track Title */}
              <span className="flex-1 truncate text-sm sm:text-base">
                {track.title}
              </span>

              {/* In Progress indicator */}
              <InProgressIndicator
                trackId={track.id}
                completed={track.completed}
                playbackSpeed={track.playbackSpeed}
              />

              {/* Completion circle - Larger touch target on mobile */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTrackComplete?.(track.id, !track.completed);
                }}
                className={`w-11 h-11 xl:w-6 xl:h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                  track.completed
                    ? "bg-green-500"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
                title={track.completed ? "Mark as not completed" : "Mark as completed"}
              >
                <div className={`w-5 h-5 xl:w-full xl:h-full rounded-full border-2 ${
                  track.completed ? "bg-green-500 border-green-500" : "border-gray-500"
                }`}>
                  {track.completed && (
                    <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>

              {/* Duration and PDF page */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Page number or assignment icon */}
                {book.pdfPath && (
                  track.pdfPage ? (
                    <span className="text-xs text-gray-500 w-8 text-right">p.{track.pdfPage}</span>
                  ) : onAssignPdfPage && currentPdfPage ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAssignPdfPage(track.id, currentPdfPage);
                      }}
                      className="p-0.5 text-gray-500 hover:text-blue-400 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity w-8 flex justify-end"
                      title={`Assign current PDF page (${currentPdfPage})`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                  ) : (
                    <span className="w-8" />
                  )
                )}
                <span className="text-gray-500 text-sm tabular-nums w-12 text-right">
                  {formatDuration(track.duration)}
                </span>
              </div>

              {/* Chapter assignment dropdown */}
              {book.chapters && book.chapters.length > 0 && (
                <select
                  value=""
                  onChange={async (e) => {
                    e.stopPropagation();
                    const chapterId = e.target.value || null;
                    try {
                      await fetch(`/api/tracks/${track.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chapterId }),
                      });
                      await onLibraryRefresh?.();
                    } catch (error) {
                      console.error('Failed to assign chapter:', error);
                    }
                  }}
                  className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:outline-none focus:border-purple-500 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  title="Move to chapter"
                >
                  <option value="">Move to...</option>
                  {book.chapters.sort((a, b) => a.sortOrder - b.sortOrder).map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.name}
                    </option>
                  ))}
                </select>
              )}

              {/* Edit button - Always visible on mobile, hover on desktop */}
              {onTrackUpdate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTrack(track);
                  }}
                  className="p-2 xl:p-1 text-gray-500 hover:text-white xl:opacity-0 xl:group-hover:opacity-100 transition-opacity flex-shrink-0"
                  title="Edit track info"
                >
                  <svg className="w-5 h-5 xl:w-4 xl:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
          ))}

          {/* Videos */}
          {uncategorizedVideos.length > 0 && uncategorizedVideos
            .sort((a, b) => (a.trackNumber || a.sortOrder) - (b.trackNumber || b.sortOrder))
            .map((video) => (
                  <div
                    key={video.id}
                    onClick={() => onVideoSelect(video)}
                    onKeyDown={(e) => e.key === "Enter" && onVideoSelect(video)}
                    role="button"
                    tabIndex={0}
                    className={`flex items-center gap-3 px-3 py-2 rounded transition-colors group cursor-pointer ${
                      selectedVideo?.id === video.id
                        ? "bg-blue-900/50 text-blue-400"
                        : "hover:bg-gray-800 text-gray-300"
                    }`}
                  >
                    {/* Video Number / Icon */}
                    <span className="w-6 text-center text-sm flex-shrink-0">
                      {selectedVideo?.id === video.id ? (
                        <svg className="w-4 h-4 mx-auto text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      ) : (
                        <>
                          <span className="text-gray-500 group-hover:hidden">
                            {video.trackNumber || "V"}
                          </span>
                          <svg className="w-4 h-4 mx-auto hidden group-hover:block text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </>
                      )}
                    </span>

                    {/* Video Title */}
                    <span className="flex-1 truncate">
                      {video.title || video.filename.replace(/\.[^/.]+$/, '')}
                    </span>

                    {/* Quick action icons */}
                    <div className="flex items-center gap-1">
                      {/* Book icon - jump to PDF page */}
                      {book.pdfPath && video.pdfPage && onShowPdf && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // If video is showing, toggle to PDF view
                            if (showVideo && onToggleVideo) {
                              onToggleVideo();
                            }
                            onShowPdf(book.pdfPath!, video.pdfPage!);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                          title={`Jump to PDF page ${video.pdfPage}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </button>
                      )}

                      {/* Camera icon - play video */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // If PDF is showing, toggle to video view
                          if (!showVideo && onToggleVideo) {
                            onToggleVideo();
                          }
                          onVideoSelect(video);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                        title="Play video"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>

                    {/* Completion circle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onVideoComplete?.(book.id, video.id, !video.completed);
                      }}
                      className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
                        video.completed
                          ? "bg-green-500 border-green-500"
                          : "border-gray-500 hover:border-green-400"
                      }`}
                      title={video.completed ? "Mark as not completed" : "Mark as completed"}
                    >
                      {video.completed && (
                        <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    {/* Duration and PDF page */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Page number or assignment icon */}
                      {book.pdfPath && (
                        video.pdfPage ? (
                          <span className="text-xs text-gray-500 w-8 text-right">p.{video.pdfPage}</span>
                        ) : onAssignPdfPage && currentPdfPage ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // We'll need to add a video page assignment handler
                              if (onVideoUpdate) {
                                onVideoUpdate(book.id, video.id, video.filename, video.sortOrder, video.title, video.trackNumber, currentPdfPage);
                              }
                            }}
                            className="p-0.5 text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity w-8 flex justify-end"
                            title={`Assign current PDF page (${currentPdfPage})`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                        ) : (
                          <span className="w-8" />
                        )
                      )}
                      {video.duration && (
                        <span className="text-gray-500 text-sm tabular-nums w-12 text-right">
                          {formatDuration(video.duration)}
                        </span>
                      )}
                    </div>

                    {/* Chapter assignment dropdown */}
                    {book.chapters && book.chapters.length > 0 && (
                      <select
                        value=""
                        onChange={async (e) => {
                          e.stopPropagation();
                          const chapterId = e.target.value || null;
                          try {
                            await fetch(`/api/books/${book.id}/videos/${video.id}/update`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                filename: video.filename,
                                sortOrder: video.sortOrder,
                                title: video.title,
                                trackNumber: video.trackNumber,
                                pdfPage: video.pdfPage,
                                chapterId
                              }),
                            });
                            await onLibraryRefresh?.();
                          } catch (error) {
                            console.error('Failed to assign chapter:', error);
                          }
                        }}
                        className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:outline-none focus:border-purple-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                        title="Move to chapter"
                      >
                        <option value="">Move to...</option>
                        {book.chapters.sort((a, b) => a.sortOrder - b.sortOrder).map((chapter) => (
                          <option key={chapter.id} value={chapter.id}>
                            {chapter.name}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Edit button */}
                    {onVideoUpdate && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingVideo(video);
                        }}
                        className="p-1 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        title="Edit video info"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </>
        );
      })()}
    </div>
  );
});
