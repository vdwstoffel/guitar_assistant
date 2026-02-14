'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { GuitarTab } from '@/types/tab';
import AlphaTabRenderer, { AlphaTabRendererRef, Track } from './tab-editor/AlphaTabRenderer';

export default function TabEditor() {
  const [tabs, setTabs] = useState<GuitarTab[]>([]);
  const [selectedTab, setSelectedTab] = useState<GuitarTab | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [availableTracks, setAvailableTracks] = useState<Track[]>([]);
  const [selectedTrackIndices, setSelectedTrackIndices] = useState<number[]>([]);

  const alphaTabRef = useRef<AlphaTabRendererRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  // Fetch tabs on mount and restore selected tab from URL
  useEffect(() => {
    fetchTabs();
  }, []);

  const fetchTabs = async () => {
    try {
      const response = await fetch('/api/tabs');
      if (response.ok) {
        const data = await response.json();
        setTabs(data);

        // Restore selected tab from URL
        const tabId = searchParams.get('tab');
        if (tabId) {
          const tab = data.find((t: GuitarTab) => t.id === tabId);
          if (tab) {
            setSelectedTab(tab);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch tabs:', error);
    }
  };

  const selectTab = (tab: GuitarTab) => {
    setSelectedTab(tab);
    // Reset tracks when switching tabs
    setAvailableTracks([]);
    setSelectedTrackIndices([]);
    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab.id);
    url.searchParams.delete('track'); // Remove old track param
    router.push(url.pathname + url.search, { scroll: false });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/tabs', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const newTab = await response.json();
      await fetchTabs();
      selectTab(newTab);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (tab: GuitarTab) => {
    if (!confirm(`Delete "${tab.title}"?`)) return;

    try {
      const response = await fetch(`/api/tabs/${tab.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        if (selectedTab?.id === tab.id) {
          setSelectedTab(null);
        }
        await fetchTabs();
      }
    } catch (error) {
      console.error('Failed to delete tab:', error);
    }
  };

  const handleToggleCompleted = async (tab: GuitarTab) => {
    try {
      const response = await fetch(`/api/tabs/${tab.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !tab.completed }),
      });

      if (response.ok) {
        await fetchTabs();
        if (selectedTab?.id === tab.id) {
          const updated = await response.json();
          setSelectedTab(updated);
        }
      }
    } catch (error) {
      console.error('Failed to update tab:', error);
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      alphaTabRef.current?.pause();
    } else {
      alphaTabRef.current?.play();
    }
  };

  const handleStop = () => {
    alphaTabRef.current?.stop();
  };

  const handleTracksLoaded = (tracks: Track[]) => {
    console.log('Tracks loaded:', tracks);
    setAvailableTracks(tracks);

    // Restore track selection from URL or default to first track
    const trackParam = searchParams.get('track');
    if (trackParam) {
      const trackIndex = parseInt(trackParam, 10);
      if (!isNaN(trackIndex) && trackIndex >= 0 && trackIndex < tracks.length) {
        setSelectedTrackIndices([trackIndex]);
        return;
      }
    }
    // Default to first track
    setSelectedTrackIndices([0]);
  };

  const handleTrackSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const trackIndex = parseInt(e.target.value, 10);

    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.set('track', trackIndex.toString());
    router.push(url.pathname + url.search, { scroll: false });

    setSelectedTrackIndices([trackIndex]);
  };

  return (
    <div className="flex h-full gap-4 p-4">
      {/* Sidebar - Tab List */}
      <div className="w-80 flex flex-col gap-4">
        {/* Upload Section */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-3">Upload Guitar Tab</h2>

          <input
            ref={fileInputRef}
            type="file"
            accept=".gp3,.gp4,.gp5,.gpx,.gp"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white rounded font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Choose Guitar Pro File</span>
              </>
            )}
          </button>

          {uploadError && (
            <div className="mt-3 p-2 bg-red-500/10 border border-red-500 rounded text-red-400 text-sm">
              {uploadError}
            </div>
          )}

          <p className="mt-3 text-xs text-gray-400">
            Supports: .gp3, .gp4, .gp5, .gpx, .gp
          </p>
        </div>

        {/* Tabs List */}
        <div className="flex-1 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white">Your Tabs ({tabs.length})</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {tabs.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <p>No tabs yet</p>
                <p className="text-sm mt-2">Upload a Guitar Pro file to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={`p-3 rounded border-2 transition-colors cursor-pointer ${
                      selectedTab?.id === tab.id
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-700 bg-gray-700/50 hover:border-gray-600'
                    }`}
                    onClick={() => selectTab(tab)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">{tab.title}</h3>
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(tab.updatedAt).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleCompleted(tab);
                          }}
                          className={`p-1.5 rounded transition-colors ${
                            tab.completed
                              ? 'text-green-400 hover:text-green-300'
                              : 'text-gray-500 hover:text-gray-400'
                          }`}
                          title={tab.completed ? 'Mark incomplete' : 'Mark complete'}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(tab);
                          }}
                          className="p-1.5 text-gray-500 hover:text-red-400 rounded transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Tab Player */}
      <div className="flex-1 flex flex-col gap-4">
        {selectedTab ? (
          <>
            {/* Header */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h1 className="text-2xl font-bold text-white">{selectedTab.title}</h1>
              {(selectedTab.tempo || selectedTab.timeSignature) && (
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                  {selectedTab.tempo && <span>{selectedTab.tempo} BPM</span>}
                  {selectedTab.timeSignature && <span>{selectedTab.timeSignature}</span>}
                </div>
              )}
            </div>

            {/* Player Controls */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePlayPause}
                  className="p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full transition-colors"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={handleStop}
                  className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-colors"
                  title="Stop"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Track Selector */}
                {availableTracks.length > 1 && (
                  <div className="ml-auto flex items-center gap-2">
                    <label htmlFor="track-select" className="text-sm text-gray-400">
                      Track:
                    </label>
                    <select
                      id="track-select"
                      value={selectedTrackIndices[0] ?? 0}
                      onChange={handleTrackSelectionChange}
                      className="bg-gray-700 text-white border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500"
                    >
                      {availableTracks.map((track) => (
                        <option key={track.index} value={track.index}>
                          {track.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Notation Renderer */}
            <div className="flex-1 overflow-auto">
              <AlphaTabRenderer
                ref={alphaTabRef}
                fileUrl={`/api/tabs/${selectedTab.id}/file`}
                tempo={selectedTab.tempo || undefined}
                selectedTrackIndices={selectedTrackIndices.length > 0 ? selectedTrackIndices : undefined}
                onPlayerStateChange={setIsPlaying}
                onError={(error) => console.error('AlphaTab error:', error)}
                onTracksLoaded={handleTracksLoaded}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-800 rounded-lg border border-gray-700">
            <div className="text-center text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <p className="text-lg">Select a tab to view and play</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
