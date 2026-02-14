"use client";

import { useState } from "react";
import { Chapter } from "@/types";

export interface ChapterEditModalProps {
  chapter: Chapter;
  onClose: () => void;
  onSave: (chapterId: string, name: string) => Promise<void>;
}

export default function ChapterEditModal({ chapter, onClose, onSave }: ChapterEditModalProps) {
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
