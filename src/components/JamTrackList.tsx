"use client";

import { useState, useRef } from "react";
import { JamTrack, GpSong } from "@/types";
import { formatDuration } from "@/lib/formatting";
import AddSourceModal from "@/components/modals/AddSourceModal";

interface JamTrackListProps {
  jamTracks: JamTrack[];
  currentJamTrackId: string | null;
  onSelect: (id: string) => void;
  onUpload: (files: FileList) => void;
  isUploading: boolean;
  /** Called with url + optional title when user submits the YouTube import modal. */
  onYouTubeImport: (url: string, title?: string) => Promise<void>;
  isImportingFromYouTube: boolean;
  /**
   * Guitar Pro songs, listed beside the audio ones. They play themselves —
   * alphaTab synthesises every instrument — so they have no waveform and no
   * duration, and show their artist where an audio track shows its length.
   */
  gpSongs: GpSong[];
  /** Ids of jam tracks that have a tab attached, so the row can say so. */
  jamTrackIdsWithTab: string[];
  currentGpSongId: string | null;
  onSelectGpSong: (id: string) => void;
  onDeleteGpSong: (id: string) => void;
  onToggleGpFavorite: (id: string) => void;
  onGpUpload: (files: FileList) => void;
  isUploadingGp: boolean;
  /**
   * Imports a Songsterr link as a track of its own. Resolves to a message
   * to show in the modal, or null when the import succeeded.
   */
  onSongsterrImport: (url: string) => Promise<string | null>;
  isImportingFromSongsterr: boolean;
}

