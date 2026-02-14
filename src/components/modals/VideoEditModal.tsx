"use client";

import { useState } from "react";
import { BookVideo, Chapter } from "@/types";

export interface VideoEditModalProps {
  video: BookVideo;
  bookHasPdf: boolean;
  chapters: Chapter[];
  onClose: () => void;
  onSave: (videoId: string, filename: string, sortOrder: number, title: string | null, trackNumber: number | null, pdfPage: number | null, chapterId: string | null) => Promise<void>;
  onDelete?: (videoId: string) => Promise<void>;
}

export default function VideoEditModal({ video, bookHasPdf, chapters, onClose, onSave, onDelete }: VideoEditModalProps) {
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
