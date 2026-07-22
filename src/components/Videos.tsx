"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Video } from "@/types";
import { usePracticeSessionTracker } from "@/hooks/usePracticeSessionTracker";
import NotesModal from "./modals/NotesModal";
import MarkerNameDialog from "./MarkerNameDialog";
import { formatDurationLong } from "@/lib/formatting";
import { routeMediaElementToSink, subscribeToAudioSinkChanges } from "@/lib/audioSink";

interface VideoMarker {
  id: string;
  name: string;
  timestamp: number;
  videoId: string;
}

// CategorySection component (mirrors ChapterSection pattern)
interface CategorySectionProps {
  label: string;
  videos: Video[];
  isExpanded: boolean;
  activeVideoId: string | null;
  editingId: string | null;
  editTitle: string;
  editingCategory: string | null;
  existingCategories: string[];
  categoryIndex: number;
  onToggleExpanded: () => void;
  onVideoClick: (video: Video) => void;
  onEditStart: (video: Video) => void;
  onUpdateVideo: (id: string) => Promise<void>;
  onEditCancel: () => void;
  onDelete: (id: string, e: React.MouseEvent) => Promise<void>;
  onDragStart: (index: number) => void;
  onDragEnter: (index: number) => void;
  onDragEnd: () => Promise<void>;
  onCategoryChange: (value: string) => void;
  onCategoryDragStart: (index: number) => void;
  onCategoryDragEnter: (index: number) => void;
  onCategoryDragEnd: () => void;
  onToggleInProgress: (video: Video) => void;
  onNotesOpen: (video: Video) => void;
  onDownload: (video: Video) => void;
  onRemoveDownload: (video: Video) => void;
  downloadingIds: Set<string>;
  category: string | null;
  onAssignVideoToCategory: (videoId: string, newCategory: string | null) => Promise<void>;
  isEmptyCustom: boolean;
  onDeleteEmptyCategory?: () => void;
}

