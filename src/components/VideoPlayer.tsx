"use client";

import { BookVideo } from "@/types";
import { useEffect, useRef } from "react";

interface VideoPlayerProps {
  video: BookVideo | null;
}

export default function VideoPlayer({ video }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Reset video when changing videos
    if (videoRef.current && video) {
      videoRef.current.load();
    }
  }, [video]);

  if (!video) {
    return (
      <div className="flex items-center justify-center h-full bg-neutral-900 rounded-lg">
        <div className="text-center text-neutral-500">
          <svg
            className="w-24 h-24 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <p>Select a video to play</p>
        </div>
      </div>
    );
  }

  const videoUrl = `/api/video/${encodeURIComponent(video.filePath)}`;

  return (
    <div className="flex flex-col h-full bg-black rounded-lg overflow-hidden">
      <div className="flex-1 flex items-center justify-center">
        <video
          ref={videoRef}
          className="max-w-full max-h-full"
          controls
          controlsList="nodownload"
        >
          <source src={videoUrl} />
          Your browser does not support the video tag.
        </video>
      </div>
      <div className="bg-neutral-900 px-4 py-3 border-t border-neutral-800">
        <h3 className="font-medium text-white truncate">{video.filename}</h3>
        {video.duration && (
          <p className="text-sm text-neutral-400 mt-1">
            Duration: {formatDuration(video.duration)}
          </p>
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
