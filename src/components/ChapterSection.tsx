"use client";

import { useState, useMemo, memo } from "react";
import { Chapter, Track, BookVideo, AuthorSummary, Book } from "@/types";
import InProgressIndicator from "./InProgressIndicator";
import { formatDuration } from "@/lib/formatting";

interface ChapterSectionProps {
  chapter: Chapter;
  author: AuthorSummary;
  book: Book;
  currentTrack: Track | null;
  selectedVideo: BookVideo | null;
  bookHasPdf: boolean;
  currentPdfPage?: number;
  isExpanded: boolean;
  mediaFilter?: "audio" | "video";
  onToggleExpanded: () => void;
  onTrackSelect: (track: Track, author: AuthorSummary, book: Book) => void;
  onVideoSelect: (video: BookVideo) => void;
  onTrackComplete?: (trackId: string, completed: boolean) => Promise<void>;
  onVideoComplete?: (bookId: string, videoId: string, completed: boolean) => Promise<void>;
  onAssignPdfPage?: (trackId: string, page: number) => Promise<void>;
  onTrackUpdate?: (track: Track) => void;
  onVideoUpdate?: (video: BookVideo) => void;
  onVideoAssignPdfPage?: (bookId: string, video: BookVideo, page: number) => Promise<void>;
  onChapterEdit?: (chapter: Chapter) => void;
  onChapterDelete?: (chapterId: string) => Promise<void>;
  onShowPdf?: (pdfPath: string, page?: number) => void;
  onToggleVideo?: () => void;
  showVideo?: boolean;
}

