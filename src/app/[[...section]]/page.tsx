"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ArtistSidebar from "@/components/ArtistSidebar";
import AlbumGrid from "@/components/AlbumGrid";
import TrackListView from "@/components/TrackListView";
import BottomPlayer, { MarkerBarState } from "@/components/BottomPlayer";
import MarkersBar from "@/components/MarkersBar";
import TopNav from "@/components/TopNav";
import Metronome from "@/components/Metronome";
import Fretboard from "@/components/Fretboard";
import PdfViewer from "@/components/PdfViewer";
import Videos from "@/components/Videos";
import { Artist, Album, Song, Marker } from "@/types";

type Section = 'library' | 'videos' | 'metronome' | 'fretboard';

const getSectionFromPath = (section: string[] | undefined): Section => {
  if (!section || section.length === 0) return 'library';
  const first = section[0];
  if (first === 'videos' || first === 'metronome' || first === 'fretboard') {
    return first;
  }
  return 'library';
};

export default function Home() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [currentArtist, setCurrentArtist] = useState<Artist | null>(null);
  const [currentAlbum, setCurrentAlbum] = useState<Album | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // PDF state
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfVersion, setPdfVersion] = useState(0);

  // Marker bar state from BottomPlayer
  const [markerBarState, setMarkerBarState] = useState<MarkerBarState | null>(null);

  // Get active section from URL path
  const activeSection = getSectionFromPath(params.section as string[] | undefined);

  // Helper to update library URL with artist/album params
  const updateLibraryUrl = (artistId: string | null, albumId: string | null) => {
    const params = new URLSearchParams();
    if (artistId) params.set('artist', artistId);
    if (albumId) params.set('album', albumId);
    const newUrl = params.toString() ? `/?${params.toString()}` : '/';
    window.history.replaceState({}, '', newUrl);
  };

  const handleSectionChange = (section: Section) => {
    if (section !== 'library') {
      setCurrentSong(null);
      setCurrentArtist(null);
      setCurrentAlbum(null);
    }
    if (section === 'library') {
      router.push('/');
    } else {
      router.push(`/${section}`);
    }
  };

  const fetchLibrary = useCallback(async (restoreFromUrl = false) => {
    try {
      const response = await fetch("/api/library");
      if (response.ok) {
        const data = await response.json();
        setArtists(data);

        // Restore state from URL on initial load
        if (restoreFromUrl) {
          const artistId = searchParams.get('artist');
          const albumId = searchParams.get('album');
          if (artistId) {
            const artist = data.find((a: Artist) => a.id === artistId);
            if (artist) {
              setSelectedArtist(artist);
              if (albumId) {
                const album = artist.albums.find((al: Album) => al.id === albumId);
                if (album) {
                  setSelectedAlbum(album);
                  if (album.pdfPath) {
                    setPdfPath(album.pdfPath);
                  }
                }
              }
            }
          }
          return;
        }

        // Update selected artist if it exists in new data
        if (selectedArtist) {
          const updatedArtist = data.find((a: Artist) => a.id === selectedArtist.id);
          if (updatedArtist) {
            setSelectedArtist(updatedArtist);
          }
        }

        // Update selected album if it exists in new data
        if (selectedAlbum && selectedArtist) {
          const updatedArtist = data.find((a: Artist) => a.id === selectedArtist.id);
          if (updatedArtist) {
            const updatedAlbum = updatedArtist.albums.find((al: Album) => al.id === selectedAlbum.id);
            if (updatedAlbum) {
              setSelectedAlbum(updatedAlbum);
            }
          }
        }

        // Update current song markers if song is playing
        if (currentSong) {
          for (const artist of data) {
            for (const album of artist.albums) {
              const song = album.songs.find(
                (s: Song) => s.id === currentSong.id
              );
              if (song) {
                setCurrentSong(song);
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching library:", error);
    }
  }, [currentSong, selectedArtist, selectedAlbum, searchParams]);

  useEffect(() => {
    fetchLibrary(true); // Restore from URL on initial load
  }, []);

  const handleArtistSelect = (artist: Artist) => {
    setSelectedArtist(artist);
    setSelectedAlbum(null);
    updateLibraryUrl(artist.id, null);
  };

  const handleAlbumSelect = (album: Album) => {
    setSelectedAlbum(album);
    // Auto-show PDF if album has one
    if (album.pdfPath) {
      setPdfPath(album.pdfPath);
    }
    updateLibraryUrl(selectedArtist?.id || null, album.id);
  };

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const response = await fetch("/api/library/scan", { method: "POST" });
      if (response.ok) {
        await fetchLibrary();
      }
    } catch (error) {
      console.error("Error scanning library:", error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleUpload = async (files: FileList) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }

      const response = await fetch("/api/library/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        await fetchLibrary();
      }
    } catch (error) {
      console.error("Error uploading files:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSongSelect = (song: Song, artist: Artist, album: Album) => {
    setCurrentSong(song);
    setCurrentArtist(artist);
    setCurrentAlbum(album);
    // Update PDF path if album has one
    if (album.pdfPath) {
      setPdfPath(album.pdfPath);
    }
  };

  const handleMarkerAdd = async (
    songId: string,
    name: string,
    timestamp: number
  ) => {
    try {
      const response = await fetch("/api/markers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId, name, timestamp }),
      });
      if (response.ok) {
        const newMarker: Marker = await response.json();
        // Update the current song's markers
        if (currentSong && currentSong.id === songId) {
          setCurrentSong({
            ...currentSong,
            markers: [...currentSong.markers, newMarker],
          });
        }
        // Also update in the artists list
        setArtists((prevArtists) =>
          prevArtists.map((artist) => ({
            ...artist,
            albums: artist.albums.map((album) => ({
              ...album,
              songs: album.songs.map((song) =>
                song.id === songId
                  ? { ...song, markers: [...song.markers, newMarker] }
                  : song
              ),
            })),
          }))
        );
        // Update selected artist too
        if (selectedArtist) {
          setSelectedArtist((prev) =>
            prev
              ? {
                  ...prev,
                  albums: prev.albums.map((album) => ({
                    ...album,
                    songs: album.songs.map((song) =>
                      song.id === songId
                        ? { ...song, markers: [...song.markers, newMarker] }
                        : song
                    ),
                  })),
                }
              : null
          );
        }
        // Update selected album too
        if (selectedAlbum) {
          setSelectedAlbum((prev) =>
            prev
              ? {
                  ...prev,
                  songs: prev.songs.map((song) =>
                    song.id === songId
                      ? { ...song, markers: [...song.markers, newMarker] }
                      : song
                  ),
                }
              : null
          );
        }
      }
    } catch (error) {
      console.error("Error adding marker:", error);
    }
  };

  const handleMarkerUpdate = async (markerId: string, timestamp: number) => {
    try {
      const response = await fetch(`/api/markers/${markerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp }),
      });
      if (response.ok) {
        const updateMarkers = (songs: Song[]) =>
          songs.map((song) => ({
            ...song,
            markers: song.markers.map((m) =>
              m.id === markerId ? { ...m, timestamp } : m
            ),
          }));

        if (currentSong) {
          setCurrentSong({
            ...currentSong,
            markers: currentSong.markers.map((m) =>
              m.id === markerId ? { ...m, timestamp } : m
            ),
          });
        }

        setArtists((prevArtists) =>
          prevArtists.map((artist) => ({
            ...artist,
            albums: artist.albums.map((album) => ({
              ...album,
              songs: updateMarkers(album.songs),
            })),
          }))
        );

        if (selectedArtist) {
          setSelectedArtist((prev) =>
            prev
              ? {
                  ...prev,
                  albums: prev.albums.map((album) => ({
                    ...album,
                    songs: updateMarkers(album.songs),
                  })),
                }
              : null
          );
        }

        if (selectedAlbum) {
          setSelectedAlbum((prev) =>
            prev
              ? {
                  ...prev,
                  songs: updateMarkers(prev.songs),
                }
              : null
          );
        }
      }
    } catch (error) {
      console.error("Error updating marker:", error);
    }
  };

  const handleMarkerRename = async (markerId: string, name: string) => {
    try {
      const response = await fetch(`/api/markers/${markerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (response.ok) {
        const updateMarkers = (songs: Song[]) =>
          songs.map((song) => ({
            ...song,
            markers: song.markers.map((m) =>
              m.id === markerId ? { ...m, name } : m
            ),
          }));

        if (currentSong) {
          setCurrentSong({
            ...currentSong,
            markers: currentSong.markers.map((m) =>
              m.id === markerId ? { ...m, name } : m
            ),
          });
        }

        setArtists((prevArtists) =>
          prevArtists.map((artist) => ({
            ...artist,
            albums: artist.albums.map((album) => ({
              ...album,
              songs: updateMarkers(album.songs),
            })),
          }))
        );

        if (selectedArtist) {
          setSelectedArtist((prev) =>
            prev
              ? {
                  ...prev,
                  albums: prev.albums.map((album) => ({
                    ...album,
                    songs: updateMarkers(album.songs),
                  })),
                }
              : null
          );
        }

        if (selectedAlbum) {
          setSelectedAlbum((prev) =>
            prev
              ? {
                  ...prev,
                  songs: updateMarkers(prev.songs),
                }
              : null
          );
        }
      }
    } catch (error) {
      console.error("Error renaming marker:", error);
    }
  };

  const handleMarkerDelete = async (markerId: string) => {
    try {
      const response = await fetch(`/api/markers/${markerId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        const updateMarkers = (songs: Song[]) =>
          songs.map((song) => ({
            ...song,
            markers: song.markers.filter((m) => m.id !== markerId),
          }));

        if (currentSong) {
          setCurrentSong({
            ...currentSong,
            markers: currentSong.markers.filter((m) => m.id !== markerId),
          });
        }

        setArtists((prevArtists) =>
          prevArtists.map((artist) => ({
            ...artist,
            albums: artist.albums.map((album) => ({
              ...album,
              songs: updateMarkers(album.songs),
            })),
          }))
        );

        if (selectedArtist) {
          setSelectedArtist((prev) =>
            prev
              ? {
                  ...prev,
                  albums: prev.albums.map((album) => ({
                    ...album,
                    songs: updateMarkers(album.songs),
                  })),
                }
              : null
          );
        }

        if (selectedAlbum) {
          setSelectedAlbum((prev) =>
            prev
              ? {
                  ...prev,
                  songs: updateMarkers(prev.songs),
                }
              : null
          );
        }
      }
    } catch (error) {
      console.error("Error deleting marker:", error);
    }
  };

  const handleMarkersClear = async (songId: string) => {
    try {
      const response = await fetch(`/api/markers/clear/${songId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        const updateMarkers = (songs: Song[]) =>
          songs.map((song) =>
            song.id === songId ? { ...song, markers: [] } : song
          );

        if (currentSong && currentSong.id === songId) {
          setCurrentSong({
            ...currentSong,
            markers: [],
          });
        }

        setArtists((prevArtists) =>
          prevArtists.map((artist) => ({
            ...artist,
            albums: artist.albums.map((album) => ({
              ...album,
              songs: updateMarkers(album.songs),
            })),
          }))
        );

        if (selectedArtist) {
          setSelectedArtist((prev) =>
            prev
              ? {
                  ...prev,
                  albums: prev.albums.map((album) => ({
                    ...album,
                    songs: updateMarkers(album.songs),
                  })),
                }
              : null
          );
        }

        if (selectedAlbum) {
          setSelectedAlbum((prev) =>
            prev
              ? {
                  ...prev,
                  songs: updateMarkers(prev.songs),
                }
              : null
          );
        }
      }
    } catch (error) {
      console.error("Error clearing markers:", error);
    }
  };

  const handleMetadataUpdate = async (
    songId: string,
    title: string,
    artistName: string,
    albumName: string,
    trackNumber: number,
    pdfPage?: number | null
  ) => {
    const response = await fetch(`/api/songs/${songId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, artist: artistName, album: albumName, trackNumber, pdfPage }),
    });

    if (!response.ok) {
      throw new Error("Failed to update metadata");
    }

    const { song, artist, album } = await response.json();

    setCurrentSong(song);
    setCurrentArtist(artist);
    setCurrentAlbum(album);

    await fetchLibrary();
  };

  const handleAlbumUpdate = async (
    albumId: string,
    albumName: string,
    artistName: string
  ) => {
    const response = await fetch(`/api/albums/${albumId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumName, artistName }),
    });

    if (!response.ok) {
      throw new Error("Failed to update album metadata");
    }

    await fetchLibrary();
  };

  const handleSongComplete = async (songId: string, completed: boolean) => {
    const response = await fetch(`/api/songs/${songId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });

    if (!response.ok) {
      throw new Error("Failed to update song completed status");
    }

    // Update local state
    const updateSongs = (songs: Song[]) =>
      songs.map((song) =>
        song.id === songId ? { ...song, completed } : song
      );

    if (currentSong?.id === songId) {
      setCurrentSong({ ...currentSong, completed });
    }

    setArtists((prevArtists) =>
      prevArtists.map((artist) => ({
        ...artist,
        albums: artist.albums.map((album) => ({
          ...album,
          songs: updateSongs(album.songs),
        })),
      }))
    );

    if (selectedArtist) {
      setSelectedArtist((prev) =>
        prev
          ? {
              ...prev,
              albums: prev.albums.map((album) => ({
                ...album,
                songs: updateSongs(album.songs),
              })),
            }
          : null
      );
    }

    if (selectedAlbum) {
      setSelectedAlbum((prev) =>
        prev
          ? {
              ...prev,
              songs: updateSongs(prev.songs),
            }
          : null
      );
    }
  };

  // PDF handlers
  const handlePdfUpload = async (albumId: string, file: File) => {
    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const response = await fetch(`/api/albums/${albumId}/pdf`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        await fetchLibrary();
      }
    } catch (error) {
      console.error("Error uploading PDF:", error);
    }
  };

  const handlePdfDelete = async (albumId: string) => {
    try {
      const response = await fetch(`/api/albums/${albumId}/pdf`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchLibrary();
        setPdfPath(null);
      }
    } catch (error) {
      console.error("Error deleting PDF:", error);
    }
  };

  const handlePdfConvert = async (albumId: string) => {
    try {
      const response = await fetch(`/api/albums/${albumId}/pdf`, {
        method: "PATCH",
      });

      if (response.ok) {
        // Increment version to bust the cache and force reload
        setPdfVersion((v) => v + 1);
      } else {
        const data = await response.json();
        console.error("PDF conversion failed:", data.error);
      }
    } catch (error) {
      console.error("Error converting PDF:", error);
    }
  };

  const handleShowPdf = (albumPdfPath: string, page?: number) => {
    setPdfPath(albumPdfPath);
    if (page) {
      setPdfPage(page);
    }
  };

  // Auto-navigate to song's PDF page when song changes
  useEffect(() => {
    if (currentSong?.pdfPage) {
      setPdfPage(currentSong.pdfPage);
    }
  }, [currentSong?.id, currentSong?.pdfPage]);


  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Top Navigation */}
      <TopNav activeSection={activeSection} onSectionChange={handleSectionChange} />

      {/* Section Content */}
      {activeSection === 'library' ? (
        <>
          <div className="flex flex-1 min-h-0">
            {/* Left side: Sidebar + Content + Player - 50% width */}
            <div className="w-1/2 flex flex-col min-w-0 border-r border-gray-700">
              {/* Main Content Area */}
              <div className="flex flex-1 min-h-0">
                {/* Artist Sidebar */}
                <div className="w-56 border-r border-gray-700 shrink-0">
                  <ArtistSidebar
                    artists={artists}
                    selectedArtist={selectedArtist}
                    onArtistSelect={handleArtistSelect}
                    onScan={handleScan}
                    onUpload={handleUpload}
                    isScanning={isScanning}
                    isUploading={isUploading}
                  />
                </div>

                {/* Content: AlbumGrid OR TrackListView */}
                <div className="flex-1 min-w-0">
                  {selectedAlbum && selectedArtist ? (
                    <TrackListView
                      artist={selectedArtist}
                      album={selectedAlbum}
                      currentSong={currentSong}
                      onSongSelect={handleSongSelect}
                      onBack={() => {
                        setSelectedAlbum(null);
                        updateLibraryUrl(selectedArtist?.id || null, null);
                      }}
                      onAlbumUpdate={handleAlbumUpdate}
                      onSongUpdate={handleMetadataUpdate}
                      onSongComplete={handleSongComplete}
                      onShowPdf={handleShowPdf}
                      onPdfUpload={handlePdfUpload}
                      onPdfDelete={handlePdfDelete}
                      onPdfConvert={handlePdfConvert}
                    />
                  ) : selectedArtist ? (
                    <AlbumGrid
                      artist={selectedArtist}
                      onAlbumSelect={handleAlbumSelect}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center bg-gray-900 text-gray-500">
                      <div className="text-center">
                        <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                        <p className="text-lg">Select an artist to view albums</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Player - Fixed height for waveform visibility */}
              <div className="h-[30vh] min-h-55 max-h-80 shrink-0">
                <BottomPlayer
                  song={currentSong}
                  onMarkerAdd={handleMarkerAdd}
                  onMarkerUpdate={handleMarkerUpdate}
                  onMarkerRename={handleMarkerRename}
                  onMarkerDelete={handleMarkerDelete}
                  onMarkersClear={handleMarkersClear}
                  externalMarkersBar={true}
                  onMarkerBarStateChange={setMarkerBarState}
                />
              </div>
            </div>

            {/* PDF Panel - Always visible, 50% width */}
            <div className="w-1/2 flex flex-col">
              {pdfPath ? (
                <PdfViewer
                  pdfPath={pdfPath}
                  currentPage={pdfPage}
                  onPageChange={setPdfPage}
                  version={pdfVersion}
                />
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-900 text-gray-500">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-lg">Select an album with a PDF</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Markers Bar - Spans full width underneath both player and PDF */}
          {currentSong && markerBarState && (
            <MarkersBar
              markers={currentSong.markers}
              visible={markerBarState.showMarkers}
              leadIn={markerBarState.leadIn}
              newMarkerName={markerBarState.newMarkerName}
              editingMarkerId={markerBarState.editingMarkerId}
              editingMarkerName={markerBarState.editingMarkerName}
              currentTime={markerBarState.currentTime}
              onLeadInChange={markerBarState.setLeadIn}
              onNewMarkerNameChange={markerBarState.setNewMarkerName}
              onAddMarker={markerBarState.addMarker}
              onJumpToMarker={markerBarState.jumpToMarker}
              onStartEdit={(id, name) => {
                markerBarState.setEditingMarkerId(id);
                markerBarState.setEditingMarkerName(name);
              }}
              onEditNameChange={markerBarState.setEditingMarkerName}
              onSaveEdit={(markerId, name) => {
                handleMarkerRename(markerId, name);
                markerBarState.setEditingMarkerId(null);
              }}
              onCancelEdit={() => markerBarState.setEditingMarkerId(null)}
              onDelete={handleMarkerDelete}
              onClearAll={() => handleMarkersClear(currentSong.id)}
              formatTime={markerBarState.formatTime}
            />
          )}
        </>
      ) : activeSection === 'videos' ? (
        <Videos />
      ) : activeSection === 'fretboard' ? (
        <Fretboard />
      ) : (
        <Metronome />
      )}
    </div>
  );
}