export default function JamTrackList({
  jamTracks,
  currentJamTrackId,
  onSelect,
  onUpload,
  isUploading,
  onYouTubeImport,
  isImportingFromYouTube,
  gpSongs,
  jamTrackIdsWithTab,
  currentGpSongId,
  onSelectGpSong,
  onDeleteGpSong,
  onToggleGpFavorite,
  onGpUpload,
  isUploadingGp,
  onSongsterrImport,
  isImportingFromSongsterr,
}: JamTrackListProps) {
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const gpUploadInputRef = useRef<HTMLInputElement>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const busy = isUploading || isUploadingGp || isImportingFromYouTube || isImportingFromSongsterr;

  // One modal per kind of thing being added; each offers a link or a file.
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeError, setYoutubeError] = useState("");
  const [youtubeNeedsTitle, setYoutubeNeedsTitle] = useState(false);
  const [youtubeTitle, setYoutubeTitle] = useState("");

  const [showTabModal, setShowTabModal] = useState(false);
  const [songsterrUrl, setSongsterrUrl] = useState("");
  const [songsterrError, setSongsterrError] = useState("");

  const isValidYouTubeUrl = (url: string) =>
    /^https?:\/\/(www\.)?(youtube\.com\/(watch\?.*v=|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?.*v=)/.test(url);

  const handleYouTubeSubmit = async () => {
    if (!youtubeUrl.trim()) return;
    if (!isValidYouTubeUrl(youtubeUrl.trim())) {
      setYoutubeError("Please enter a valid YouTube URL");
      return;
    }
    if (youtubeNeedsTitle && !youtubeTitle.trim()) {
      setYoutubeError("Please enter a title");
      return;
    }
    setYoutubeError("");
    try {
      await onYouTubeImport(youtubeUrl.trim(), youtubeNeedsTitle ? youtubeTitle.trim() : undefined);
      closeAudioModal();
    } catch (err: unknown) {
      const error = err as Error & { needsTitle?: boolean };
      if (error.needsTitle) {
        setYoutubeNeedsTitle(true);
        setYoutubeError("Could not fetch video title automatically. Please enter a name.");
      } else {
        setYoutubeError(error.message || "Failed to import from YouTube");
      }
    }
  };

  const closeAudioModal = () => {
    setShowAudioModal(false);
    setYoutubeUrl("");
    setYoutubeError("");
    setYoutubeTitle("");
    setYoutubeNeedsTitle(false);
  };

  /*
   * No link validation here, unlike YouTube's: the server recognises a
   * Songsterr link, checks the page it lands on is really that song's tab,
   * and says so in a sentence. A second rule here could only disagree.
   */
  const handleSongsterrSubmit = async () => {
    if (!songsterrUrl.trim()) return;
    setSongsterrError("");
    const message = await onSongsterrImport(songsterrUrl.trim());
    if (message) {
      setSongsterrError(message);
      return;
    }
    closeTabModal();
  };

  const closeTabModal = () => {
    setShowTabModal(false);
    setSongsterrUrl("");
    setSongsterrError("");
  };

  /** Picking a file is the other way in; the modal has done its job. */
  const chooseFile = (ref: { current: HTMLInputElement | null }, close: () => void) => {
    close();
    ref.current?.click();
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* One modal per kind of thing added; each takes a link or a file. */}
      {showAudioModal && (
        <AddSourceModal
          title="Add audio"
          linkLabel="YouTube URL"
          linkPlaceholder="https://www.youtube.com/watch?v=..."
          url={youtubeUrl}
          onUrlChange={(value) => { setYoutubeUrl(value); setYoutubeError(""); }}
          onSubmit={handleYouTubeSubmit}
          onCancel={closeAudioModal}
          onChooseFile={() => chooseFile(uploadInputRef, closeAudioModal)}
          fileHint="mp3, flac, wav, ogg, m4a, aac"
          busy={isImportingFromYouTube}
          busyNote="Importing... this may take a moment"
          error={youtubeError}
        >
          {/*
            Only shown once the server has told us it could not read the
            video's own title, which is the only time we need to ask.
          */}
          {youtubeNeedsTitle && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Track Title</label>
              <input
                type="text"
                value={youtubeTitle}
                onChange={(e) => { setYoutubeTitle(e.target.value); setYoutubeError(""); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && youtubeTitle.trim() && !isImportingFromYouTube) handleYouTubeSubmit();
                  if (e.key === "Escape") closeAudioModal();
                }}
                placeholder="Enter a name for this track"
                disabled={isImportingFromYouTube}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                autoFocus
              />
            </div>
          )}
        </AddSourceModal>
      )}

      {showTabModal && (
        <AddSourceModal
          title="Add tab"
          linkLabel="Songsterr link"
          linkPlaceholder="https://www.songsterr.com/a/wsa/..."
          url={songsterrUrl}
          onUrlChange={(value) => { setSongsterrUrl(value); setSongsterrError(""); }}
          onSubmit={handleSongsterrSubmit}
          onCancel={closeTabModal}
          onChooseFile={() => chooseFile(gpUploadInputRef, closeTabModal)}
          fileHint="gp, gp3, gp4, gp5, gpx"
          busy={isImportingFromSongsterr}
          busyNote="Fetching the score from Songsterr…"
          error={songsterrError}
        />
      )}

      {/* Header */}
      <div className="shrink-0 px-3 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-purple-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <h2 className="text-base font-bold text-white">Jam Tracks</h2>
        </div>
        {/*
          One way in. Three separate buttons implied three separate kinds of
          thing; a song is one entry whichever way its contents arrived.
        */}
        <div className="relative">
          <button
            onClick={() => setShowAddMenu((v) => !v)}
            disabled={busy}
            aria-expanded={showAddMenu}
            className="flex items-center gap-1.5 px-2 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs font-medium text-white transition-colors"
          >
            {busy ? "Working..." : "+ Add track"}
          </button>
          {showAddMenu && !busy && (
            <div className="absolute z-30 mt-1 left-0 w-52 rounded bg-gray-800 border border-gray-600 shadow-xl overflow-hidden">
              <button
                onClick={() => { setShowAddMenu(false); setShowAudioModal(true); }}
                className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-gray-700"
              >
                Add audio
                <span className="block text-[10px] text-gray-500">a recording to play along to</span>
              </button>
              <button
                onClick={() => { setShowAddMenu(false); setShowTabModal(true); }}
                className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-gray-700"
              >
                Add tab
                <span className="block text-[10px] text-gray-500">a score to read</span>
              </button>
            </div>
          )}
        </div>
        <input
          ref={uploadInputRef}
          type="file"
          multiple
          accept=".mp3,.flac,.wav,.ogg,.m4a,.aac"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onUpload(e.target.files);
              e.target.value = "";
            }
          }}
          className="hidden"
        />
        <input
          ref={gpUploadInputRef}
          type="file"
          multiple
          accept=".gp,.gp3,.gp4,.gp5,.gpx"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onGpUpload(e.target.files);
              e.target.value = "";
            }
          }}
          className="hidden"
        />
        <p className="text-xs text-gray-500 mt-1.5">
          {jamTracks.length} track{jamTracks.length !== 1 ? "s" : ""}
          {gpSongs.length > 0 ? `, ${gpSongs.length} Guitar Pro` : ""}
        </p>
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto py-1">
        {gpSongs.map((song) => {
          const isSelected = song.id === currentGpSongId;
          return (
            <div
              key={song.id}
              className={`w-full px-3 py-2 flex items-center gap-2 transition-colors group ${
                isSelected ? "bg-gray-700 text-white" : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              <button
                onClick={() => onSelectGpSong(song.id)}
                className="flex-1 min-w-0 text-left flex items-center gap-2"
              >
                <span className="shrink-0 px-1 py-0.5 text-[10px] leading-none rounded bg-purple-900 border border-purple-700 text-purple-200">
                  GP
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-sm">{song.title}</span>
                  {song.artist && (
                    <span className="block truncate text-xs text-gray-500">{song.artist}</span>
                  )}
                </span>
              </button>
              <button
                onClick={() => onToggleGpFavorite(song.id)}
                aria-label={song.favorite ? `Unfavourite ${song.title}` : `Favourite ${song.title}`}
                title={song.favorite ? "Remove from favourites" : "Add to favourites"}
                className={`shrink-0 text-sm ${
                  song.favorite ? "text-yellow-400" : "text-gray-600 hover:text-gray-300"
                }`}
              >
                {song.favorite ? "★" : "☆"}
              </button>
              {/*
                A GP song that cannot be removed is a dead row forever: the
                import route refuses the same filename while it exists, so a
                wrong or unplayable import could not even be replaced.
              */}
              <button
                onClick={() => {
                  if (confirm(`Delete "${song.title}"? This removes the file too.`)) {
                    onDeleteGpSong(song.id);
                  }
                }}
                aria-label={`Delete ${song.title}`}
                title="Delete this Guitar Pro song"
                className="shrink-0 text-xs text-gray-600 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          );
        })}
        {jamTracks.length === 0 && gpSongs.length === 0 ? (
          <div className="text-center text-gray-500 py-8 px-3">
            <svg className="w-10 h-10 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <p className="text-sm">No jam tracks yet</p>
            <p className="text-xs mt-1">Add audio to play along to, or a tab to read</p>
          </div>
        ) : (
          jamTracks.map((jt) => {
            const isSelected = jt.id === currentJamTrackId;
            return (
              <button
                key={jt.id}
                onClick={() => onSelect(jt.id)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors group ${
                  isSelected
                    ? "bg-purple-900/40 border-l-2 border-purple-400"
                    : "border-l-2 border-transparent hover:bg-gray-800"
                }`}
              >
                <svg
                  className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-purple-400" : "text-gray-600 group-hover:text-gray-400"}`}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>

                <span
                  className={`flex-1 truncate text-sm ${
                    isSelected ? "text-purple-200 font-medium" : "text-gray-300"
                  }`}
                >
                  {jt.title}
                </span>
                {jamTrackIdsWithTab.includes(jt.id) && (
                  <span
                    title="This track has a Guitar Pro tab"
                    className="shrink-0 px-1 py-0.5 text-[10px] leading-none rounded bg-purple-900 border border-purple-700 text-purple-200"
                  >
                    GP
                  </span>
                )}

                {/* Completion badge */}
                {jt.completed && (
                  <span className="shrink-0 w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center" title="Completed">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}

                {/* In-progress badge */}
                {jt.inProgress && !jt.completed && (
                  <span
                    className="shrink-0 w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500 flex items-center justify-center"
                    title="In progress"
                  >
                    <svg className="w-2.5 h-2.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                )}

                <span className="shrink-0 text-xs text-gray-500 tabular-nums">
                  {formatDuration(jt.duration)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