function CategorySection({
  label,
  videos,
  isExpanded,
  activeVideoId,
  editingId,
  editTitle,
  editingCategory,
  existingCategories,
  categoryIndex,
  onToggleExpanded,
  onVideoClick,
  onEditStart,
  onUpdateVideo,
  onEditCancel,
  onDelete,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onCategoryChange,
  onCategoryDragStart,
  onCategoryDragEnter,
  onCategoryDragEnd,
  onToggleInProgress,
  onNotesOpen,
  onDownload,
  onRemoveDownload,
  downloadingIds,
  category,
  onAssignVideoToCategory,
  isEmptyCustom,
  onDeleteEmptyCategory,
}: CategorySectionProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleHeaderDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-guitar-video")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!isDragOver) setIsDragOver(true);
    } else {
      e.preventDefault();
    }
  };

  const handleHeaderDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleHeaderDrop = async (e: React.DragEvent) => {
    setIsDragOver(false);
    const raw = e.dataTransfer.getData("application/x-guitar-video");
    if (!raw) return;
    e.preventDefault();
    try {
      const { id, fromCategory } = JSON.parse(raw) as { id: string; fromCategory: string | null };
      if (fromCategory === category) return;
      await onAssignVideoToCategory(id, category);
    } catch (err) {
      console.error("Failed to move video to category:", err);
    }
  };

  return (
    <div>
      {/* Category Header */}
      <div
        draggable={label !== "Uncategorized"}
        onDragStart={() => onCategoryDragStart(categoryIndex)}
        onDragEnter={() => onCategoryDragEnter(categoryIndex)}
        onDragEnd={onCategoryDragEnd}
        onDragOver={handleHeaderDragOver}
        onDragLeave={handleHeaderDragLeave}
        onDrop={handleHeaderDrop}
        className={`flex items-center gap-2 px-3 py-2 rounded-t transition-colors ${
          isDragOver
            ? "bg-purple-700 ring-2 ring-purple-400"
            : "bg-gray-800 hover:bg-gray-750"
        } ${label !== "Uncategorized" ? "cursor-move" : ""}`}
      >
        <button
          onClick={onToggleExpanded}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${
              isExpanded ? "rotate-90" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-semibold text-white">{label}</span>
          <span className="text-sm text-gray-500">
            ({videos.length} video{videos.length !== 1 ? "s" : ""})
          </span>
        </button>
        {isEmptyCustom && onDeleteEmptyCategory && (
          <button
            onClick={onDeleteEmptyCategory}
            className="p-1 text-gray-500 hover:text-red-400 transition-colors"
            title="Delete empty category"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Category Content */}
      {isExpanded && (
        <div className="border-l-2 border-gray-700 ml-3 pl-2">
          {videos.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500 italic">
              Drag a video here to add to this category
            </div>
          )}
          {videos.map((video, index) => (
            <div
              key={video.id}
              onDragEnter={() => onDragEnter(index)}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => onVideoClick(video)}
              className={`group flex items-center gap-2 px-3 py-2 rounded cursor-pointer ${
                activeVideoId === video.id
                  ? "bg-green-900/50 text-green-400"
                  : "hover:bg-gray-800 text-gray-300"
              }`}
            >
              {/* Drag Handle */}
              <div
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData(
                    "application/x-guitar-video",
                    JSON.stringify({ id: video.id, fromCategory: category })
                  );
                  onDragStart(index);
                }}
                onDragEnd={onDragEnd}
                className="text-gray-500 cursor-move"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
              </div>

              {/* Title or Edit Form */}
              {editingId === video.id ? (
                <div className="flex-1 space-y-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => {
                      const event = e as React.ChangeEvent<HTMLInputElement>;
                      onEditStart({ ...video, title: event.target.value });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onUpdateVideo(video.id);
                      if (e.key === "Escape") onEditCancel();
                    }}
                    className="w-full px-2 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-green-500"
                    autoFocus
                  />
                  <input
                    type="text"
                    list="category-suggestions-edit"
                    value={editingCategory || ""}
                    onChange={(e) => onCategoryChange(e.target.value.trim())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onUpdateVideo(video.id);
                      if (e.key === "Escape") onEditCancel();
                    }}
                    placeholder="Category (leave empty for uncategorized)"
                    className="w-full px-2 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-green-500"
                  />
                  <datalist id="category-suggestions-edit">
                    {existingCategories.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
              ) : (
                <span className="flex-1 truncate text-sm">{video.title}</span>
              )}

              {/* Actions */}
              {editingId === video.id ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateVideo(video.id);
                  }}
                  className="p-1 text-green-500 hover:text-green-400"
                  title="Save"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              ) : (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleInProgress(video);
                    }}
                    className={`p-1 rounded transition-colors ${
                      video.inProgress
                        ? "text-amber-400 hover:text-amber-300"
                        : "text-gray-500 hover:text-amber-400 opacity-0 group-hover:opacity-100"
                    }`}
                    title={video.inProgress ? "Remove from In Progress" : "Add to In Progress"}
                  >
                    <svg className="w-3.5 h-3.5" fill={video.inProgress ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNotesOpen(video);
                    }}
                    className={`p-1 ${video.notes ? 'text-blue-400' : 'text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100'}`}
                    title={video.notes ? "Edit notes" : "Add notes"}
                  >
                    <svg className="w-3.5 h-3.5" fill={video.notes ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </button>
                  {downloadingIds.has(video.id) ? (
                    <span
                      className="p-1 text-blue-400"
                      title="Downloading..."
                    >
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </span>
                  ) : video.localPath ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveDownload(video);
                      }}
                      className="p-1 text-emerald-400 hover:text-red-400"
                      title="Downloaded — click to remove local copy"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownload(video);
                      }}
                      className="p-1 text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100"
                      title="Download for offline playback"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditStart(video);
                    }}
                    className="p-1 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100"
                    title="Edit"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </>
              )}
              <button
                onClick={(e) => onDelete(video.id, e)}
                className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100"
                title="Delete"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface VideosProps {
  initialVideoId?: string | null;
}

