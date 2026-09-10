"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Video } from "@/types";
import { usePracticeSessionTracker } from "@/hooks/usePracticeSessionTracker";
import NotesModal from "./modals/NotesModal";
import MarkerNameDialog from "./MarkerNameDialog";
import { formatDurationLong } from "@/lib/formatting";
import { subscribeToAudioSinkChanges, routeMediaElementToSink } from "@/lib/audioSink";
import VideoSidebar from "./videos/VideoSidebar";
import LocalVideoPlayer from "./videos/LocalVideoPlayer";
import MarkerPanel from "./videos/MarkerPanel";

interface VideoMarker {
  id: string;
  name: string;
  timestamp: number;
  videoId: string;
}

interface VideosProps {
  initialVideoId?: string | null;
}

export default function Videos({ initialVideoId }: VideosProps) {
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const activeVideoIdRef = useRef<string | null>(null);
  activeVideoIdRef.current = activeVideoId;
  const [notesVideo, setNotesVideo] = useState<Video | null>(null);

  const htmlVideoRef = useRef<HTMLVideoElement | null>(null);

  const [markers, setMarkers] = useState<VideoMarker[]>([]);
  const [showMarkerDialog, setShowMarkerDialog] = useState(false);
  const [pendingMarkerTimestamp, setPendingMarkerTimestamp] = useState(0);
  const [leadIn, setLeadIn] = useState(2);
  const wasPlayingBeforeDialogRef = useRef(false);

  // A/B loop points
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // Playback errors: tracks ids of ready videos whose local file failed to play.
  const [playbackErrorIds, setPlaybackErrorIds] = useState<Set<string>>(new Set());

  // Lead-in persistence
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

  // Keep the active element routed to the selected audio sink.
  useEffect(() => {
    return subscribeToAudioSinkChanges(() => {
      void routeMediaElementToSink(htmlVideoRef.current);
    });
  }, []);

  // Reset loop points and playback errors when switching videos.
  useEffect(() => {
    setLoopA(null);
    setLoopB(null);
    if (activeVideoId) {
      setPlaybackErrorIds((prev) => {
        if (!prev.has(activeVideoId)) return prev;
        const next = new Set(prev);
        next.delete(activeVideoId);
        return next;
      });
    }
  }, [activeVideoId]);

  const fetchVideos = async () => {
    try {
      const response = await fetch("/api/videos");
      if (response.ok) {
        const data = await response.json();
        setVideos(data);
        if (data.length > 0 && !activeVideoIdRef.current) {
          setActiveVideoId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching videos:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  // URL sync
  useEffect(() => {
    const url = activeVideoId ? `/videos?video=${activeVideoId}` : "/videos";
    router.replace(url, { scroll: false });
  }, [activeVideoId, router]);

  // Poll while any video is downloading.
  useEffect(() => {
    const anyActive = videos.some(
      (v) => v.status === "pending" || v.status === "downloading"
    );
    if (!anyActive) return;
    const interval = setInterval(fetchVideos, 3000);
    return () => clearInterval(interval);
  }, [videos]);

  // Handle initialVideoId from URL
  useEffect(() => {
    if (initialVideoId && videos.length > 0) {
      const video = videos.find((v) => v.id === initialVideoId);
      if (video) {
        setActiveVideoId(video.id);
      }
    }
  }, [initialVideoId, videos]);

  const activeVideo = videos.find((v) => v.id === activeVideoId);

  // ---- Add / retry / delete / update handlers -----------------------------

  const handleAdd = async (url: string, category: string | null) => {
    setIsAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, category }),
      });
      if (res.ok) {
        const video = await res.json();
        setVideos((prev) => [...prev, video]);
        setActiveVideoId(video.id);
      } else {
        const data = await res.json().catch(() => ({}));
        setAddError(data.error || "Failed to add video");
        // Re-raise so the sidebar keeps its form open (it relies on rejection).
        throw new Error(data.error || "Failed to add video");
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleRetry = async (video: Video) => {
    // Clear any playback error for this video before retrying.
    setPlaybackErrorIds((prev) => {
      if (!prev.has(video.id)) return prev;
      const next = new Set(prev);
      next.delete(video.id);
      return next;
    });
    try {
      const res = await fetch(`/api/videos/${video.id}/download`, { method: "POST" });
      if (res.ok) {
        const updated = await res.json();
        setVideos((prev) => prev.map((v) => (v.id === video.id ? updated : v)));
      }
    } catch (err) {
      console.error("Error retrying video download:", err);
    }
  };

  const handleDelete = async (id: string) => {
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

  const handleToggleInProgress = async (video: Video) => {
    try {
      const response = await fetch(`/api/videos/${video.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: video.title, inProgress: !video.inProgress }),
      });
      if (response.ok) {
        const updated = await response.json();
        setVideos((prev) => prev.map((v) => (v.id === video.id ? updated : v)));
      }
    } catch (err) {
      console.error("Error toggling in-progress:", err);
    }
  };

  const handleUpdateVideo = async (id: string, title: string, category: string | null) => {
    if (!title.trim()) return;
    try {
      const response = await fetch(`/api/videos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category }),
      });
      if (response.ok) {
        const updatedVideo = await response.json();
        setVideos((prev) => prev.map((v) => (v.id === id ? updatedVideo : v)));
      }
    } catch (err) {
      console.error("Error updating video:", err);
    }
  };

  const handleReorder = async (videoIds: string[]) => {
    try {
      await fetch("/api/videos/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoIds }),
      });
    } catch (err) {
      console.error("Error reordering videos:", err);
    }
    await fetchVideos();
  };

  // ---- Player controls (htmlVideoRef only) --------------------------------

  const getPlayerCurrentTime = (): number | null => {
    if (htmlVideoRef.current) return htmlVideoRef.current.currentTime;
    return null;
  };

  const seekPlayerTo = (timestamp: number) => {
    const target = Math.max(0, timestamp - leadIn);
    if (htmlVideoRef.current) {
      htmlVideoRef.current.currentTime = target;
      htmlVideoRef.current.play().catch(() => { /* play may be blocked */ });
    }
  };

  const seekPlayerBy = (deltaSeconds: number) => {
    const current = getPlayerCurrentTime();
    if (current === null) return;
    const target = Math.max(0, current + deltaSeconds);
    if (htmlVideoRef.current) {
      htmlVideoRef.current.currentTime = target;
    }
  };

  const isPlayerPlaying = (): boolean => {
    if (htmlVideoRef.current) return !htmlVideoRef.current.paused;
    return false;
  };

  const pausePlayer = () => {
    if (htmlVideoRef.current) htmlVideoRef.current.pause();
  };

  const playPlayer = () => {
    if (htmlVideoRef.current) htmlVideoRef.current.play().catch(() => { /* ignore */ });
  };

  // ---- Markers ------------------------------------------------------------

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

  const handleRenameMarkerDirect = async (markerId: string, name: string) => {
    if (!activeVideoId || !name.trim()) return;
    try {
      const res = await fetch(`/api/videos/${activeVideoId}/markers/${markerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMarkers((prev) => prev.map((m) => (m.id === markerId ? updated : m)));
      }
    } catch (err) {
      console.error("Error renaming marker:", err);
    }
  };

  // ---- Keyboard shortcuts -------------------------------------------------

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

      if (e.code === "KeyA") {
        e.preventDefault();
        const t = htmlVideoRef.current?.currentTime;
        if (t != null) setLoopA(t);
        return;
      }

      if (e.code === "KeyB") {
        e.preventDefault();
        const t = htmlVideoRef.current?.currentTime;
        if (t != null) setLoopB(t);
        return;
      }

      if (e.code === "ArrowLeft") {
        e.preventDefault();
        seekPlayerBy(-5);
        return;
      }

      if (e.code === "ArrowRight") {
        e.preventDefault();
        seekPlayerBy(5);
        return;
      }

      // + / = raise volume, - lower it (by 0.05). Setting .volume fires the
      // player's onVolumeChange, which persists the per-video volume.
      if (e.key === "+" || e.key === "=" || e.key === "-") {
        const el = htmlVideoRef.current;
        if (el) {
          e.preventDefault();
          const delta = e.key === "-" ? -0.05 : 0.05;
          el.volume = Math.min(1, Math.max(0, el.volume + delta));
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVideoId, showMarkerDialog, markers, leadIn]);

  // ---- Practice session tracking ------------------------------------------

  const { onPlay, onPause, onFinish } = usePracticeSessionTracker(activeVideo ?? null);
  const trackerRef = useRef({ onPlay, onPause, onFinish });
  trackerRef.current = { onPlay, onPause, onFinish };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <span className="text-gray-500">Loading videos...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-gray-900">
      {/* Left: sidebar (renders its own w-72 border-r wrapper) */}
      <VideoSidebar
        videos={videos}
        activeVideoId={activeVideoId}
        onSelect={(v) => setActiveVideoId(v.id)}
        onAdd={handleAdd}
        isAdding={isAdding}
        addError={addError}
        onRetry={handleRetry}
        onDelete={(id) => handleDelete(id)}
        onToggleInProgress={handleToggleInProgress}
        onOpenNotes={(v) => setNotesVideo(v)}
        onUpdateVideo={(id, title, category) => handleUpdateVideo(id, title, category)}
        onReorder={handleReorder}
      />

      {/* Center: player area */}
      <div className="flex-1 flex flex-col p-6 min-w-0 min-h-0">
        {!activeVideo ? (
          <div className="flex-1 flex items-center justify-center text-center text-gray-500">
            <div>
              <svg className="w-20 h-20 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-lg">Add a video to get started</p>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
              <span className="truncate">{activeVideo.title}</span>
              {activeVideo.duration != null && (
                <span className="text-sm font-normal text-gray-400 shrink-0">
                  {formatDurationLong(activeVideo.duration)}
                </span>
              )}
            </h2>
            {activeVideo.status === "ready" && activeVideo.localPath && !playbackErrorIds.has(activeVideo.id) ? (
              <>
                <div className="flex-1 min-h-0">
                  <LocalVideoPlayer
                    video={activeVideo}
                    videoRef={htmlVideoRef}
                    markers={markers}
                    loopA={loopA}
                    loopB={loopB}
                    onClearLoop={() => { setLoopA(null); setLoopB(null); }}
                    onSetLoopA={setLoopA}
                    onSetLoopB={setLoopB}
                    onAddMarker={handleAddMarker}
                    onTimeUpdate={setCurrentTime}
                    onPlay={() => trackerRef.current.onPlay()}
                    onPause={() => trackerRef.current.onPause()}
                    onEnded={() => trackerRef.current.onFinish()}
                    onError={() => setPlaybackErrorIds((prev) => new Set(prev).add(activeVideo.id))}
                    onVolumeChange={(volume) =>
                      setVideos((prev) =>
                        prev.map((v) => (v.id === activeVideo.id ? { ...v, volume } : v))
                      )
                    }
                    onPlaybackSpeedChange={(playbackSpeed) =>
                      setVideos((prev) =>
                        prev.map((v) => (v.id === activeVideo.id ? { ...v, playbackSpeed } : v))
                      )
                    }
                  />
                </div>
                <div className="shrink-0 mt-4 max-h-40 overflow-y-auto">
                  <MarkerPanel
                    markers={markers}
                    currentTime={currentTime}
                    leadIn={leadIn}
                    onLeadInChange={setLeadIn}
                    onJumpToMarker={(m) => seekPlayerTo(m.timestamp)}
                    onRenameMarker={(id, name) => handleRenameMarkerDirect(id, name)}
                    onDeleteMarker={handleDeleteMarker}
                    loopA={loopA}
                    loopB={loopB}
                    onSetLoopA={setLoopA}
                    onSetLoopB={setLoopB}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <div className="w-full max-w-3xl aspect-video rounded-lg bg-black flex items-center justify-center">
                  {activeVideo.status === "ready" && activeVideo.localPath && playbackErrorIds.has(activeVideo.id) ? (
                    <div className="text-center px-6">
                      <p className="text-red-400 mb-1 font-medium">This video&apos;s file could not be played.</p>
                      <p className="text-xs text-gray-400 mb-4 max-w-md mx-auto">
                        The file may have been moved or deleted. Try re-downloading it.
                      </p>
                      <button
                        onClick={() => handleRetry(activeVideo)}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium text-white"
                      >
                        Retry
                      </button>
                    </div>
                  ) : activeVideo.status === "failed" ? (
                    <div className="text-center px-6">
                      <p className="text-red-400 mb-1 font-medium">Download failed</p>
                      {activeVideo.errorMessage && (
                        <p className="text-xs text-gray-400 mb-4 max-w-md mx-auto break-words">
                          {activeVideo.errorMessage}
                        </p>
                      )}
                      <button
                        onClick={() => handleRetry(activeVideo)}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium text-white"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400">
                      <svg className="w-10 h-10 mx-auto mb-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <p className="text-sm">Downloading…</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
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
              setVideos((prev) => prev.map((v) => (v.id === notesVideo.id ? updated : v)));
            }
          }}
        />
      )}
    </div>
  );
}
