"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Video, VideoStatus } from "@/types";

// ---- Types ------------------------------------------------------------------

interface VideoSidebarProps {
  videos: Video[];
  activeVideoId: string | null;
  onSelect: (video: Video) => void;
  onAdd: (url: string, category: string | null) => Promise<void>;
  isAdding: boolean;
  addError: string | null;
  onRetry: (video: Video) => void;
  onDelete: (id: string) => void;
  onToggleInProgress: (video: Video) => void;
  onOpenNotes: (video: Video) => void;
  onUpdateVideo: (id: string, title: string, category: string | null) => Promise<void>;
  onReorder: (videoIds: string[]) => Promise<void>;
}

// ---- StatusBadge ------------------------------------------------------------

interface StatusBadgeProps {
  video: Video;
  onRetry: (video: Video) => void;
}

function StatusBadge({ video, onRetry }: StatusBadgeProps) {
  const status: VideoStatus = video.status;

  if (status === "pending" || status === "downloading") {
    return (
      <span className="flex items-center gap-1 text-xs text-blue-400" title="Downloading…">
        <svg
          className="w-3.5 h-3.5 animate-spin"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span className="hidden group-hover:inline">downloading…</span>
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="flex items-center gap-1" title={video.errorMessage ?? "Download failed"}>
        <span className="w-2 h-2 rounded-full bg-red-500 inline-block flex-shrink-0" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRetry(video);
          }}
          className="text-xs text-red-400 hover:text-red-300 transition-colors"
          title={video.errorMessage ?? "Retry download"}
        >
          Retry
        </button>
      </span>
    );
  }

  // "ready" shows no badge — the row is just the video's name, so the title
  // gets the full width of the sidebar.
  return null;
}

