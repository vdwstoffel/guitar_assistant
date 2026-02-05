"use client";

import { BookVideo } from "@/types";
import { useState, useRef } from "react";

interface VideoListProps {
  videos: BookVideo[];
  selectedVideo: BookVideo | null;
  onSelectVideo: (video: BookVideo) => void;
  onUploadVideo: (file: File) => Promise<void>;
  onDeleteVideo: (videoId: string) => Promise<void>;
  onUpdateVideo: (videoId: string, filename: string, sortOrder: number, title?: string | null, trackNumber?: number | null, pdfPage?: number | null) => Promise<void>;
  bookHasPdf?: boolean;
  currentPdfPage?: number;
}

export default function VideoList({
  videos,
  selectedVideo,
  onSelectVideo,
  onUploadVideo,
  onDeleteVideo,
  onUpdateVideo,
  bookHasPdf = false,
  currentPdfPage,
}: VideoListProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingOrder, setEditingOrder] = useState(0);
  const [editingTrackNumber, setEditingTrackNumber] = useState<number | null>(null);
  const [editingPdfPage, setEditingPdfPage] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await onUploadVideo(file);
    } catch (error) {
      console.error("Error uploading video:", error);
      alert("Failed to upload video");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (videoId: string, filename: string) => {
    if (!confirm(`Delete "${filename}"?`)) return;

    setDeletingId(videoId);
    try {
      await onDeleteVideo(videoId);
    } catch (error) {
      console.error("Error deleting video:", error);
      alert("Failed to delete video");
    } finally {
      setDeletingId(null);
    }
  };

  const handleStartEdit = (video: BookVideo) => {
    setEditingId(video.id);
    // Remove file extension for editing
    const nameWithoutExt = video.filename.replace(/\.[^/.]+$/, "");
    setEditingName(nameWithoutExt);
    setEditingTitle(video.title || "");
    setEditingOrder(video.sortOrder + 1); // Display as 1-indexed
    setEditingTrackNumber(video.trackNumber ?? null);
    setEditingPdfPage(video.pdfPage ?? null);
  };

  const handleSaveEdit = async (videoId: string, originalFilename: string) => {
    if (!editingName.trim()) {
      alert("Filename cannot be empty");
      return;
    }

    if (editingOrder < 1 || editingOrder > videos.length) {
      alert(`Order must be between 1 and ${videos.length}`);
      return;
    }

    // Add back the file extension
    const ext = originalFilename.match(/\.[^/.]+$/)?.[0] || "";
    const newFilename = editingName.trim() + ext;

    try {
      await onUpdateVideo(
        videoId,
        newFilename,
        editingOrder - 1, // Convert back to 0-indexed
        editingTitle.trim() || null,
        editingTrackNumber,
        editingPdfPage
      );
      setEditingId(null);
      setEditingName("");
      setEditingTitle("");
      setEditingOrder(0);
      setEditingTrackNumber(null);
      setEditingPdfPage(null);
    } catch (error) {
      console.error("Error updating video:", error);
      alert("Failed to update video");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingTitle("");
    setEditingOrder(0);
    setEditingTrackNumber(null);
    setEditingPdfPage(null);
  };

  return (
    <div className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col">
      <div className="p-4 border-b border-neutral-800">
        <h2 className="font-semibold text-white mb-3">Course Videos</h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isUploading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Uploading...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Upload Video
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,.mov,.webm,.m4v"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {videos.length === 0 ? (
          <div className="p-4 text-center text-neutral-500 text-sm">
            No videos yet. Upload one to get started.
          </div>
        ) : (
          <div className="p-2">
            {videos.map((video) => (
              <div
                key={video.id}
                className={`
                  group relative p-3 mb-2 rounded-lg cursor-pointer transition-colors
                  ${
                    selectedVideo?.id === video.id
                      ? "bg-blue-600 text-white"
                      : "bg-neutral-800 hover:bg-neutral-750 text-neutral-200"
                  }
                `}
                onClick={() => onSelectVideo(video)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1 w-8 text-center">
                    {selectedVideo?.id === video.id ? (
                      <svg
                        className="w-5 h-5 mx-auto"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    ) : (
                      <>
                        <span className={`text-sm font-medium group-hover:hidden ${
                          selectedVideo?.id === video.id ? "text-white" : "text-neutral-500"
                        }`}>
                          {video.sortOrder + 1}
                        </span>
                        <svg
                          className="w-5 h-5 mx-auto hidden group-hover:block"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingId === video.id ? (
                      <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                        {/* First row: Order, Filename, Save/Cancel */}
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={videos.length}
                            value={editingOrder}
                            onChange={(e) => setEditingOrder(Math.max(1, Math.min(videos.length, parseInt(e.target.value) || 1)))}
                            className="w-16 px-2 py-1 bg-neutral-700 border border-neutral-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                            title="Video order"
                          />
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveEdit(video.id, video.filename);
                              } else if (e.key === "Escape") {
                                handleCancelEdit();
                              }
                            }}
                            className="flex-1 px-2 py-1 bg-neutral-700 border border-neutral-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                            placeholder="Filename"
                            autoFocus
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveEdit(video.id, video.filename);
                            }}
                            className="p-1 text-green-400 hover:text-green-300 flex-shrink-0"
                            title="Save"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelEdit();
                            }}
                            className="p-1 text-red-400 hover:text-red-300 flex-shrink-0"
                            title="Cancel"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        {/* Second row: Title */}
                        <div className="flex items-center gap-2 pl-[4.5rem]">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveEdit(video.id, video.filename);
                              } else if (e.key === "Escape") {
                                handleCancelEdit();
                              }
                            }}
                            className="flex-1 px-2 py-1 bg-neutral-700 border border-neutral-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                            placeholder="Title (optional)"
                          />
                        </div>
                        {/* Third row: Track Number and PDF Page */}
                        <div className="flex items-center gap-2 pl-[4.5rem]">
                          <input
                            type="number"
                            min={1}
                            value={editingTrackNumber ?? ""}
                            onChange={(e) => setEditingTrackNumber(e.target.value ? parseInt(e.target.value) || null : null)}
                            className="w-20 px-2 py-1 bg-neutral-700 border border-neutral-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                            placeholder="Track #"
                            title="Track number"
                          />
                          {bookHasPdf && (
                            <input
                              type="number"
                              min={1}
                              value={editingPdfPage ?? ""}
                              onChange={(e) => setEditingPdfPage(e.target.value ? parseInt(e.target.value) || null : null)}
                              className="w-20 px-2 py-1 bg-neutral-700 border border-neutral-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                              placeholder="Page"
                              title="PDF page number"
                            />
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium truncate">
                          {video.title || video.filename.replace(/\.[^/.]+$/, "")}
                        </p>
                        {video.trackNumber && (
                          <p className="text-xs text-neutral-500">Track {video.trackNumber}</p>
                        )}
                      </div>
                    )}
                    {video.duration && editingId !== video.id && (
                      <p
                        className={`text-sm mt-1 ${
                          selectedVideo?.id === video.id
                            ? "text-blue-100"
                            : "text-neutral-400"
                        }`}
                      >
                        {formatDuration(video.duration)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {editingId !== video.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(video);
                        }}
                        className={`
                          flex-shrink-0 p-1 rounded hover:bg-blue-600 transition-colors
                          ${
                            selectedVideo?.id === video.id
                              ? "text-white opacity-70 hover:opacity-100"
                              : "text-neutral-400 hover:text-white opacity-0 group-hover:opacity-100"
                          }
                        `}
                        title="Edit video name"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(video.id, video.filename);
                      }}
                      disabled={deletingId === video.id}
                      className={`
                        flex-shrink-0 p-1 rounded hover:bg-red-600 transition-colors
                        ${
                          selectedVideo?.id === video.id
                            ? "text-white opacity-70 hover:opacity-100"
                            : "text-neutral-400 hover:text-white opacity-0 group-hover:opacity-100"
                        }
                      `}
                      title="Delete video"
                    >
                      {deletingId === video.id ? (
                        <svg
                          className="w-4 h-4 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}
