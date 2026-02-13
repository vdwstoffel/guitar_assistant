"use client";

import { useState, useMemo, memo, useEffect } from "react";
import { AuthorSummary, Book, Track, BookVideo, Chapter } from "@/types";
import ChapterSection from "./ChapterSection";

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

const InProgressIndicator = memo(function InProgressIndicator({
  trackId,
  completed,
  onClear
}: {
  trackId: string;
  completed: boolean;
  onClear?: () => void;
}) {
  const [speed, setSpeed] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(`playbackSpeed_${trackId}`);
    setSpeed(stored ? parseInt(stored) : null);

    // Listen for playback speed changes
    const handleSpeedChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ trackId: string; speed: number }>;
      if (customEvent.detail.trackId === trackId) {
        setSpeed(customEvent.detail.speed);
      }
    };

    window.addEventListener('playbackSpeedChange', handleSpeedChange);
    return () => {
      window.removeEventListener('playbackSpeedChange', handleSpeedChange);
    };
  }, [trackId]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.removeItem(`playbackSpeed_${trackId}`);
    setSpeed(null);
    onClear?.();
  };

  // Don't show if completed or no practice speed
  if (completed || !speed) return null;

  return (
    <button
      onClick={handleClick}
      className="relative flex items-center justify-center min-w-[2.5rem] h-5 px-1.5 rounded-full border border-amber-500/50 bg-amber-900/30 flex-shrink-0 transition-colors hover:bg-amber-500/20"
      title={`Practicing at ${speed}% - Click to clear practice progress`}
    >
      <span className="text-[10px] font-medium text-amber-400 whitespace-nowrap">
        {speed}%
      </span>
    </button>
  );
});

interface TrackEditModalProps {
  track: Track;
  authorName: string;
  bookName: string;
  bookHasPdf: boolean;
  chapters: Chapter[];
  onClose: () => void;
  onSave: (trackId: string, title: string, author: string, book: string, trackNumber: number, pdfPage?: number | null, tempo?: number | null, timeSignature?: string, chapterId?: string | null) => Promise<void>;
}

interface BookEditModalProps {
  book: Book;
  authorName: string;
  onClose: () => void;
  onSave: (bookId: string, bookName: string, authorName: string) => Promise<void>;
}

