"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Video } from "@/types";
import { usePracticeSessionTracker } from "@/hooks/usePracticeSessionTracker";

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
}: CategorySectionProps) {
  return (
    <div>
      {/* Category Header */}
      <div
        draggable={label !== "Uncategorized"}
        onDragStart={() => onCategoryDragStart(categoryIndex)}
        onDragEnter={() => onCategoryDragEnter(categoryIndex)}
        onDragEnd={onCategoryDragEnd}
        onDragOver={(e) => e.preventDefault()}
        className={`flex items-center gap-2 px-3 py-2 rounded-t bg-gray-800 hover:bg-gray-750 transition-colors ${
          label !== "Uncategorized" ? "cursor-move" : ""
        }`}
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
      </div>

      {/* Category Content */}
      {isExpanded && (
        <div className="border-l-2 border-gray-700 ml-3 pl-2">
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
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const dragCategory = useRef<string | null>(null);
  const dragCategoryIndex = useRef<number | null>(null);
  const dragOverCategoryIndex = useRef<number | null>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const ytApiReady = useRef(false);
  const pendingVideoId = useRef<string | null>(null);

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
  }, [videos, categoryOrder]);

  // Load category order from localStorage
  useEffect(() => {
    const savedOrder = localStorage.getItem("video-category-order");
    if (savedOrder) {
      setCategoryOrder(JSON.parse(savedOrder));
    }
  }, []);

  // Save category order to localStorage
  useEffect(() => {
    if (categoryOrder.length > 0) {
      localStorage.setItem("video-category-order", JSON.stringify(categoryOrder));
    }
  }, [categoryOrder]);

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

  const createPlayer = useCallback((youtubeId: string) => {
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    if (!playerContainerRef.current) return;

    playerRef.current = new window.YT!.Player(playerContainerRef.current, {
      videoId: youtubeId,
      width: "100%",
      height: "100%",
      events: {
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

  // Create/update player when active video changes
  useEffect(() => {
    if (!activeVideo) {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      return;
    }

    if (ytApiReady.current) {
      createPlayer(activeVideo.youtubeId);
    } else {
      pendingVideoId.current = activeVideo.youtubeId;
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [activeVideo?.id, createPlayer]);

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
        <div className="p-3 border-b border-gray-700">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium text-white"
          >
            {showAddForm ? "Cancel" : "Add Video"}
          </button>
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
              {videosByCategory.map(({ label, videos: categoryVideos }, index) => (
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
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Area - Video Player */}
      <div className="flex-1 flex items-start justify-center p-6">
        {activeVideo ? (
          <div className="w-full max-h-[calc(100vh-180px)]" style={{ maxWidth: 'calc((100vh - 180px) * 16 / 9)' }}>
            <h2 className="text-xl font-semibold text-white mb-4">{activeVideo.title}</h2>
            <div className="aspect-video rounded-lg overflow-hidden bg-black">
              <div ref={playerContainerRef} className="w-full h-full" />
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
    </div>
  );
}