// ---- CategorySection --------------------------------------------------------

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
  category: string | null;
  isEmptyCustom: boolean;
  onToggleExpanded: () => void;
  onVideoClick: (video: Video) => void;
  onEditStart: (video: Video) => void;
  onEditTitleChange: (value: string) => void;
  onEditCategoryChange: (value: string) => void;
  onUpdateVideo: (id: string) => void;
  onEditCancel: () => void;
  onDelete: (id: string) => void;
  onDragStart: (index: number) => void;
  onDragEnter: (index: number) => void;
  onDragEnd: () => void;
  onCategoryDragStart: (index: number) => void;
  onCategoryDragEnter: (index: number) => void;
  onCategoryDragEnd: () => void;
  onToggleInProgress: (video: Video) => void;
  onOpenNotes: (video: Video) => void;
  onRetry: (video: Video) => void;
  onAssignVideoToCategory: (videoId: string, newCategory: string | null) => void;
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
  category,
  isEmptyCustom,
  onToggleExpanded,
  onVideoClick,
  onEditStart,
  onEditTitleChange,
  onEditCategoryChange,
  onUpdateVideo,
  onEditCancel,
  onDelete,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onCategoryDragStart,
  onCategoryDragEnter,
  onCategoryDragEnd,
  onToggleInProgress,
  onOpenNotes,
  onRetry,
  onAssignVideoToCategory,
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

  const handleHeaderDrop = (e: React.DragEvent) => {
    setIsDragOver(false);
    const raw = e.dataTransfer.getData("application/x-guitar-video");
    if (!raw) return;
    e.preventDefault();
    try {
      const { id, fromCategory } = JSON.parse(raw) as {
        id: string;
        fromCategory: string | null;
      };
      if (fromCategory === category) return;
      onAssignVideoToCategory(id, category);
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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8h16M4 16h16"
                  />
                </svg>
              </div>

              {/* Title or Edit Form */}
              {editingId === video.id ? (
                <div className="flex-1 space-y-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => onEditTitleChange(e.target.value)}
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
                    onChange={(e) => onEditCategoryChange(e.target.value.trim())}
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

              {/* Status badge (replaces download/remove-download buttons) */}
              {editingId !== video.id && (
                <StatusBadge video={video} onRetry={onRetry} />
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </button>
              ) : (
                <>
                  {/* In-progress toggle */}
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
                    title={
                      video.inProgress
                        ? "Remove from In Progress"
                        : "Add to In Progress"
                    }
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill={video.inProgress ? "currentColor" : "none"}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </button>

                  {/* Notes button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenNotes(video);
                    }}
                    className={`p-1 ${
                      video.notes
                        ? "text-blue-400"
                        : "text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100"
                    }`}
                    title={video.notes ? "Edit notes" : "Add notes"}
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill={video.notes ? "currentColor" : "none"}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                      />
                    </svg>
                  </button>

                  {/* Edit button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditStart(video);
                    }}
                    className="p-1 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100"
                    title="Edit"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </button>
                </>
              )}

              {/* Delete button (always present in row actions) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(video.id);
                }}
                className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100"
                title="Delete"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- VideoSidebar (main export) --------------------------------------------

export default function VideoSidebar({
  videos,
  activeVideoId,
  onSelect,
  onAdd,
  isAdding,
  addError,
  onRetry,
  onDelete,
  onToggleInProgress,
  onOpenNotes,
  onUpdateVideo,
  onReorder,
}: VideoSidebarProps) {
  // ---------- Add form state ------------------------------------------------
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newCategory, setNewCategory] = useState<string | null>(null);

  // ---------- Add category form state ---------------------------------------
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  // ---------- Edit state ----------------------------------------------------
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  // ---------- Expand / category order state ---------------------------------
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);

  // ---------- Drag refs -----------------------------------------------------
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const dragCategory = useRef<string | null>(null);
  const dragCategoryIndex = useRef<number | null>(null);
  const dragOverCategoryIndex = useRef<number | null>(null);

  // ---------- Derived: unique categories from videos for suggestions --------
  const existingCategories = useMemo(() => {
    const cats = new Set<string>();
    videos.forEach((v) => {
      if (v.category) cats.add(v.category);
    });
    return Array.from(cats).sort();
  }, [videos]);

  // ---------- Derived: videos grouped + ordered by category -----------------
  const videosByCategory = useMemo(() => {
    const grouped = new Map<string | null, Video[]>();

    videos.forEach((video) => {
      const cat = video.category || null;
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(video);
    });

    // Ensure user-created empty categories are present
    customCategories.forEach((cat) => {
      if (!grouped.has(cat)) grouped.set(cat, []);
    });

    // Sort within each category by sortOrder
    grouped.forEach((vids) => {
      vids.sort((a, b) => a.sortOrder - b.sortOrder);
    });

    const allCategories = Array.from(grouped.keys()).filter(
      (cat): cat is string => cat !== null
    );

    // Order categories based on saved order, then add new ones at the end
    const orderedCategories: (string | null)[] = [];
    if (categoryOrder.length > 0) {
      categoryOrder.forEach((cat) => {
        if (allCategories.includes(cat)) orderedCategories.push(cat);
      });
    }
    const newCats = allCategories
      .filter((cat) => !categoryOrder.includes(cat))
      .sort();
    orderedCategories.push(...newCats);

    // Uncategorized always last
    if (grouped.has(null)) orderedCategories.push(null);

    return orderedCategories.map((cat) => ({
      category: cat,
      label: cat || "Uncategorized",
      videos: grouped.get(cat)!,
    }));
  }, [videos, categoryOrder, customCategories]);

  // ---------- localStorage effects ------------------------------------------

  // Load category order + custom categories
  useEffect(() => {
    const savedOrder = localStorage.getItem("video-category-order");
    if (savedOrder) {
      try {
        setCategoryOrder(JSON.parse(savedOrder));
      } catch { /* ignore */ }
    }
    const savedCustom = localStorage.getItem("video-custom-categories");
    if (savedCustom) {
      try {
        setCustomCategories(JSON.parse(savedCustom));
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (categoryOrder.length > 0) {
      localStorage.setItem("video-category-order", JSON.stringify(categoryOrder));
    }
  }, [categoryOrder]);

  useEffect(() => {
    localStorage.setItem("video-custom-categories", JSON.stringify(customCategories));
  }, [customCategories]);

  // Load expanded state from localStorage (once on mount)
  useEffect(() => {
    const saved = localStorage.getItem("expanded-video-categories");
    if (saved) {
      try {
        setExpandedCategories(new Set(JSON.parse(saved)));
      } catch { /* ignore */ }
    } else {
      if (videosByCategory.length > 0) {
        setExpandedCategories(new Set([videosByCategory[0].label]));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "expanded-video-categories",
      JSON.stringify(Array.from(expandedCategories))
    );
  }, [expandedCategories]);

  // ---------- Category expand toggle (accordion) ----------------------------

  const toggleCategoryExpanded = (label: string) => {
    setExpandedCategories((prev) => {
      if (prev.has(label)) return new Set(); // Close if already open
      return new Set([label]); // Accordion — only one open at a time
    });
  };

  // ---------- Add form handlers ---------------------------------------------

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    try {
      await onAdd(newUrl.trim(), newCategory);
      // success: clear inputs and close the form
      setNewUrl("");
      setNewCategory(null);
      setShowAddForm(false);
    } catch {
      // failure: keep the form open; the parent sets `addError`, shown via the addError prop
    }
  };

  // ---------- Custom category handlers --------------------------------------

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

  // ---------- Edit handlers -------------------------------------------------

  const handleEditStart = (video: Video) => {
    setEditingId(video.id);
    setEditTitle(video.title);
    setEditingCategory(video.category);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingCategory(null);
  };

  const handleUpdateVideo = async (id: string) => {
    if (!editTitle.trim()) return;
    await onUpdateVideo(id, editTitle, editingCategory);
    setEditingId(null);
    setEditingCategory(null);
  };

  // ---------- Assign video to category (drag-to-category) ------------------

  const handleAssignVideoToCategory = (
    videoId: string,
    newCategoryValue: string | null
  ) => {
    const video = videos.find((v) => v.id === videoId);
    if (!video) return;
    void onUpdateVideo(videoId, video.title, newCategoryValue)
      .then(() => {
        setExpandedCategories(new Set([newCategoryValue || "Uncategorized"]));
        if (newCategoryValue) {
          // If this was a custom empty category, remove it from the custom list
          // now that a real video occupies it (prevents duplicate listing)
          setCustomCategories((prev) => prev.filter((c) => c !== newCategoryValue));
        }
      })
      .catch((err) => console.error("Failed to move video to category:", err));
  };

  // ---------- Drag/drop: within-category reorder ----------------------------

  const handleDragStart = (categoryLabel: string, index: number) => {
    dragItem.current = index;
    dragCategory.current = categoryLabel;
  };

  const handleDragEnter = (categoryLabel: string, index: number) => {
    if (dragCategory.current === categoryLabel) {
      dragOverItem.current = index;
    }
  };

  const handleDragEnd = async (categoryLabel: string) => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;
    if (dragCategory.current !== categoryLabel) return;

    const categoryGroup = videosByCategory.find((g) => g.label === categoryLabel);
    if (!categoryGroup) return;

    const categoryVideos = [...categoryGroup.videos];
    const draggedItem = categoryVideos[dragItem.current];
    categoryVideos.splice(dragItem.current, 1);
    categoryVideos.splice(dragOverItem.current, 0, draggedItem);

    // Rebuild entire videos array preserving order of other categories
    const newVideos: Video[] = [];
    videosByCategory.forEach((group) => {
      if (group.label === categoryLabel) {
        newVideos.push(...categoryVideos);
      } else {
        newVideos.push(...group.videos);
      }
    });

    dragItem.current = null;
    dragOverItem.current = null;
    dragCategory.current = null;

    try {
      await onReorder(newVideos.map((v) => v.id));
    } catch (err) {
      console.error("Failed to reorder videos:", err);
    }
  };

  // ---------- Drag/drop: category reorder -----------------------------------

  const handleCategoryDragStart = (index: number) => {
    dragCategoryIndex.current = index;
  };

  const handleCategoryDragEnter = (index: number) => {
    dragOverCategoryIndex.current = index;
  };

  const handleCategoryDragEnd = () => {
    if (
      dragCategoryIndex.current === null ||
      dragOverCategoryIndex.current === null
    )
      return;
    if (dragCategoryIndex.current === dragOverCategoryIndex.current) return;

    const newOrder = [...videosByCategory.map((c) => c.label)];
    const draggedCategory = newOrder[dragCategoryIndex.current];
    newOrder.splice(dragCategoryIndex.current, 1);
    newOrder.splice(dragOverCategoryIndex.current, 0, draggedCategory);

    // Filter out "Uncategorized" from the saved order
    const orderToSave = newOrder.filter((cat) => cat !== "Uncategorized");
    setCategoryOrder(orderToSave);

    dragCategoryIndex.current = null;
    dragOverCategoryIndex.current = null;
  };

  // ---------- Render --------------------------------------------------------

  return (
    <div className="w-72 border-r border-gray-700 flex flex-col">
      {/* Header buttons */}
      <div className="p-3 border-b border-gray-700 space-y-2">
        <button
          onClick={() => setShowAddForm((v) => !v)}
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

        {/* Add category inline form */}
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

      {/* Add video form — URL + optional category only, no title */}
      {showAddForm && (
        <form
          onSubmit={handleAddSubmit}
          className="p-3 border-b border-gray-700 bg-gray-800/50"
        >
          <div className="space-y-3">
            <input
              type="text"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="YouTube URL"
              autoFocus
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-green-500"
            />
            <input
              type="text"
              list="category-suggestions-add"
              value={newCategory || ""}
              onChange={(e) =>
                setNewCategory(e.target.value.trim() || null)
              }
              placeholder="Category (optional)"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-green-500"
            />
            <datalist id="category-suggestions-add">
              {existingCategories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
            {addError && <p className="text-red-400 text-xs">{addError}</p>}
            <button
              type="submit"
              disabled={isAdding || !newUrl.trim()}
              className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm font-medium text-white"
            >
              {isAdding ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      )}

      {/* Video list with categories */}
      <div className="flex-1 overflow-y-auto">
        {videos.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No videos yet
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {videosByCategory.map(
              ({ label, category, videos: categoryVideos }, index) => (
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
                  category={category}
                  isEmptyCustom={
                    category !== null &&
                    customCategories.includes(category) &&
                    categoryVideos.length === 0
                  }
                  onToggleExpanded={() => toggleCategoryExpanded(label)}
                  onVideoClick={onSelect}
                  onEditStart={handleEditStart}
                  onEditTitleChange={setEditTitle}
                  onEditCategoryChange={(val) =>
                    setEditingCategory(val || null)
                  }
                  onUpdateVideo={handleUpdateVideo}
                  onEditCancel={handleEditCancel}
                  onDelete={onDelete}
                  onDragStart={(i) => handleDragStart(label, i)}
                  onDragEnter={(i) => handleDragEnter(label, i)}
                  onDragEnd={() => handleDragEnd(label)}
                  onCategoryDragStart={handleCategoryDragStart}
                  onCategoryDragEnter={handleCategoryDragEnter}
                  onCategoryDragEnd={handleCategoryDragEnd}
                  onToggleInProgress={onToggleInProgress}
                  onOpenNotes={onOpenNotes}
                  onRetry={onRetry}
                  onAssignVideoToCategory={handleAssignVideoToCategory}
                  onDeleteEmptyCategory={
                    category !== null &&
                    customCategories.includes(category) &&
                    categoryVideos.length === 0
                      ? () => handleDeleteEmptyCategory(category)
                      : undefined
                  }
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
