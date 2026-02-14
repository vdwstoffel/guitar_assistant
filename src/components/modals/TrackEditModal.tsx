"use client";

import { useState } from "react";
import { Track, Chapter } from "@/types";

export interface TrackEditModalProps {
  track: Track;
  authorName: string;
  bookName: string;
  bookHasPdf: boolean;
  chapters: Chapter[];
  onClose: () => void;
  onSave: (trackId: string, title: string, author: string, book: string, trackNumber: number, pdfPage?: number | null, tempo?: number | null, timeSignature?: string, chapterId?: string | null) => Promise<void>;
}

export default function TrackEditModal({ track, authorName, bookName, bookHasPdf, chapters, onClose, onSave }: TrackEditModalProps) {
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
