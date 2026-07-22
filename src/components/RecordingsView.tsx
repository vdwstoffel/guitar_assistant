"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Recording } from "@/types";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import RecordingWaveform, { RecordingWaveformHandle } from "./RecordingWaveform";

function formatTimeMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "—";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export default function RecordingsView() {
  const recorder = useAudioRecorder();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const waveformRefs = useRef<Map<string, RecordingWaveformHandle>>(new Map());

  const fetchRecordings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/recordings");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setRecordings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  const handleStartStop = useCallback(async () => {
    if (recorder.status === "recording") {
      const result = await recorder.stop();
      if (!result) return;
      setUploading(true);
      try {
        const fd = new FormData();
        const ext = result.mimeType.includes("mp4") ? "mp4" : result.mimeType.includes("ogg") ? "ogg" : "webm";
        fd.append("file", new File([result.blob], `recording.${ext}`, { type: result.mimeType }));
        fd.append("duration", result.duration.toString());
        const res = await fetch("/api/recordings/upload", { method: "POST", body: fd });
        if (!res.ok) throw new Error("Upload failed");
        await fetchRecordings();
      } catch (err) {
        console.error("Upload error:", err);
        alert("Could not save recording");
      } finally {
        setUploading(false);
      }
    } else if (recorder.status === "idle" || recorder.status === "error") {
      await recorder.start();
    }
  }, [recorder, fetchRecordings]);

  const handlePlay = useCallback((rec: Recording) => {
    if (playingId === rec.id) {
      waveformRefs.current.get(rec.id)?.pause();
      return;
    }
    if (playingId) {
      waveformRefs.current.get(playingId)?.pause();
    }
    waveformRefs.current.get(rec.id)?.play();
  }, [playingId]);

  const handleRename = useCallback(async (id: string) => {
    const title = editValue.trim();
    if (!title) {
      setEditingId(null);
      return;
    }
    try {
      const res = await fetch(`/api/recordings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Rename failed");
      setRecordings((prev) => prev.map((r) => (r.id === id ? { ...r, title } : r)));
    } catch (err) {
      console.error(err);
    } finally {
      setEditingId(null);
    }
  }, [editValue]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this recording? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/recordings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      if (playingId === id) {
        waveformRefs.current.get(id)?.pause();
        setPlayingId(null);
      }
      setRecordings((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error(err);
      alert("Could not delete recording");
    }
  }, [playingId]);

  const isRecording = recorder.status === "recording";
  const isBusy = recorder.status === "requesting" || recorder.status === "stopping" || uploading;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-900 text-white p-4 sm:p-6">
      <div className="max-w-3xl w-full mx-auto">
        <h1 className="text-2xl font-bold mb-4">Recordings</h1>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6 space-y-4">
          {!recorder.permissionGranted && (
            <div>
              <button
                onClick={() => recorder.requestPermission()}
                className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded text-white"
                disabled={isRecording}
                title="Grant microphone access"
              >
                Grant access
              </button>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              onClick={handleStartStop}
              disabled={isBusy}
              className={`shrink-0 px-5 py-3 rounded-md font-medium text-white flex items-center gap-2 transition-colors ${
                isRecording
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isRecording ? (
                <>
                  <span className="w-3 h-3 bg-white rounded-sm" />
                  Stop
                </>
              ) : (
                <>
                  <span className="w-3 h-3 bg-red-400 rounded-full animate-pulse" />
                  {uploading ? "Saving…" : "Record"}
                </>
              )}
            </button>

            <div className="text-2xl font-mono tabular-nums min-w-[5ch] text-center text-white">
              {isRecording ? formatTimeMs(recorder.durationMs) : "0:00"}
            </div>

            <div className="flex-1 min-w-0">
              <div className="h-2 w-full bg-gray-700 rounded overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-75 ${
                    recorder.level > 0.85
                      ? "bg-red-500"
                      : recorder.level > 0.6
                        ? "bg-yellow-500"
                        : "bg-green-500"
                  }`}
                  style={{ width: `${Math.round(recorder.level * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Input level</p>
            </div>
          </div>

          {recorder.error && (
            <div className="text-sm text-red-400 bg-red-900/30 border border-red-800 rounded px-3 py-2">
              {recorder.error}
            </div>
          )}
        </div>

        <h2 className="text-lg font-semibold mb-3">Past recordings</h2>

        {loading ? (
          <p className="text-gray-400">Loading…</p>
        ) : recordings.length === 0 ? (
          <p className="text-gray-400">No recordings yet. Hit Record to capture your first take.</p>
        ) : (
          <ul className="space-y-2">
            {recordings.map((rec) => {
              const audioUrl = `/api/audio/${rec.filePath.split("/").map(encodeURIComponent).join("/")}`;
              return (
                <li
                  key={rec.id}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handlePlay(rec)}
                      className="w-10 h-10 shrink-0 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center"
                      title={playingId === rec.id ? "Pause" : "Play"}
                    >
                      {playingId === rec.id ? (
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="4" width="4" height="16" />
                          <rect x="14" y="4" width="4" height="16" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <polygon points="5,3 19,12 5,21" />
                        </svg>
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      {editingId === rec.id ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleRename(rec.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(rec.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                        />
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(rec.id);
                            setEditValue(rec.title);
                          }}
                          className="text-left font-medium hover:text-blue-400 truncate block w-full"
                          title="Click to rename"
                        >
                          {rec.title}
                        </button>
                      )}
                      <div className="text-xs text-gray-400 flex gap-2 mt-0.5">
                        <span>{formatDate(rec.createdAt)}</span>
                        <span>•</span>
                        <span>{formatDuration(rec.duration)}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setEditingId(rec.id);
                        setEditValue(rec.title);
                      }}
                      className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded"
                      title="Rename"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                      </svg>
                    </button>
                  </div>

                  <RecordingWaveform
                    ref={(el) => {
                      if (el) waveformRefs.current.set(rec.id, el);
                      else waveformRefs.current.delete(rec.id);
                    }}
                    audioUrl={audioUrl}
                    onPlay={() => setPlayingId(rec.id)}
                    onPause={() =>
                      setPlayingId((prev) => (prev === rec.id ? null : prev))
                    }
                    onFinish={() =>
                      setPlayingId((prev) => (prev === rec.id ? null : prev))
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