export default function Videos({ initialVideoId }: VideosProps) {
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [notesVideo, setNotesVideo] = useState<Video | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const dragCategory = useRef<string | null>(null);
  const dragCategoryIndex = useRef<number | null>(null);
  const dragOverCategoryIndex = useRef<number | null>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const htmlVideoRef = useRef<HTMLVideoElement | null>(null);
  const ytApiReady = useRef(false);
  const pendingVideoId = useRef<string | null>(null);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [showMarkerDialog, setShowMarkerDialog] = useState(false);
  const [pendingMarkerTimestamp, setPendingMarkerTimestamp] = useState(0);
  const [leadIn, setLeadIn] = useState(2);
  const wasPlayingBeforeDialogRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("videoMarkerLeadIn");
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (!Number.isNaN(parsed)) setLeadIn(Math.max(0, parsed));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("videoMarkerLeadIn", String(leadIn));
  }, [leadIn]);

  useEffect(() => {
    return subscribeToAudioSinkChanges(() => {
      void routeMediaElementToSink(htmlVideoRef.current);
    });
  }, []);

  const [markers, setMarkers] = useState<VideoMarker[]>([]);
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [editMarkerName, setEditMarkerName] = useState("");

  // Get unique categories from existing videos for suggestions
  const existingCategories = useMemo(() => {
    const categories = new Set<string>();
    videos.forEach((video) => {
      if (video.category) {
        categories.add(video.category);
      }
    });
    // Only show categories that actually exist in videos (no predefined suggestions)
    return Array.from(categories).sort();
  }, [videos]);

  // Group videos by category
  const videosByCategory = useMemo(() => {
    const grouped = new Map<string | null, Video[]>();

    // Group videos by category
    videos.forEach((video) => {
      const cat = video.category || null;
      if (!grouped.has(cat)) {
        grouped.set(cat, []);
      }
      grouped.get(cat)!.push(video);
    });

    // Ensure user-created empty categories are present
    customCategories.forEach((cat) => {
      if (!grouped.has(cat)) {
        grouped.set(cat, []);
      }
    });

    // Sort within each category by sortOrder
    grouped.forEach((vids) => {
      vids.sort((a, b) => a.sortOrder - b.sortOrder);
    });

    // Get all categories
    const allCategories = Array.from(grouped.keys()).filter(cat => cat !== null) as string[];

    // Order categories based on saved order, then add new ones at the end
    const orderedCategories: (string | null)[] = [];

    // Add categories in saved order
    if (categoryOrder.length > 0) {
      categoryOrder.forEach(cat => {
        if (allCategories.includes(cat)) {
          orderedCategories.push(cat);
        }
      });
    }

    // Add any new categories not in saved order (alphabetically)
    const newCategories = allCategories
      .filter(cat => !categoryOrder.includes(cat))
      .sort();
    orderedCategories.push(...newCategories);

    // Uncategorized always last
    if (grouped.has(null)) {
      orderedCategories.push(null);
    }

    // Return in custom order with Uncategorized last
    return orderedCategories.map((cat) => ({
      category: cat,
      label: cat || "Uncategorized",
      videos: grouped.get(cat)!,
    }));
  }, [videos, categoryOrder, customCategories]);

  // Load category order from localStorage
  useEffect(() => {
    const savedOrder = localStorage.getItem("video-category-order");
    if (savedOrder) {
      setCategoryOrder(JSON.parse(savedOrder));
    }
    const savedCustom = localStorage.getItem("video-custom-categories");
    if (savedCustom) {
      try { setCustomCategories(JSON.parse(savedCustom)); } catch { /* ignore */ }
    }
  }, []);

  // Save category order to localStorage
  useEffect(() => {
    if (categoryOrder.length > 0) {
      localStorage.setItem("video-category-order", JSON.stringify(categoryOrder));
    }
  }, [categoryOrder]);

  // Save custom categories to localStorage
  useEffect(() => {
    localStorage.setItem("video-custom-categories", JSON.stringify(customCategories));
  }, [customCategories]);

  // Load expanded state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("expanded-video-categories");
    if (saved) {
      setExpandedCategories(new Set(JSON.parse(saved)));
    } else {
      // Default: expand first category
      if (videosByCategory.length > 0) {
        setExpandedCategories(new Set([videosByCategory[0].label]));
      }
    }
  }, []);

  // Save expanded state to localStorage
  useEffect(() => {
    localStorage.setItem(
      "expanded-video-categories",
      JSON.stringify(Array.from(expandedCategories))
    );
  }, [expandedCategories]);

  useEffect(() => {
    fetchVideos();
  }, []);

  useEffect(() => {
    const url = activeVideoId ? `/videos?video=${activeVideoId}` : "/videos";
    router.replace(url, { scroll: false });
  }, [activeVideoId, router]);

  const fetchVideos = async () => {
    try {
      const response = await fetch("/api/videos");
      if (response.ok) {
        const data = await response.json();
        setVideos(data);
        // Auto-select first video if none selected
        if (data.length > 0 && !activeVideoId) {
          setActiveVideoId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching videos:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCategoryExpanded = (category: string) => {
    setExpandedCategories((prev) => {
      if (prev.has(category)) {
        return new Set(); // Close if already open
      }
      return new Set([category]); // Open only this one, close all others (accordion)
    });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;

    setIsAdding(true);
    setError(null);

    try {
      const response = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          youtubeUrl: newUrl,
          category: newCategory,
        }),
      });

      if (response.ok) {
        const video = await response.json();
        setVideos([...videos, video]);
        setNewTitle("");
        setNewUrl("");
        setNewCategory(null);
        setShowAddForm(false);
        setActiveVideoId(video.id);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to add video");
      }
    } catch (err) {
      setError("Failed to add video");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/videos/${id}`, { method: "DELETE" });
      if (response.ok) {
        const newVideos = videos.filter((v) => v.id !== id);
        setVideos(newVideos);
        if (activeVideoId === id) {
          setActiveVideoId(newVideos.length > 0 ? newVideos[0].id : null);
        }
      }
    } catch (err) {
      console.error("Error deleting video:", err);
    }
  };

  const handleDownload = async (video: Video) => {
    if (downloadingIds.has(video.id) || video.localPath) return;
    setDownloadingIds((prev) => new Set(prev).add(video.id));
    try {
      const res = await fetch(`/api/videos/${video.id}/download`, { method: "POST" });
      if (res.ok) {
        const updated = await res.json();
        setVideos((prev) => prev.map((v) => (v.id === video.id ? updated : v)));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to download video");
      }
    } catch (err) {
      console.error("Error downloading video:", err);
      alert("Failed to download video");
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(video.id);
        return next;
      });
    }
  };

  const handleRemoveDownload = async (video: Video) => {
    if (!video.localPath) return;
    if (!confirm(`Remove the local copy of "${video.title}"? Playback will fall back to YouTube streaming.`)) return;
    try {
      const res = await fetch(`/api/videos/${video.id}/download`, { method: "DELETE" });
      if (res.ok) {
        const updated = await res.json();
        setVideos((prev) => prev.map((v) => (v.id === video.id ? updated : v)));
      }
    } catch (err) {
      console.error("Error removing downloaded video:", err);
    }
  };

  const handleToggleInProgress = async (video: Video) => {
    try {
      const response = await fetch(`/api/videos/${video.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: video.title, inProgress: !video.inProgress }),
      });
      if (response.ok) {
        const updated = await response.json();
        setVideos(videos.map((v) => (v.id === video.id ? updated : v)));
      }
    } catch (err) {
      console.error("Error toggling in-progress:", err);
    }
  };

  const handleUpdateVideo = async (id: string) => {
    if (!editTitle.trim()) return;

    try {
      const response = await fetch(`/api/videos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          category: editingCategory,
        }),
      });

      if (response.ok) {
        const updatedVideo = await response.json();
        setVideos(videos.map((v) => (v.id === id ? updatedVideo : v)));
        setEditingId(null);
        setEditingCategory(null);
      }
    } catch (err) {
      console.error("Error updating video:", err);
    }
  };

  const handleAddCustomCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setCustomCategories((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setExpandedCategories(new Set([name]));
    setNewCategoryName("");
    setShowAddCategoryForm(false);
  };

  const handleDeleteEmptyCategory = (categoryName: string) => {
    setCustomCategories((prev) => prev.filter((c) => c !== categoryName));
    setCategoryOrder((prev) => prev.filter((c) => c !== categoryName));
  };

  const handleAssignVideoToCategory = async (videoId: string, newCategoryValue: string | null) => {
    const video = videos.find((v) => v.id === videoId);
    if (!video) return;
    try {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: video.title, category: newCategoryValue }),
      });
      if (response.ok) {
        const updated = await response.json();
        setVideos((prev) => prev.map((v) => (v.id === videoId ? updated : v)));
        setExpandedCategories(new Set([newCategoryValue || "Uncategorized"]));
        if (newCategoryValue) {
          setCustomCategories((prev) => prev.filter((c) => c !== newCategoryValue));
        }
      }
    } catch (err) {
      console.error("Error assigning video to category:", err);
      alert("Failed to move video to category");
    }
  };

  const handleDragStart = (categoryLabel: string, index: number) => {
    dragItem.current = index;
    dragCategory.current = categoryLabel;
  };

  const handleDragEnter = (categoryLabel: string, index: number) => {
    // Only allow drop within same category
    if (dragCategory.current === categoryLabel) {
      dragOverItem.current = index;
    }
  };

  const handleDragEnd = async (categoryLabel: string) => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;
    if (dragCategory.current !== categoryLabel) return;

    // Find videos in this category
    const categoryGroup = videosByCategory.find((g) => g.label === categoryLabel);
    if (!categoryGroup) return;

    const categoryVideos = [...categoryGroup.videos];
    const draggedItem = categoryVideos[dragItem.current];
    categoryVideos.splice(dragItem.current, 1);
    categoryVideos.splice(dragOverItem.current, 0, draggedItem);

    // Rebuild entire videos array from all categories with the updated category
    const newVideos: Video[] = [];
    videosByCategory.forEach((group) => {
      if (group.label === categoryLabel) {
        // Use reordered videos for this category
        newVideos.push(...categoryVideos);
      } else {
        // Keep original order for other categories
        newVideos.push(...group.videos);
      }
    });

    dragItem.current = null;
    dragOverItem.current = null;
    dragCategory.current = null;

    try {
      await fetch("/api/videos/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoIds: newVideos.map((v) => v.id) }),
      });
      // Refetch to get updated sortOrder values
      await fetchVideos();
    } catch (err) {
      console.error("Error reordering videos:", err);
      fetchVideos();
    }
  };

  const handleCategoryDragStart = (index: number) => {
    dragCategoryIndex.current = index;
  };

  const handleCategoryDragEnter = (index: number) => {
    dragOverCategoryIndex.current = index;
  };

  const handleCategoryDragEnd = () => {
    if (dragCategoryIndex.current === null || dragOverCategoryIndex.current === null) return;
    if (dragCategoryIndex.current === dragOverCategoryIndex.current) return;

    const newOrder = [...videosByCategory.map(c => c.label)];
    const draggedCategory = newOrder[dragCategoryIndex.current];
    newOrder.splice(dragCategoryIndex.current, 1);
    newOrder.splice(dragOverCategoryIndex.current, 0, draggedCategory);

    // Filter out "Uncategorized" from the saved order
    const orderToSave = newOrder.filter(cat => cat !== "Uncategorized");
    setCategoryOrder(orderToSave);

    dragCategoryIndex.current = null;
    dragOverCategoryIndex.current = null;
  };

  const activeVideo = videos.find((v) => v.id === activeVideoId);

  // Fetch markers for the active video
  useEffect(() => {
    if (!activeVideoId) {
      setMarkers([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/videos/${activeVideoId}/markers`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => { if (!cancelled) setMarkers(data); })
      .catch(() => { if (!cancelled) setMarkers([]); });
    return () => { cancelled = true; };
  }, [activeVideoId]);

  const getPlayerCurrentTime = (): number | null => {
    if (htmlVideoRef.current) return htmlVideoRef.current.currentTime;
    if (playerRef.current) {
      try { return playerRef.current.getCurrentTime(); } catch { return null; }
    }
    return null;
  };

  const seekPlayerTo = (timestamp: number) => {
    const target = Math.max(0, timestamp - leadIn);
    if (htmlVideoRef.current) {
      htmlVideoRef.current.currentTime = target;
      htmlVideoRef.current.play().catch(() => { /* play may be blocked */ });
      return;
    }
    if (playerRef.current) {
      try {
        playerRef.current.seekTo(target, true);
        playerRef.current.playVideo();
      } catch { /* player may not be ready */ }
    }
  };

  const isPlayerPlaying = (): boolean => {
    if (htmlVideoRef.current) return !htmlVideoRef.current.paused;
    if (playerRef.current) {
      try { return playerRef.current.getPlayerState() === 1; } catch { return false; }
    }
    return false;
  };

  const pausePlayer = () => {
    if (htmlVideoRef.current) { htmlVideoRef.current.pause(); return; }
    if (playerRef.current) { try { playerRef.current.pauseVideo(); } catch { /* ignore */ } }
  };

  const playPlayer = () => {
    if (htmlVideoRef.current) { htmlVideoRef.current.play().catch(() => { /* ignore */ }); return; }
    if (playerRef.current) { try { playerRef.current.playVideo(); } catch { /* ignore */ } }
  };

  const handleAddMarker = () => {
    if (!activeVideoId) return;
    const timestamp = getPlayerCurrentTime();
    if (timestamp === null) return;
    wasPlayingBeforeDialogRef.current = isPlayerPlaying();
    pausePlayer();
    setPendingMarkerTimestamp(timestamp);
    setShowMarkerDialog(true);
  };

  const handleSaveMarker = async (name: string) => {
    if (!activeVideoId) return;
    const timestamp = pendingMarkerTimestamp;
    setShowMarkerDialog(false);
    if (wasPlayingBeforeDialogRef.current) playPlayer();
    wasPlayingBeforeDialogRef.current = false;
    try {
      const res = await fetch(`/api/videos/${activeVideoId}/markers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, timestamp }),
      });
      if (res.ok) {
        const marker = await res.json();
        setMarkers((prev) => [...prev, marker].sort((a, b) => a.timestamp - b.timestamp));
      }
    } catch (err) {
      console.error("Error adding marker:", err);
    }
  };

  const handleCancelMarker = () => {
    setShowMarkerDialog(false);
    if (wasPlayingBeforeDialogRef.current) playPlayer();
    wasPlayingBeforeDialogRef.current = false;
  };

  const addMarkerRef = useRef(handleAddMarker);
  addMarkerRef.current = handleAddMarker;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (showMarkerDialog) return;
      if (!activeVideoId) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (isPlayerPlaying()) pausePlayer();
        else playPlayer();
        return;
      }

      if (e.code === "KeyM") {
        e.preventDefault();
        addMarkerRef.current();
        return;
      }

      // 1-9 jump to markers 1-9, 0 jumps to marker 10
      if (e.key >= "0" && e.key <= "9") {
        const sorted = [...markers].sort((a, b) => a.timestamp - b.timestamp);
        const index = e.key === "0" ? 9 : parseInt(e.key, 10) - 1;
        if (index < sorted.length) {
          e.preventDefault();
          seekPlayerTo(sorted[index].timestamp);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeVideoId, showMarkerDialog, markers]);

  const handleSeekToMarker = (marker: VideoMarker) => {
    seekPlayerTo(marker.timestamp);
  };

  const handleDeleteMarker = async (markerId: string) => {
    if (!activeVideoId) return;
    try {
      const res = await fetch(`/api/videos/${activeVideoId}/markers/${markerId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMarkers((prev) => prev.filter((m) => m.id !== markerId));
      }
    } catch (err) {
      console.error("Error deleting marker:", err);
    }
  };

  const handleRenameMarker = async (markerId: string) => {
    if (!activeVideoId || !editMarkerName.trim()) {
      setEditingMarkerId(null);
      return;
    }
    try {
      const res = await fetch(`/api/videos/${activeVideoId}/markers/${markerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editMarkerName.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMarkers((prev) => prev.map((m) => (m.id === markerId ? updated : m)));
      }
    } catch (err) {
      console.error("Error renaming marker:", err);
    } finally {
      setEditingMarkerId(null);
      setEditMarkerName("");
    }
  };

  // Practice session tracking
  const { onPlay, onPause, onFinish } = usePracticeSessionTracker(activeVideo ?? null, 100);
  const trackerRef = useRef({ onPlay, onPause, onFinish });
  trackerRef.current = { onPlay, onPause, onFinish };

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT?.Player) {
      ytApiReady.current = true;
      return;
    }
    // Check if script is already being loaded
    if (document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) return;

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      ytApiReady.current = true;
      // If we have a pending video, create the player now
      if (pendingVideoId.current) {
        createPlayer(pendingVideoId.current);
        pendingVideoId.current = null;
      }
    };
  }, []);

  const volumePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const createPlayer = useCallback((youtubeId: string) => {
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch (err) { console.warn("YT destroy failed:", err); }
      playerRef.current = null;
    }
    if (volumePollRef.current) {
      clearInterval(volumePollRef.current);
      volumePollRef.current = null;
    }

    if (!playerContainerRef.current) return;

    playerRef.current = new window.YT!.Player(playerContainerRef.current, {
      videoId: youtubeId,
      width: "100%",
      height: "100%",
      events: {
        onReady: () => {
          const saved = localStorage.getItem('youtubePlayerVolume');
          if (saved !== null && playerRef.current) {
            playerRef.current.setVolume(parseInt(saved, 10));
          }
          // Poll to detect user volume changes
          volumePollRef.current = setInterval(() => {
            if (playerRef.current) {
              try {
                const vol = playerRef.current.getVolume();
                localStorage.setItem('youtubePlayerVolume', String(vol));
              } catch { /* player may be destroyed */ }
            }
          }, 2000);
        },
        onStateChange: (event: YT.OnStateChangeEvent) => {
          if (event.data === 1) { // PLAYING
            trackerRef.current.onPlay();
          } else if (event.data === 2) { // PAUSED
            trackerRef.current.onPause();
          } else if (event.data === 0) { // ENDED
            trackerRef.current.onFinish();
          }
        },
      },
    });
  }, []);

  // Create/update YT player when active video changes (skipped if downloaded)
  useEffect(() => {
    // Always tear down the previous YT player first
    if (volumePollRef.current) {
      clearInterval(volumePollRef.current);
      volumePollRef.current = null;
    }
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch (err) { console.warn("YT destroy failed:", err); }
      playerRef.current = null;
    }
    pendingVideoId.current = null;

    // No active video, or playing from local file: nothing to set up here
    if (!activeVideo || activeVideo.localPath) return;

    if (ytApiReady.current) {
      createPlayer(activeVideo.youtubeId);
    } else {
      pendingVideoId.current = activeVideo.youtubeId;
    }

    return () => {
      if (volumePollRef.current) {
        clearInterval(volumePollRef.current);
        volumePollRef.current = null;
      }
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [activeVideo?.id, activeVideo?.localPath, createPlayer]);

  // Handle initialVideoId from URL
  useEffect(() => {
    if (initialVideoId && videos.length > 0) {
      const video = videos.find((v) => v.id === initialVideoId);
      if (video) {
        setActiveVideoId(video.id);
        // Expand the category containing this video
        const cat = video.category || "Uncategorized";
        setExpandedCategories(new Set([cat]));
      }
    }
  }, [initialVideoId, videos]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <span className="text-gray-500">Loading videos...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-gray-900">
      {/* Sidebar - Video List */}
      <div className="w-72 border-r border-gray-700 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-3 border-b border-gray-700 space-y-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium text-white"
          >
            {showAddForm ? "Cancel" : "Add Video"}
          </button>
          <button
            onClick={() => setShowAddCategoryForm((v) => !v)}
            className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm font-medium text-white"
          >
            {showAddCategoryForm ? "Cancel" : "Add Category"}
          </button>
          {showAddCategoryForm && (
            <div className="space-y-2 pt-1">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddCustomCategory();
                  if (e.key === "Escape") {
                    setShowAddCategoryForm(false);
                    setNewCategoryName("");
                  }
                }}
                placeholder="Category name"
                autoFocus
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={handleAddCustomCategory}
                disabled={!newCategoryName.trim()}
                className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded text-sm font-medium text-white"
              >
                Create
              </button>
            </div>
          )}
        </div>

        {/* Add Form */}
        {showAddForm && (
          <form onSubmit={handleAdd} className="p-3 border-b border-gray-700 bg-gray-800/50">
            <div className="space-y-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Title"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-green-500"
              />
              <input
                type="text"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="YouTube URL"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-green-500"
              />
              <input
                type="text"
                list="category-suggestions"
                value={newCategory || ""}
                onChange={(e) => setNewCategory(e.target.value.trim() || null)}
                placeholder="Category (optional)"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-green-500"
              />
              <datalist id="category-suggestions">
                {existingCategories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={isAdding || !newTitle.trim() || !newUrl.trim()}
                className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm font-medium text-white"
              >
                {isAdding ? "Adding..." : "Add"}
              </button>
            </div>
          </form>
        )}

        {/* Video List with Categories */}
        <div className="flex-1 overflow-y-auto">
          {videos.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No videos yet
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {videosByCategory.map(({ label, category, videos: categoryVideos }, index) => (
                <CategorySection
                  key={label}
                  label={label}
                  videos={categoryVideos}
                  isExpanded={expandedCategories.has(label)}
                  activeVideoId={activeVideoId}
                  editingId={editingId}
                  editTitle={editTitle}
                  editingCategory={editingCategory}
                  existingCategories={existingCategories}
                  categoryIndex={index}
                  onToggleExpanded={() => toggleCategoryExpanded(label)}
                  onVideoClick={(video) => setActiveVideoId(video.id)}
                  onEditStart={(video) => {
                    setEditingId(video.id);
                    setEditTitle(video.title);
                    setEditingCategory(video.category);
                  }}
                  onUpdateVideo={handleUpdateVideo}
                  onEditCancel={() => {
                    setEditingId(null);
                    setEditingCategory(null);
                  }}
                  onDelete={handleDelete}
                  onDragStart={(index) => handleDragStart(label, index)}
                  onDragEnter={(index) => handleDragEnter(label, index)}
                  onDragEnd={() => handleDragEnd(label)}
                  onCategoryChange={setEditingCategory}
                  onCategoryDragStart={handleCategoryDragStart}
                  onCategoryDragEnter={handleCategoryDragEnter}
                  onCategoryDragEnd={handleCategoryDragEnd}
                  onToggleInProgress={handleToggleInProgress}
                  onNotesOpen={(video) => setNotesVideo(video)}
                  onDownload={handleDownload}
                  onRemoveDownload={handleRemoveDownload}
                  downloadingIds={downloadingIds}
                  category={category}
                  onAssignVideoToCategory={handleAssignVideoToCategory}
                  isEmptyCustom={
                    category !== null &&
                    customCategories.includes(category) &&
                    categoryVideos.length === 0
                  }
                  onDeleteEmptyCategory={
                    category !== null && customCategories.includes(category) && categoryVideos.length === 0
                      ? () => handleDeleteEmptyCategory(category)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Area - Video Player */}
      <div className="flex-1 flex items-start justify-center p-6">
        {activeVideo ? (
          <div className="w-full max-h-[calc(100vh-280px)]" style={{ maxWidth: 'calc((100vh - 280px) * 16 / 9)' }}>
            <h2 className="text-xl font-semibold text-white mb-4">
              {activeVideo.title}
              {activeVideo.localPath && (
                <span className="ml-2 text-xs font-normal text-emerald-400 align-middle">● downloaded</span>
              )}
            </h2>
            <div className="aspect-video rounded-lg overflow-hidden bg-black relative">
              {/* YT container is always mounted so YT.destroy() can clean up its iframe before React unmounts. Hidden when a local file is playing. */}
              <div
                ref={playerContainerRef}
                className={`absolute inset-0 w-full h-full ${activeVideo.localPath ? "hidden" : ""}`}
              />
              {activeVideo.localPath && (
                <video
                  key={activeVideo.id}
                  ref={htmlVideoRef}
                  className="absolute inset-0 w-full h-full"
                  controls
                  src={`/api/video/${activeVideo.localPath.split("/").map(encodeURIComponent).join("/")}`}
                  onPlay={() => trackerRef.current.onPlay()}
                  onPause={() => trackerRef.current.onPause()}
                  onEnded={() => trackerRef.current.onFinish()}
                  onLoadedMetadata={(e) => {
                    const saved = localStorage.getItem("youtubeLocalVolume");
                    if (saved !== null) e.currentTarget.volume = parseFloat(saved);
                    void routeMediaElementToSink(e.currentTarget);
                  }}
                  onVolumeChange={(e) => {
                    localStorage.setItem("youtubeLocalVolume", String(e.currentTarget.volume));
                  }}
                />
              )}
            </div>

            {/* Markers */}
            <div className="mt-4">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-sm font-semibold text-gray-300">Markers</h3>
                <button
                  onClick={handleAddMarker}
                  className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 rounded text-white font-medium transition-colors"
                  title="Add marker at current time"
                >
                  + Add at current time
                </button>
                <div className="flex items-center gap-1 ml-auto">
                  <label className="text-xs text-gray-400">Lead-in:</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={leadIn}
                    onChange={(e) => setLeadIn(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-12 px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs text-center text-white focus:outline-none focus:border-green-500"
                    title="Seconds to seek back when jumping to a marker"
                  />
                  <span className="text-xs text-gray-500">sec</span>
                </div>
              </div>
              {markers.length === 0 ? (
                <p className="text-xs text-gray-500">No markers yet. Use the button above to capture a timestamp.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {markers.map((marker) => {
                    const isEditing = editingMarkerId === marker.id;
                    return (
                      <div
                        key={marker.id}
                        onClick={() => { if (!isEditing) handleSeekToMarker(marker); }}
                        className={`group flex items-center gap-1 bg-gray-800 hover:bg-gray-700 rounded px-2 py-1 text-xs border border-gray-700 ${isEditing ? "" : "cursor-pointer"}`}
                        title={isEditing ? undefined : "Click to jump to marker"}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            value={editMarkerName}
                            onChange={(e) => setEditMarkerName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRenameMarker(marker.id);
                              if (e.key === "Escape") { setEditingMarkerId(null); setEditMarkerName(""); }
                            }}
                            onBlur={() => handleRenameMarker(marker.id)}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            className="px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:border-green-500 w-32"
                          />
                        ) : (
                          <>
                            <span className="text-green-400 font-mono">{formatDurationLong(marker.timestamp)}</span>
                            <span className="text-gray-300">{marker.name}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingMarkerId(marker.id);
                                setEditMarkerName(marker.name);
                              }}
                              className="text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                              title="Rename marker"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteMarker(marker.id); }}
                              className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete marker"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500">
            <svg className="w-20 h-20 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-lg">Add a video to get started</p>
          </div>
        )}
      </div>

      <MarkerNameDialog
        isOpen={showMarkerDialog}
        timestamp={pendingMarkerTimestamp}
        formatTime={formatDurationLong}
        onSave={(name) => handleSaveMarker(name)}
        onCancel={handleCancelMarker}
      />

      {/* Notes Modal */}
      {notesVideo && (
        <NotesModal
          title={notesVideo.title}
          initialNotes={notesVideo.notes || ""}
          onClose={() => setNotesVideo(null)}
          onSave={async (notes) => {
            const response = await fetch(`/api/videos/${notesVideo.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: notesVideo.title, notes }),
            });
            if (response.ok) {
              const updated = await response.json();
              setVideos(videos.map((v) => (v.id === notesVideo.id ? updated : v)));
            }
          }}
        />
      )}
    </div>
  );
}