export default memo(function ChapterSection({
  chapter,
  author,
  book,
  currentTrack,
  selectedVideo,
  bookHasPdf,
  currentPdfPage,
  isExpanded,
  onToggleExpanded,
  onTrackSelect,
  onVideoSelect,
  onTrackComplete,
  onVideoComplete,
  onAssignPdfPage,
  onTrackUpdate,
  onVideoUpdate,
  onVideoAssignPdfPage,
  onChapterEdit,
  onChapterDelete,
  onShowPdf,
  onToggleVideo,
  showVideo,
  mediaFilter,
}: ChapterSectionProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const sortedTracks = useMemo(() =>
    mediaFilter === "video" ? [] : [...chapter.tracks]
      .sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0)),
    [chapter.tracks, mediaFilter]
  );

  const sortedVideos = useMemo(() =>
    mediaFilter === "audio" ? [] : [...chapter.videos]
      .sort((a, b) => (a.trackNumber || a.sortOrder || 0) - (b.trackNumber || b.sortOrder || 0)),
    [chapter.videos, mediaFilter]
  );

  const totalItems = sortedTracks.length + sortedVideos.length;
  const allCompleted = totalItems > 0
    && sortedTracks.every((t) => t.completed)
    && sortedVideos.every((v) => v.completed);

  const handleDelete = async () => {
    if (!onChapterDelete) return;

    const confirmed = confirm(
      `Delete chapter "${chapter.name}"? Tracks and videos will be moved to Uncategorized.`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await onChapterDelete(chapter.id);
    } catch (error) {
      console.error("Failed to delete chapter:", error);
      alert("Failed to delete chapter");
    } finally {
      setIsDeleting(false);
    }
  };

  if (totalItems === 0) return null;

  return (
    <div className="mb-4">
      {/* Chapter Header */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-t group transition-colors ${
        allCompleted
          ? "bg-green-900/40 hover:bg-green-900/50"
          : "bg-gray-800 hover:bg-gray-750"
      }`}>
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
          <span className={`font-semibold ${allCompleted ? "text-green-300" : "text-white"}`}>{chapter.name}</span>
          <span className="text-sm text-gray-500">
            ({totalItems} item{totalItems !== 1 ? "s" : ""})
          </span>
          {allCompleted && (
            <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Chapter Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onChapterEdit && (
            <button
              onClick={() => onChapterEdit(chapter)}
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="Edit chapter name"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </button>
          )}
          {onChapterDelete && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
              title="Delete chapter"
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
      </div>

      {/* Chapter Content */}
      {isExpanded && (
        <div className="border-l-2 border-gray-700 ml-3 pl-2">
          {/* Tracks */}
          {sortedTracks.map((track) => (
            <div
              key={track.id}
              onClick={() => onTrackSelect(track, author, book)}
              onKeyDown={(e) => e.key === "Enter" && onTrackSelect(track, author, book)}
              role="button"
              tabIndex={0}
              className={`flex items-center gap-3 px-3 py-2 rounded transition-colors group cursor-pointer ${
                currentTrack?.id === track.id
                  ? "bg-green-900/50 text-green-400"
                  : "hover:bg-gray-800 text-gray-300"
              }`}
            >
              {/* Track Number / Play Icon */}
              <span className="w-6 text-center text-sm flex-shrink-0">
                {currentTrack?.id === track.id ? (
                  <svg className="w-4 h-4 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ) : (
                  <>
                    <span className="text-gray-500 group-hover:hidden">
                      {track.trackNumber || "-"}
                    </span>
                    <svg
                      className="w-4 h-4 mx-auto hidden group-hover:block text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </>
                )}
              </span>

              {/* Track Title */}
              <span className="flex-1 truncate">{track.title}</span>

              {/* In Progress indicator */}
              <InProgressIndicator
                trackId={track.id}
                completed={track.completed}
                playbackSpeed={track.playbackSpeed}
              />

              {/* Completion circle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTrackComplete?.(track.id, !track.completed);
                }}
                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
                  track.completed
                    ? "bg-green-500 border-green-500"
                    : "border-gray-500 hover:border-green-400"
                }`}
                title={track.completed ? "Mark as not completed" : "Mark as completed"}
              >
                {track.completed && (
                  <svg
                    className="w-full h-full text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>

              {/* Duration and PDF page */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {bookHasPdf &&
                  (track.pdfPage ? (
                    <span className="text-xs text-gray-500 w-8 text-right">
                      p.{track.pdfPage}
                    </span>
                  ) : onAssignPdfPage && currentPdfPage ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAssignPdfPage(track.id, currentPdfPage);
                      }}
                      className="p-0.5 text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity w-8 flex justify-end"
                      title={`Assign current PDF page (${currentPdfPage})`}
                    >
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
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </button>
                  ) : (
                    <span className="w-8" />
                  ))}
                <span className="text-gray-500 text-sm tabular-nums w-12 text-right">
                  {formatDuration(track.duration)}
                </span>
              </div>

              {/* Edit button */}
              {onTrackUpdate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTrackUpdate(track);
                  }}
                  className="p-1 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  title="Edit track info"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))}

          {/* Videos */}
          {sortedVideos.map((video) => (
            <div
              key={video.id}
              onClick={() => onVideoSelect(video)}
              onKeyDown={(e) => e.key === "Enter" && onVideoSelect(video)}
              role="button"
              tabIndex={0}
              className={`flex items-center gap-3 px-3 py-2 rounded transition-colors group cursor-pointer ${
                selectedVideo?.id === video.id
                  ? "bg-blue-900/50 text-blue-400"
                  : "hover:bg-gray-800 text-gray-300"
              }`}
            >
              {/* Video Number / Icon */}
              <span className="w-6 text-center text-sm flex-shrink-0">
                {selectedVideo?.id === video.id ? (
                  <svg
                    className="w-4 h-4 mx-auto text-blue-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ) : (
                  <>
                    <span className="text-gray-500 group-hover:hidden">
                      {video.trackNumber || "V"}
                    </span>
                    <svg
                      className="w-4 h-4 mx-auto hidden group-hover:block text-blue-400"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </>
                )}
              </span>

              {/* Video Title */}
              <span className="flex-1 truncate">
                {video.title || video.filename.replace(/\.[^/.]+$/, "")}
              </span>

              {/* Quick action icons */}
              <div className="flex items-center gap-1">
                {/* Book icon - jump to PDF page */}
                {bookHasPdf && video.pdfPage && onShowPdf && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // If video is showing, toggle to PDF view
                      if (showVideo && onToggleVideo) {
                        onToggleVideo();
                      }
                      onShowPdf(book.pdfPath!, video.pdfPage!);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                    title={`Jump to PDF page ${video.pdfPage}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </button>
                )}

                {/* Camera icon - play video */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // If PDF is showing, toggle to video view
                    if (!showVideo && onToggleVideo) {
                      onToggleVideo();
                    }
                    onVideoSelect(video);
                  }}
                  className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                  title="Play video"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>

              {/* Completion circle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onVideoComplete?.(book.id, video.id, !video.completed);
                }}
                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
                  video.completed
                    ? "bg-green-500 border-green-500"
                    : "border-gray-500 hover:border-green-400"
                }`}
                title={video.completed ? "Mark as not completed" : "Mark as completed"}
              >
                {video.completed && (
                  <svg
                    className="w-full h-full text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>

              {/* Duration and PDF page */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {bookHasPdf &&
                  (video.pdfPage ? (
                    <span className="text-xs text-gray-500 w-8 text-right">
                      p.{video.pdfPage}
                    </span>
                  ) : onVideoAssignPdfPage && currentPdfPage ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onVideoAssignPdfPage(book.id, video, currentPdfPage);
                      }}
                      className="p-0.5 text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity w-8 flex justify-end"
                      title={`Assign current PDF page (${currentPdfPage})`}
                    >
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
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </button>
                  ) : (
                    <span className="w-8" />
                  ))}
                {video.duration && (
                  <span className="text-gray-500 text-sm tabular-nums w-12 text-right">
                    {formatDuration(video.duration)}
                  </span>
                )}
              </div>

              {/* Edit button */}
              {onVideoUpdate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onVideoUpdate(video);
                  }}
                  className="p-1 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  title="Edit video info"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
