"use client";

import { useState } from "react";
import { Book } from "@/types";

export interface BookEditModalProps {
  book: Book;
  authorName: string;
  onClose: () => void;
  onSave: (bookId: string, bookName: string, authorName: string) => Promise<void>;
}

export default function BookEditModal({ book, authorName, onClose, onSave }: BookEditModalProps) {
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
