"use client";

import { useState, useEffect, useRef } from "react";
import { Video } from "@/types";

export default function Videos() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;

    setIsAdding(true);
    setError(null);

    try {
      const response = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, youtubeUrl: newUrl }),
      });

      if (response.ok) {
        const video = await response.json();
        setVideos([...videos, video]);
        setNewTitle("");
        setNewUrl("");
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

  const handleUpdateTitle = async (id: string) => {
    if (!editTitle.trim()) return;

    try {
      const response = await fetch(`/api/videos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle }),
      });

      if (response.ok) {
        setVideos(videos.map((v) => (v.id === id ? { ...v, title: editTitle } : v)));
        setEditingId(null);
      }
    } catch (err) {
      console.error("Error updating video:", err);
    }
  };

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = async () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;

    const newVideos = [...videos];
    const draggedItem = newVideos[dragItem.current];
    newVideos.splice(dragItem.current, 1);
    newVideos.splice(dragOverItem.current, 0, draggedItem);

    setVideos(newVideos);
    dragItem.current = null;
    dragOverItem.current = null;

    try {
      await fetch("/api/videos/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoIds: newVideos.map((v) => v.id) }),
      });
    } catch (err) {
      console.error("Error reordering videos:", err);
      fetchVideos();
    }
  };

  const activeVideo = videos.find((v) => v.id === activeVideoId);

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

        {/* Video List */}
        <div className="flex-1 overflow-y-auto">
          {videos.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No videos yet
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {videos.map((video, index) => (
                <div
                  key={video.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => setActiveVideoId(video.id)}
                  className={`group flex items-center gap-2 px-3 py-2 rounded cursor-pointer ${
                    activeVideoId === video.id
                      ? "bg-green-900/50 text-green-400"
                      : "hover:bg-gray-800 text-gray-300"
                  }`}
                >
                  {/* Drag Handle */}
                  <div className="text-gray-500 cursor-move">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                  </div>

                  {/* Title */}
                  {editingId === video.id ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleUpdateTitle(video.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onBlur={() => handleUpdateTitle(video.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 px-2 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-green-500"
                      autoFocus
                    />
                  ) : (
                    <span className="flex-1 truncate text-sm">{video.title}</span>
                  )}

                  {/* Actions */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(video.id);
                      setEditTitle(video.title);
                    }}
                    className="p-1 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100"
                    title="Edit"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => handleDelete(video.id, e)}
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
      </div>

      {/* Main Area - Video Player */}
      <div className="flex-1 flex items-start justify-center p-6">
        {activeVideo ? (
          <div className="w-full max-h-[calc(100vh-180px)]" style={{ maxWidth: 'calc((100vh - 180px) * 16 / 9)' }}>
            <h2 className="text-xl font-semibold text-white mb-4">{activeVideo.title}</h2>
            <div className="aspect-video rounded-lg overflow-hidden bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${activeVideo.youtubeId}`}
                title={activeVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
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
