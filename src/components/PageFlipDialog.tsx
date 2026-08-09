"use client";

import { useEffect, useRef, useState } from "react";

interface PageFlipDialogProps {
  isOpen: boolean;
  timestamp: number;
  defaultPage: number;
  formatTime: (seconds: number) => string;
  onSave: (page: number) => void;
  onCancel: () => void;
  onDelete?: () => void;
  title?: string;
}

export default function PageFlipDialog({
  isOpen,
  timestamp,
  defaultPage,
  formatTime,
  onSave,
  onCancel,
  onDelete,
  title = "Add Page Flip",
}: PageFlipDialogProps) {
  const [pageValue, setPageValue] = useState<string>(String(defaultPage));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPageValue(String(defaultPage));
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, defaultPage]);

  const handleSave = () => {
    const page = parseInt(pageValue, 10);
    if (!Number.isNaN(page) && page >= 1) {
      onSave(page);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  if (!isOpen) return null;

  const page = parseInt(pageValue, 10);
  const isValid = !Number.isNaN(page) && page >= 1;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-xl max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>

        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">
            Time:{" "}
            <span className="text-green-400 font-mono">{formatTime(timestamp)}</span>
          </label>
        </div>

        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">PDF Page</label>
          <input
            ref={inputRef}
            type="number"
            min={1}
            value={pageValue}
            onChange={(e) => setPageValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Page number..."
            className="w-32 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded text-sm mr-auto"
            >
              Delete
            </button>
          )}
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
