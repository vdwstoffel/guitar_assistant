"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Song, Artist, Album, Marker } from "@/types";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";

interface PlayerProps {
  song: Song | null;
  artist: Artist | null;
  album: Album | null;
  onMarkerAdd: (songId: string, name: string, timestamp: number) => void;
  onMarkerUpdate: (markerId: string, timestamp: number) => void;
  onMarkerRename: (markerId: string, name: string) => void;
  onMarkerDelete: (markerId: string) => void;
  onMarkersClear: (songId: string) => void;
  onMetadataUpdate: (songId: string, title: string, artist: string, album: string, trackNumber: number) => Promise<void>;
}

export default function Player({
  song,
  artist,
  album,
  onMarkerAdd,
  onMarkerUpdate,
  onMarkerRename,
  onMarkerDelete,
  onMarkersClear,
  onMetadataUpdate,
}: PlayerProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const prevMarkerIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [newMarkerName, setNewMarkerName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [editingMarkerName, setEditingMarkerName] = useState("");
  const [leadIn, setLeadIn] = useState(0);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");
  const [editAlbum, setEditAlbum] = useState("");
  const [editTrackNumber, setEditTrackNumber] = useState(0);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(100);
  const [volume, setVolume] = useState(100);

  const handleZoom = (newZoom: number) => {
    const clampedZoom = Math.max(1, Math.min(200, newZoom));
    setZoom(clampedZoom);
    if (wavesurferRef.current) {
      wavesurferRef.current.zoom(clampedZoom);
    }
  };

  const handlePlaybackSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (wavesurferRef.current) {
      wavesurferRef.current.setPlaybackRate(speed / 100, true);
    }
  };

  const handleVolume = (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(100, newVolume));
    setVolume(clampedVolume);
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(clampedVolume / 100);
    }
  };

  const initWaveSurfer = useCallback(() => {
    if (!waveformRef.current || !song) return;

    // Destroy previous instance
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    setIsLoading(true);

    const regions = RegionsPlugin.create();

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "#4b5563",
      progressColor: "#22c55e",
      cursorColor: "#ffffff",
      cursorWidth: 2,
      height: 120,
      normalize: true,
      minPxPerSec: 1,
      autoScroll: true,
      autoCenter: true,
      plugins: [regions],
    });

    regionsRef.current = regions;

    ws.on("ready", () => {
      setDuration(ws.getDuration());
      setIsLoading(false);

      // Add initial markers
      song.markers.forEach((marker) => {
        const region = regions.addRegion({
          id: marker.id,
          start: marker.timestamp,
          end: marker.timestamp,
          color: "rgba(250, 204, 21, 1)",
          resize: false,
          drag: true,
        });
        if (region.element) {
          region.element.classList.add("marker-region");
          const flag = document.createElement("div");
          flag.className = "marker-flag";
          flag.innerHTML = `<span class="marker-flag-text">${marker.name}</span>`;
          region.element.appendChild(flag);
        }
      });

      // Track initial marker IDs
      prevMarkerIdsRef.current = new Set(song.markers.map((m) => m.id));
      isInitialLoadRef.current = false;

      // Handle marker drag
      regions.on("region-updated", (region) => {
        onMarkerUpdate(region.id, region.start);
      });
    });

    ws.on("timeupdate", (time) => {
      setCurrentTime(time);
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));

    ws.load(`/api/audio/${encodeURIComponent(song.filePath)}`);

    wavesurferRef.current = ws;
  }, [song]);

  useEffect(() => {
    if (song) {
      // Reset marker tracking for the new song
      prevMarkerIdsRef.current = new Set();
      isInitialLoadRef.current = true;
      initWaveSurfer();
    }

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [song?.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (wavesurferRef.current) {
          wavesurferRef.current.playPause();
        }
      }

      // Press 'M' to add a marker at current position
      if (e.code === "KeyM" && song) {
        e.preventDefault();
        const markerCount = song.markers.length + 1;
        onMarkerAdd(song.id, `Marker ${markerCount}`, currentTime);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [song, currentTime, onMarkerAdd]);

  // Update markers on waveform when they change (after initial load)
  useEffect(() => {
    // Skip if waveform not ready or still in initial load
    if (!regionsRef.current || !song || isLoading || isInitialLoadRef.current) return;

    const currentMarkerIds = new Set(song.markers.map((m) => m.id));
    const prevMarkerIds = prevMarkerIdsRef.current;

    // Check if markers were added or removed (not just position changes)
    const markersChanged =
      currentMarkerIds.size !== prevMarkerIds.size ||
      [...currentMarkerIds].some((id) => !prevMarkerIds.has(id)) ||
      [...prevMarkerIds].some((id) => !currentMarkerIds.has(id));

    // Only recreate regions if markers were added or removed
    if (!markersChanged) {
      return;
    }

    // Update the previous marker IDs ref
    prevMarkerIdsRef.current = currentMarkerIds;

    // Clear existing regions and re-add
    regionsRef.current.clearRegions();
    song.markers.forEach((marker) => {
      const region = regionsRef.current?.addRegion({
        id: marker.id,
        start: marker.timestamp,
        end: marker.timestamp,
        color: "rgba(250, 204, 21, 1)",
        resize: false,
        drag: true,
      });
      if (region?.element) {
        region.element.classList.add("marker-region");
        const flag = document.createElement("div");
        flag.className = "marker-flag";
        flag.innerHTML = `<span class="marker-flag-text">${marker.name}</span>`;
        region.element.appendChild(flag);
      }
    });
  }, [song?.markers, isLoading]);

  const togglePlay = () => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.playPause();
  };

  const jumpToMarker = (timestamp: number) => {
    if (!wavesurferRef.current || !duration) return;
    const startTime = Math.max(0, timestamp - leadIn);
    wavesurferRef.current.seekTo(startTime / duration);
    wavesurferRef.current.play();
    if (!isPlaying) {
      wavesurferRef.current.play();
    }
  };

  const addMarker = () => {
    if (!song || !newMarkerName.trim()) return;
    onMarkerAdd(song.id, newMarkerName.trim(), currentTime);
    setNewMarkerName("");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const openMetadataEditor = () => {
    if (!song) return;
    setEditTitle(song.title);
    setEditArtist(artist?.name || "Unknown Artist");
    setEditAlbum(album?.name || "Unknown Album");
    setEditTrackNumber(song.trackNumber || 0);
    setIsEditingMetadata(true);
  };

  const saveMetadata = async () => {
    if (!song || !editTitle.trim() || !editArtist.trim() || !editAlbum.trim()) return;
    setIsSavingMetadata(true);
    try {
      await onMetadataUpdate(song.id, editTitle.trim(), editArtist.trim(), editAlbum.trim(), editTrackNumber);
      setIsEditingMetadata(false);
    } catch (error) {
      console.error("Failed to save metadata:", error);
    } finally {
      setIsSavingMetadata(false);
    }
  };

  if (!song) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-800 text-gray-400">
        <p>Select a song to play</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-800 text-white">
      {/* Song Info */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold truncate">{song.title}</h2>
          <button
            onClick={openMetadataEditor}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Edit song info"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
        <p className="text-gray-400 mt-1">
          {artist?.name} — {album?.name}
        </p>
      </div>

      {/* Metadata Edit Modal */}
      {isEditingMetadata && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Edit Song Info</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Artist</label>
                <input
                  type="text"
                  value={editArtist}
                  onChange={(e) => setEditArtist(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Album</label>
                <input
                  type="text"
                  value={editAlbum}
                  onChange={(e) => setEditAlbum(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Track Number</label>
                <input
                  type="number"
                  min={0}
                  value={editTrackNumber}
                  onChange={(e) => setEditTrackNumber(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-green-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsEditingMetadata(false)}
                disabled={isSavingMetadata}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveMetadata}
                disabled={isSavingMetadata || !editTitle.trim() || !editArtist.trim() || !editAlbum.trim()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors"
              >
                {isSavingMetadata ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player Controls */}
      <div className="p-6 border-b border-gray-700 overflow-hidden">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="w-14 h-14 flex items-center justify-center bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-full transition-colors"
          >
            {isLoading ? (
              <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <div className="flex-1">
            <div className="flex justify-between text-sm text-gray-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm text-gray-400">Zoom:</span>
          <button
            onClick={() => handleZoom(zoom / 1.5)}
            disabled={zoom <= 1}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded text-sm transition-colors"
          >
            −
          </button>
          <input
            type="range"
            min={1}
            max={200}
            value={zoom}
            onChange={(e) => handleZoom(parseFloat(e.target.value))}
            className="w-32 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
          />
          <button
            onClick={() => handleZoom(zoom * 1.5)}
            disabled={zoom >= 200}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded text-sm transition-colors"
          >
            +
          </button>
          <span className="text-sm text-gray-500 w-12">{Math.round(zoom)}x</span>
          {zoom > 1 && (
            <button
              onClick={() => handleZoom(1)}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        {/* Playback Speed Controls */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm text-gray-400">Speed:</span>
          {[50, 75, 100, 125, 150].map((speed) => (
            <button
              key={speed}
              onClick={() => handlePlaybackSpeed(speed)}
              className={`px-2 py-1 rounded text-sm transition-colors ${
                playbackSpeed === speed
                  ? "bg-green-600 text-white"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              {speed}%
            </button>
          ))}
          <input
            type="range"
            min={25}
            max={200}
            step={5}
            value={playbackSpeed}
            onChange={(e) => handlePlaybackSpeed(parseInt(e.target.value))}
            className="w-24 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
          />
          <span className="text-sm text-gray-500 w-12">{playbackSpeed}%</span>
          {playbackSpeed !== 100 && (
            <button
              onClick={() => handlePlaybackSpeed(100)}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm text-gray-400">Volume:</span>
          <button
            onClick={() => handleVolume(volume === 0 ? 100 : 0)}
            className="p-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            title={volume === 0 ? "Unmute" : "Mute"}
          >
            {volume === 0 ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : volume < 50 ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => handleVolume(parseInt(e.target.value))}
            className="w-32 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
          />
          <span className="text-sm text-gray-500 w-10">{volume}%</span>
        </div>

        {/* Waveform */}
        <div className="relative pt-7">
          <div
            className="overflow-x-auto rounded bg-gray-900"
            style={{ contain: "inline-size" }}
          >
            {/* Waveform container */}
            <div
              ref={waveformRef}
              className="cursor-pointer"
            />
          </div>

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded">
              <span className="text-gray-400">Loading waveform...</span>
            </div>
          )}
        </div>
      </div>

      {/* Markers Section */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Markers</h3>
          {song.markers.length > 0 && (
            <button
              onClick={() => onMarkersClear(song.id)}
              className="text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Lead-in Setting */}
        <div className="flex items-center gap-2 mb-4">
          <label className="text-sm text-gray-400">Lead-in:</label>
          <input
            type="number"
            min={0}
            max={30}
            value={leadIn}
            onChange={(e) => setLeadIn(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-14 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-center focus:outline-none focus:border-green-500"
          />
          <span className="text-sm text-gray-500">sec</span>
        </div>

        {/* Add Marker */}
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newMarkerName}
            onChange={(e) => setNewMarkerName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMarker()}
            placeholder="Marker name (e.g., Chorus, Solo)"
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-green-500"
          />
          <button
            onClick={addMarker}
            disabled={!newMarkerName.trim()}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors"
          >
            Add at {formatTime(currentTime)}
          </button>
        </div>
        <p className="text-gray-500 text-xs mb-4">
          Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">M</kbd> to quickly add a marker at current position
        </p>

        {/* Marker List */}
        {song.markers.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No markers yet. Add one to mark a section of the song.
          </p>
        ) : (
          <ul className="space-y-2">
            {song.markers
              .sort((a, b) => a.timestamp - b.timestamp)
              .map((marker: Marker) => (
                <li
                  key={marker.id}
                  className="flex items-center gap-3 p-3 bg-gray-700 rounded hover:bg-gray-650 group"
                >
                  <button
                    onClick={() => jumpToMarker(marker.timestamp)}
                    className="text-green-400 font-mono text-sm min-w-[50px]"
                  >
                    {formatTime(marker.timestamp)}
                  </button>
                  {editingMarkerId === marker.id ? (
                    <form
                      className="flex-1 flex items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (editingMarkerName.trim()) {
                          onMarkerRename(marker.id, editingMarkerName.trim());
                        }
                        setEditingMarkerId(null);
                      }}
                    >
                      <input
                        type="text"
                        value={editingMarkerName}
                        onChange={(e) => setEditingMarkerName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setEditingMarkerId(null);
                          }
                        }}
                        autoFocus
                        className="flex-1 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-sm focus:outline-none focus:border-green-500"
                      />
                      <button
                        type="submit"
                        className="text-green-400 hover:text-green-300 p-1"
                        title="Save"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingMarkerId(null)}
                        className="text-gray-400 hover:text-gray-300 p-1"
                        title="Cancel"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        onClick={() => jumpToMarker(marker.timestamp)}
                        className="flex-1 text-left font-medium hover:text-green-400 transition-colors"
                      >
                        {marker.name}
                      </button>
                      <button
                        onClick={() => {
                          setEditingMarkerId(marker.id);
                          setEditingMarkerName(marker.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-300 transition-opacity p-1"
                        title="Edit name"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => onMarkerDelete(marker.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity p-1"
                    title="Delete marker"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