function BookEditModal({ book, authorName, onClose, onSave }: BookEditModalProps) {
  const [editBookName, setEditBookName] = useState(book.name);
  const [editAuthorName, setEditAuthorName] = useState(authorName);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!editBookName.trim() || !editAuthorName.trim()) return;
    setIsSaving(true);
    try {
      await onSave(book.id, editBookName.trim(), editAuthorName.trim());
      onClose();
    } catch (error) {
      console.error("Failed to save book metadata:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        <h3 className="text-lg font-semibold mb-4 text-white">Edit Book Info</h3>
        <p className="text-sm text-gray-400 mb-4">
          This will update all {book.trackCount} track{book.trackCount !== 1 ? "s" : ""} in this book.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Book Name</label>
            <input
              type="text"
              value={editBookName}
              onChange={(e) => setEditBookName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-green-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Author Name</label>
            <input
              type="text"
              value={editAuthorName}
              onChange={(e) => setEditAuthorName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-green-500"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !editBookName.trim() || !editAuthorName.trim()}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors text-white"
          >
            {isSaving ? "Saving..." : "Save All"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TrackEditModal({ track, authorName, bookName, bookHasPdf, chapters, onClose, onSave }: TrackEditModalProps) {
  const [editTitle, setEditTitle] = useState(track.title);
  const [editAuthor, setEditAuthor] = useState(authorName);
  const [editBook, setEditBook] = useState(bookName);
  const [editTrackNumber, setEditTrackNumber] = useState(track.trackNumber || 0);
  const [editPdfPage, setEditPdfPage] = useState<number | null>(track.pdfPage);
  const [editTempo, setEditTempo] = useState<number | null>(track.tempo);
  const [editTimeSignature, setEditTimeSignature] = useState(track.timeSignature || "4/4");
  const [editChapterId, setEditChapterId] = useState<string | null>(track.chapterId || null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!editTitle.trim() || !editAuthor.trim() || !editBook.trim()) return;
    setIsSaving(true);
    try {
      await onSave(track.id, editTitle.trim(), editAuthor.trim(), editBook.trim(), editTrackNumber, editPdfPage, editTempo, editTimeSignature, editChapterId);
      onClose();
    } catch (error) {
      console.error("Failed to save track metadata:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        <h3 className="text-lg font-semibold mb-4 text-white">Edit Track Info</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-green-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Author</label>
            <input
              type="text"
              value={editAuthor}
              onChange={(e) => setEditAuthor(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-green-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Book</label>
            <input
              type="text"
              value={editBook}
              onChange={(e) => setEditBook(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-green-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Track Number</label>
            <input
              type="number"
              min={0}
              value={editTrackNumber}
              onChange={(e) => setEditTrackNumber(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-green-500"
            />
          </div>
          {bookHasPdf && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">PDF Page</label>
              <input
                type="number"
                min={1}
                value={editPdfPage ?? ''}
                onChange={(e) => setEditPdfPage(e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : null)}
                placeholder="Auto"
                className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">Opens this page when track plays</p>
            </div>
          )}
          <div className="flex gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Tempo (BPM)</label>
              <input
                type="number"
                min={20}
                max={300}
                value={editTempo ?? ''}
                onChange={(e) => setEditTempo(e.target.value ? Math.min(300, Math.max(20, parseInt(e.target.value) || 20)) : null)}
                placeholder="None"
                className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Time Signature</label>
              <select
                value={editTimeSignature}
                onChange={(e) => setEditTimeSignature(e.target.value)}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-green-500"
              >
                <option value="4/4">4/4</option>
                <option value="3/4">3/4</option>
                <option value="2/4">2/4</option>
                <option value="6/8">6/8</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500">Set tempo for click track count-in when jumping to markers</p>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Chapter</label>
          <select
            value={editChapterId || ""}
            onChange={(e) => setEditChapterId(e.target.value || null)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-green-500"
          >
            <option value="">Uncategorized</option>
            {chapters.sort((a, b) => a.sortOrder - b.sortOrder).map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">Assign track to a chapter</p>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !editTitle.trim() || !editAuthor.trim() || !editBook.trim()}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors text-white"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface VideoEditModalProps {
  video: BookVideo;
  bookHasPdf: boolean;
  chapters: Chapter[];
  onClose: () => void;
  onSave: (videoId: string, filename: string, sortOrder: number, title: string | null, trackNumber: number | null, pdfPage: number | null, chapterId: string | null) => Promise<void>;
  onDelete?: (videoId: string) => Promise<void>;
}

function VideoEditModal({ video, bookHasPdf, chapters, onClose, onSave, onDelete }: VideoEditModalProps) {
  const [editFilename, setEditFilename] = useState(video.filename.replace(/\.[^/.]+$/, ""));
  const [editTitle, setEditTitle] = useState(video.title || "");
  const [editTrackNumber, setEditTrackNumber] = useState<number | null>(video.trackNumber);
  const [editPdfPage, setEditPdfPage] = useState<number | null>(video.pdfPage);
  const [editChapterId, setEditChapterId] = useState<string | null>(video.chapterId || null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Get the file extension
      const ext = video.filename.match(/\.[^/.]+$/)?.[0] || "";

      // Format filename based on track number and title
      let newFilename: string;
      const titleToUse = editTitle.trim() || editFilename.trim();

      if (editTrackNumber && titleToUse) {
        // Format: "001 - Title.ext"
        const paddedTrackNumber = String(editTrackNumber).padStart(3, '0');
        newFilename = `${paddedTrackNumber} - ${titleToUse}${ext}`;
      } else if (editTrackNumber) {
        // Just track number: "001.ext"
        const paddedTrackNumber = String(editTrackNumber).padStart(3, '0');
        newFilename = `${paddedTrackNumber}${ext}`;
      } else if (titleToUse) {
        // Just title: "Title.ext"
        newFilename = `${titleToUse}${ext}`;
      } else {
        // Fallback to original filename
        alert("Please provide either a title or track number");
        setIsSaving(false);
        return;
      }

      await onSave(
        video.id,
        newFilename,
        video.sortOrder,
        editTitle.trim() || null,
        editTrackNumber,
        editPdfPage,
        editChapterId
      );
      onClose();
    } catch (error) {
      console.error("Failed to save video metadata:", error);
      alert("Failed to save video");
    } finally {
      setIsSaving(false);
    }
  };

  // Generate filename preview
  const getFilenamePreview = () => {
    const ext = video.filename.match(/\.[^/.]+$/)?.[0] || "";
    const titleToUse = editTitle.trim() || editFilename.trim();

    if (editTrackNumber && titleToUse) {
      const paddedTrackNumber = String(editTrackNumber).padStart(3, '0');
      return `${paddedTrackNumber} - ${titleToUse}${ext}`;
    } else if (editTrackNumber) {
      const paddedTrackNumber = String(editTrackNumber).padStart(3, '0');
      return `${paddedTrackNumber}${ext}`;
    } else if (titleToUse) {
      return `${titleToUse}${ext}`;
    }
    return video.filename;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        <h3 className="text-lg font-semibold mb-4 text-white">Edit Video Info</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Track Number</label>
            <input
              type="number"
              min={1}
              value={editTrackNumber ?? ''}
              onChange={(e) => setEditTrackNumber(e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : null)}
              placeholder="None"
              className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Used for sorting and filename formatting</p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
              placeholder="Display title"
            />
            <p className="text-xs text-gray-500 mt-1">Shown in UI and used for filename</p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Fallback Filename</label>
            <input
              type="text"
              value={editFilename}
              onChange={(e) => setEditFilename(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
              placeholder="Used if title is empty"
            />
            <p className="text-xs text-gray-500 mt-1">Only used when title is not set</p>
          </div>
          {bookHasPdf && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">PDF Page</label>
              <input
                type="number"
                min={1}
                value={editPdfPage ?? ''}
                onChange={(e) => setEditPdfPage(e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : null)}
                placeholder="None"
                className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Opens this page when video is selected</p>
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Chapter</label>
            <select
              value={editChapterId || ""}
              onChange={(e) => setEditChapterId(e.target.value || null)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Uncategorized</option>
              {chapters.sort((a, b) => a.sortOrder - b.sortOrder).map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Assign video to a chapter</p>
          </div>
          <div className="pt-2 border-t border-gray-700">
            <label className="block text-sm text-gray-400 mb-1">Filename Preview</label>
            <div className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-blue-400 text-sm font-mono">
              {getFilenamePreview()}
            </div>
            <p className="text-xs text-gray-500 mt-1">Auto-formatted as: [Track#] - [Title].ext</p>
          </div>
        </div>
        {confirmingDelete ? (
          <div className="mt-6 border border-red-800 bg-red-950/50 rounded-lg p-4">
            <p className="text-sm text-red-300 mb-3">
              Delete <span className="font-medium text-white">{video.title || video.filename}</span>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Keep
              </button>
              <button
                onClick={async () => {
                  if (!onDelete) return;
                  setIsDeleting(true);
                  try {
                    await onDelete(video.id);
                    onClose();
                  } catch (error) {
                    console.error("Failed to delete video:", error);
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed rounded font-medium transition-colors text-white"
              >
                {isDeleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center mt-6">
            {onDelete ? (
              <button
                onClick={() => setConfirmingDelete(true)}
                disabled={isSaving}
                className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors disabled:text-gray-600"
              >
                Delete
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !editFilename.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors text-white"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ChapterEditModalProps {
  chapter: Chapter;
  onClose: () => void;
  onSave: (chapterId: string, name: string) => Promise<void>;
}

function ChapterEditModal({ chapter, onClose, onSave }: ChapterEditModalProps) {
  const [editName, setEditName] = useState(chapter.name);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!editName.trim()) return;
    setIsSaving(true);
    try {
      await onSave(chapter.id, editName.trim());
      onClose();
    } catch (error) {
      console.error("Failed to save chapter:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        <h3 className="text-lg font-semibold mb-4 text-white">Edit Chapter Name</h3>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Chapter Name</label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !editName.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors text-white"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

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

export default function TrackListView({
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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

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
}
