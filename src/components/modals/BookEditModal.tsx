"use client";

import { useState, useRef } from "react";
import { Book } from "@/types";
import { getBookCoverUrl } from "@/lib/covers";

export interface BookEditModalProps {
  book: Book;
  authorName: string;
  onClose: () => void;
  onSave: (bookId: string, bookName: string, authorName: string) => Promise<void>;
  onCoverUpload?: (bookId: string, file: File) => Promise<void>;
  onCoverDelete?: (bookId: string) => Promise<void>;
}

export default function BookEditModal({ book, authorName, onClose, onSave, onCoverUpload, onCoverDelete }: BookEditModalProps) {
  const [editBookName, setEditBookName] = useState(book.name);
  const [editAuthorName, setEditAuthorName] = useState(authorName);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentCoverUrl = coverPreview || getBookCoverUrl(book);

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

  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onCoverUpload) return;

    // Show preview immediately
    const previewUrl = URL.createObjectURL(file);
    setCoverPreview(previewUrl);

    setIsUploadingCover(true);
    try {
      await onCoverUpload(book.id, file);
    } catch (error) {
      console.error("Failed to upload cover:", error);
      setCoverPreview(null);
    } finally {
      setIsUploadingCover(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCoverDelete = async () => {
    if (!onCoverDelete) return;
    setIsUploadingCover(true);
    try {
      await onCoverDelete(book.id);
      setCoverPreview(null);
    } catch (error) {
      console.error("Failed to delete cover:", error);
    } finally {
      setIsUploadingCover(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        <h3 className="text-lg font-semibold mb-4 text-white">Edit Book Info</h3>

        {/* Cover Upload Section */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative w-24 h-24 shrink-0">
            {currentCoverUrl ? (
              <img
                src={currentCoverUrl}
                alt="Book cover"
                className="w-24 h-24 rounded-lg object-cover bg-gray-700"
              />
            ) : (
              <div className="w-24 h-24 bg-gray-700 rounded-lg flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
            )}
            {isUploadingCover && (
              <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-gray-400 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingCover || !onCoverUpload}
              className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-gray-300 hover:text-white transition-colors"
            >
              Upload Cover
            </button>
            {book.customCoverPath && onCoverDelete && (
              <button
                type="button"
                onClick={handleCoverDelete}
                disabled={isUploadingCover}
                className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
              >
                Remove Cover
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleCoverSelect}
          />
        </div>

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
