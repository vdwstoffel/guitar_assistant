"use client";

import { useState } from "react";
import { Author, Book, Track } from "@/types";

function BookCover({ book }: { book: Book }) {
  const [hasError, setHasError] = useState(false);

  const firstTrack = book.tracks[0];
  const artUrl = firstTrack ? `/api/albumart/${encodeURIComponent(firstTrack.filePath)}` : null;

  if (!artUrl || hasError) {
    return (
      <div className="w-32 h-32 flex-shrink-0 bg-gray-700 rounded-lg flex items-center justify-center">
        <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={artUrl}
      alt={`${book.name} cover`}
      className="w-32 h-32 flex-shrink-0 rounded-lg object-cover bg-gray-700"
      onError={() => setHasError(true)}
    />
  );
}

interface TrackEditModalProps {
  track: Track;
  authorName: string;
  bookName: string;
  bookHasPdf: boolean;
  onClose: () => void;
  onSave: (trackId: string, title: string, author: string, book: string, trackNumber: number, pdfPage?: number | null) => Promise<void>;
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
        <h3 className="text-lg font-semibold mb-4 text-white">Edit Book Info</h3>
        <p className="text-sm text-gray-400 mb-4">
          This will update all {book.tracks.length} track{book.tracks.length !== 1 ? "s" : ""} in this book.
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

function TrackEditModal({ track, authorName, bookName, bookHasPdf, onClose, onSave }: TrackEditModalProps) {
  const [editTitle, setEditTitle] = useState(track.title);
  const [editAuthor, setEditAuthor] = useState(authorName);
  const [editBook, setEditBook] = useState(bookName);
  const [editTrackNumber, setEditTrackNumber] = useState(track.trackNumber || 0);
  const [editPdfPage, setEditPdfPage] = useState<number | null>(track.pdfPage);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!editTitle.trim() || !editAuthor.trim() || !editBook.trim()) return;
    setIsSaving(true);
    try {
      await onSave(track.id, editTitle.trim(), editAuthor.trim(), editBook.trim(), editTrackNumber, editPdfPage);
      onClose();
    } catch (error) {
      console.error("Failed to save track metadata:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
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

interface TrackListViewProps {
  author: Author;
  book: Book;
  currentTrack: Track | null;
  onTrackSelect: (track: Track, author: Author, book: Book) => void;
  onBack: () => void;
  onBookUpdate?: (bookId: string, bookName: string, authorName: string) => Promise<void>;
  onTrackUpdate?: (trackId: string, title: string, author: string, book: string, trackNumber: number, pdfPage?: number | null) => Promise<void>;
  onTrackComplete?: (trackId: string, completed: boolean) => Promise<void>;
  onBookInProgress?: (bookId: string, inProgress: boolean) => Promise<void>;
  onShowPdf?: (pdfPath: string, page?: number) => void;
  onPdfUpload?: (bookId: string, file: File) => Promise<void>;
  onPdfDelete?: (bookId: string) => Promise<void>;
  onPdfConvert?: (bookId: string) => Promise<void>;
}

export default function TrackListView({
  author,
  book,
  currentTrack,
  onTrackSelect,
  onBack,
  onBookUpdate,
  onTrackUpdate,
  onTrackComplete,
  onBookInProgress,
  onShowPdf,
  onPdfUpload,
  onPdfDelete,
  onPdfConvert,
}: TrackListViewProps) {
  const [editingBook, setEditingBook] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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
          onClose={() => setEditingTrack(null)}
          onSave={onTrackUpdate}
        />
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

      {/* Book Header */}
      <div className="flex gap-4 mb-6">
        <BookCover book={book} />
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">{book.name}</h1>
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
          <p className="text-gray-400">{author.name}</p>
          <p className="text-gray-500 text-sm mt-1">
            {book.tracks.length} track{book.tracks.length !== 1 ? "s" : ""}
          </p>

          {/* PDF controls */}
          <div className="flex items-center gap-2 mt-2">
            {book.pdfPath ? (
              <>
                <button
                  onClick={() => onShowPdf?.(book.pdfPath!)}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  View PDF
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

      {/* Track List - Single Column */}
      <div className="flex flex-col gap-1">
        {book.tracks
          .sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0))
          .map((track) => (
            <div
              key={track.id}
              onClick={() => onTrackSelect(track, author, book)}
              onKeyDown={(e) => e.key === "Enter" && onTrackSelect(track, author, book)}
              role="button"
              tabIndex={0}
              className={`flex items-center gap-3 px-3 py-2 rounded transition-colors group cursor-pointer ${
                currentTrack?.id === track.id
                  ? "bg-green-900/50 text-green-400"
                  : "hover:bg-gray-800 text-gray-300"
              }`}
            >
              {/* Track Number / Play Icon */}
              <span className="w-6 text-center text-sm flex-shrink-0">
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
              <span className="flex-1 truncate">
                {track.title}
              </span>

              {/* Completion circle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTrackComplete?.(track.id, !track.completed);
                }}
                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
                  track.completed
                    ? "bg-green-500 border-green-500"
                    : "border-gray-500 hover:border-green-400"
                }`}
                title={track.completed ? "Mark as not completed" : "Mark as completed"}
              >
                {track.completed && (
                  <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              {/* Duration */}
              <span className="text-gray-500 text-sm tabular-nums flex-shrink-0 w-12 text-right">
                {formatDuration(track.duration)}
              </span>

              {/* Edit button */}
              {onTrackUpdate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTrack(track);
                  }}
                  className="p-1 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  title="Edit track info"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
