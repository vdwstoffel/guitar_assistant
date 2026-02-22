"use client";

import { useEffect, useRef, useState } from "react";

interface MarkerNameDialogProps {
  isOpen: boolean;
  timestamp: number;
  formatTime: (seconds: number) => string;
  onSave: (name: string, pdfPage: number | null) => void;
  onCancel: () => void;
  currentPdfPage?: number | null;
  hasPdf?: boolean;
  // Edit mode: pre-fill with existing values
  initialName?: string;
  initialPdfPage?: number | null;
}

export default function MarkerNameDialog({
  isOpen,
  timestamp,
  formatTime,
  onSave,
  onCancel,
  currentPdfPage,
  hasPdf = false,
  initialName,
  initialPdfPage,
}: MarkerNameDialogProps) {
  const [markerName, setMarkerName] = useState("");
  const [pageNumber, setPageNumber] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditMode = initialName !== undefined;

  useEffect(() => {
    if (isOpen) {
      setMarkerName(initialName ?? "");
      if (initialPdfPage != null) {
        setPageNumber(String(initialPdfPage));
      } else if (!isEditMode && currentPdfPage) {
        setPageNumber(String(currentPdfPage));
      } else {
        setPageNumber("");
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, currentPdfPage, initialName, initialPdfPage, isEditMode]);

  const handleSave = () => {
    const trimmed = markerName.trim();
    if (trimmed) {
      const page = pageNumber ? parseInt(pageNumber, 10) : null;
      onSave(trimmed, Number.isNaN(page) ? null : page);
      setMarkerName("");
      setPageNumber("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && markerName.trim()) {
      handleSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-xl max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-white mb-4">
          {isEditMode ? "Edit Marker" : "Add Marker"}
        </h3>

        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">
            Time: <span className="text-green-400 font-mono">{formatTime(timestamp)}</span>
          </label>
          <input
            ref={inputRef}
            type="text"
            value={markerName}
            onChange={(e) => setMarkerName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter marker name..."
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-green-500"
          />
        </div>

        {hasPdf && (
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              PDF Page <span className="text-gray-500">(optional - triggers page turn)</span>
            </label>
            <input
              type="number"
              min={1}
              value={pageNumber}
              onChange={(e) => setPageNumber(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Page number..."
              className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-green-500"
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!markerName.trim()}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
