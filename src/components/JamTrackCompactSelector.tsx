'use client';

import { useState, useRef, useEffect } from 'react';
import type { JamTrack } from '@/types';
import { sortPdfs, getPdfAbbreviation } from '@/lib/formatting';

interface JamTrackCompactSelectorProps {
  jamTracks: JamTrack[];
  currentJamTrack: JamTrack;
  onJamTrackSelect: (jamTrack: JamTrack) => void;
  onJamTrackUpdate?: (jamTrackId: string, title: string, tempo: number | null, timeSignature: string) => Promise<void>;
  onUpload?: (files: FileList) => Promise<void>;
  isUploading?: boolean;
  onYouTubeImport?: (url: string, title?: string) => Promise<void>;
  isImportingFromYouTube?: boolean;
  onPsarcImport?: (file: File) => Promise<void>;
  isImportingPsarc?: boolean;
}

export default function JamTrackCompactSelector({
  jamTracks,
  currentJamTrack,
  onJamTrackSelect,
  onJamTrackUpdate,
  onUpload,
  isUploading,
  onYouTubeImport,
  isImportingFromYouTube,
  onPsarcImport,
  isImportingPsarc,
}: JamTrackCompactSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editTempo, setEditTempo] = useState('');
  const [editTimeSignature, setEditTimeSignature] = useState<string>('4/4');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const psarcInputRef = useRef<HTMLInputElement>(null);

  // Click outside and ESC key handlers
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExpanded(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isExpanded]);

  // Format duration MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle edit modal
  const handleEdit = () => {
    setEditTitle(currentJamTrack.title);
    setEditTempo(currentJamTrack.tempo?.toString() || '');
    setEditTimeSignature(currentJamTrack.timeSignature || '4/4');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (onJamTrackUpdate && editTitle.trim()) {
      const tempo = editTempo ? parseInt(editTempo) : null;
      await onJamTrackUpdate(currentJamTrack.id, editTitle, tempo, editTimeSignature);
      setShowEditModal(false);
    }
  };

  return (
    <div className="relative bg-gray-900 border-b border-gray-700" ref={dropdownRef}>
      {/* Collapsed State - Compact Selector Bar */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Dropdown Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 flex-1 min-w-0 px-3 py-2 bg-gray-800/50 hover:bg-gray-800 rounded-lg border border-purple-500/30 hover:border-purple-500/50 transition-colors group"
        >
          {/* Play Icon */}
          <svg className="w-5 h-5 text-purple-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>

          {/* Track Title */}
          <span className="flex-1 truncate text-left font-medium text-purple-300">
            {currentJamTrack.title}
          </span>

          {/* PDF/Tab abbreviations */}
          {currentJamTrack.pdfs.length > 0 && (
            <span className="flex gap-1 shrink-0">
              {sortPdfs(currentJamTrack.pdfs).map((pdf) => (
                <span
                  key={pdf.id}
                  className={`text-[10px] font-bold w-4 h-4 rounded flex items-center justify-center ${
                    pdf.fileType === "alphatex"
                      ? "bg-orange-500/20 text-orange-400"
                      : "bg-blue-500/20 text-blue-400"
                  }`}
                  title={pdf.name}
                >
                  {getPdfAbbreviation(pdf.name)}
                </span>
              ))}
            </span>
          )}

          {/* Duration */}
          <span className="text-xs text-gray-400 flex-shrink-0">
            {formatDuration(currentJamTrack.duration)}
          </span>

          {/* Chevron */}
          <svg
            className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Edit Button */}
        {onJamTrackUpdate && (
          <button
            onClick={handleEdit}
            className="flex items-center gap-2 px-3 py-2 border border-gray-600 hover:bg-gray-700 rounded text-sm font-medium text-gray-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="hidden sm:inline">Edit</span>
          </button>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Rocksmith Import */}
          {onPsarcImport && (
            <>
              <button
                onClick={() => psarcInputRef.current?.click()}
                disabled={isImportingPsarc}
                className="flex items-center gap-2 px-3 py-2 border border-orange-600 hover:bg-orange-600/20 disabled:border-gray-600 disabled:cursor-not-allowed rounded text-sm font-medium text-orange-300 transition-colors"
              >
                {isImportingPsarc ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                )}
                <span className="hidden sm:inline">{isImportingPsarc ? "Importing..." : "Rocksmith"}</span>
              </button>
              <input
                ref={psarcInputRef}
                type="file"
                accept=".psarc"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    await onPsarcImport(file);
                    e.target.value = "";
                  }
                }}
                className="hidden"
              />
            </>
          )}

          {/* YouTube Import */}
          {onYouTubeImport && (
            <button
              onClick={() => alert('YouTube import modal coming soon')} // TODO: implement modal
              disabled={isImportingFromYouTube}
              className="flex items-center gap-2 px-3 py-2 border border-purple-600 hover:bg-purple-600/20 disabled:border-gray-600 disabled:cursor-not-allowed rounded text-sm font-medium text-purple-300 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <span className="hidden sm:inline">YouTube</span>
            </button>
          )}

          {/* Upload Files */}
          {onUpload && (
            <>
              <button
                onClick={() => uploadInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm font-medium text-white transition-colors"
              >
                {isUploading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                )}
                <span className="hidden sm:inline">{isUploading ? "Uploading..." : "Upload"}</span>
              </button>
              <input
                ref={uploadInputRef}
                type="file"
                multiple
                accept=".mp3,.flac,.wav,.ogg,.m4a,.aac"
                onChange={async (e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    await onUpload(e.target.files);
                    e.target.value = "";
                  }
                }}
                className="hidden"
              />
            </>
          )}
        </div>
      </div>

      {/* Expanded State - Dropdown with Track List */}
      {isExpanded && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-50 max-h-[400px] overflow-y-auto">
          <div className="p-2 space-y-1">
            {jamTracks.map((jamTrack) => (
              <button
                key={jamTrack.id}
                onClick={() => {
                  onJamTrackSelect(jamTrack);
                  setIsExpanded(false);
                }}
                className={`w-full rounded-lg transition-colors ${
                  currentJamTrack.id === jamTrack.id
                    ? "bg-purple-900/30 border border-purple-500/50"
                    : "bg-gray-800/50 hover:bg-gray-700 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Play Icon */}
                  <span className="w-8 text-center flex-shrink-0">
                    {currentJamTrack.id === jamTrack.id ? (
                      <svg className="w-5 h-5 mx-auto text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 mx-auto text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </span>

                  {/* Title */}
                  <span className={`flex-1 truncate text-left font-medium ${
                    currentJamTrack.id === jamTrack.id ? "text-purple-300" : "text-gray-200"
                  }`}>
                    {jamTrack.title}
                  </span>

                  {/* PDF/Tab abbreviations */}
                  {jamTrack.pdfs.length > 0 && (
                    <span className="flex gap-1 shrink-0">
                      {sortPdfs(jamTrack.pdfs).map((pdf) => (
                        <span
                          key={pdf.id}
                          className={`text-[10px] font-bold w-4 h-4 rounded flex items-center justify-center ${
                            pdf.fileType === "alphatex"
                              ? "bg-orange-500/20 text-orange-400"
                              : "bg-blue-500/20 text-blue-400"
                          }`}
                          title={pdf.name}
                        >
                          {getPdfAbbreviation(pdf.name)}
                        </span>
                      ))}
                    </span>
                  )}

                  {/* Duration */}
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {formatDuration(jamTrack.duration)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Edit Jam Track</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Tempo (BPM)</label>
                <input
                  type="number"
                  value={editTempo}
                  onChange={(e) => setEditTempo(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Time Signature</label>
                <select
                  value={editTimeSignature}
                  onChange={(e) => setEditTimeSignature(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="4/4">4/4</option>
                  <option value="3/4">3/4</option>
                  <option value="6/8">6/8</option>
                  <option value="5/4">5/4</option>
                  <option value="7/8">7/8</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 border border-gray-600 hover:bg-gray-700 rounded text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editTitle.trim()}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
