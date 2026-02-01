"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AuthorSidebar from "@/components/AuthorSidebar";
import BookGrid from "@/components/BookGrid";
import InProgressGrid from "@/components/InProgressGrid";
import TrackListView from "@/components/TrackListView";
import BottomPlayer, { MarkerBarState } from "@/components/BottomPlayer";
import MarkersBar from "@/components/MarkersBar";
import TopNav from "@/components/TopNav";
import Metronome from "@/components/Metronome";
import Fretboard from "@/components/Fretboard";
import PdfViewer from "@/components/PdfViewer";
import Videos from "@/components/Videos";
import { Author, Book, Track, Marker } from "@/types";

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

  const [authors, setAuthors] = useState<Author[]>([]);
  const [selectedAuthor, setSelectedAuthor] = useState<Author | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentAuthor, setCurrentAuthor] = useState<Author | null>(null);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isInProgressSelected, setIsInProgressSelected] = useState(false);

  // Compute in-progress books from all authors
  const inProgressBooks = authors.flatMap((author) =>
    author.books.filter((book) => book.inProgress).map((book) => ({ book, author }))
  );
  const inProgressCount = inProgressBooks.length;

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
      setCurrentTrack(null);
      setCurrentAuthor(null);
      setCurrentBook(null);
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
        setAuthors(data);

        // Restore state from URL on initial load
        if (restoreFromUrl) {
          const authorId = searchParams.get('artist');
          const bookId = searchParams.get('album');
          if (authorId) {
            const author = data.find((a: Author) => a.id === authorId);
            if (author) {
              setSelectedAuthor(author);
              if (bookId) {
                const book = author.books.find((b: Book) => b.id === bookId);
                if (book) {
                  setSelectedBook(book);
                  if (book.pdfPath) {
                    setPdfPath(book.pdfPath);
                  }
                }
              }
            }
          }
          return;
        }

        // Update selected author if it exists in new data
        if (selectedAuthor) {
          const updatedAuthor = data.find((a: Author) => a.id === selectedAuthor.id);
          if (updatedAuthor) {
            setSelectedAuthor(updatedAuthor);
          }
        }

        // Update selected book if it exists in new data
        if (selectedBook && selectedAuthor) {
          const updatedAuthor = data.find((a: Author) => a.id === selectedAuthor.id);
          if (updatedAuthor) {
            const updatedBook = updatedAuthor.books.find((b: Book) => b.id === selectedBook.id);
            if (updatedBook) {
              setSelectedBook(updatedBook);
            }
          }
        }

        // Update current track markers if track is playing
        if (currentTrack) {
          for (const author of data) {
            for (const book of author.books) {
              const track = book.tracks.find(
                (t: Track) => t.id === currentTrack.id
              );
              if (track) {
                setCurrentTrack(track);
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching library:", error);
    }
  }, [currentTrack, selectedAuthor, selectedBook, searchParams]);

  useEffect(() => {
    fetchLibrary(true); // Restore from URL on initial load
  }, []);

  const handleAuthorSelect = (author: Author) => {
    setIsInProgressSelected(false);
    setSelectedAuthor(author);
    setSelectedBook(null);
    updateLibraryUrl(author.id, null);
  };

  const handleInProgressSelect = () => {
    setIsInProgressSelected(true);
    setSelectedAuthor(null);
    setSelectedBook(null);
    updateLibraryUrl(null, null);
  };

  const handleInProgressBookSelect = (book: Book, author: Author) => {
    setSelectedAuthor(author);
    setSelectedBook(book);
    if (book.pdfPath) {
      setPdfPath(book.pdfPath);
    }
    updateLibraryUrl(author.id, book.id);
  };

  const handleBookSelect = (book: Book) => {
    setSelectedBook(book);
    // Auto-show PDF if book has one
    if (book.pdfPath) {
      setPdfPath(book.pdfPath);
    }
    updateLibraryUrl(selectedAuthor?.id || null, book.id);
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

  const handleTrackSelect = (track: Track, author: Author, book: Book) => {
    setCurrentTrack(track);
    setCurrentAuthor(author);
    setCurrentBook(book);
    // Update PDF path if book has one
    if (book.pdfPath) {
      setPdfPath(book.pdfPath);
    }
  };

  const handleMarkerAdd = async (
    trackId: string,
    name: string,
    timestamp: number
  ) => {
    try {
      const response = await fetch("/api/markers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, name, timestamp }),
      });
      if (response.ok) {
        const newMarker: Marker = await response.json();
        // Update the current track's markers
        if (currentTrack && currentTrack.id === trackId) {
          setCurrentTrack({
            ...currentTrack,
            markers: [...currentTrack.markers, newMarker],
          });
        }
        // Also update in the authors list
        setAuthors((prevAuthors) =>
          prevAuthors.map((author) => ({
            ...author,
            books: author.books.map((book) => ({
              ...book,
              tracks: book.tracks.map((track) =>
                track.id === trackId
                  ? { ...track, markers: [...track.markers, newMarker] }
                  : track
              ),
            })),
          }))
        );
        // Update selected author too
        if (selectedAuthor) {
          setSelectedAuthor((prev) =>
            prev
              ? {
                  ...prev,
                  books: prev.books.map((book) => ({
                    ...book,
                    tracks: book.tracks.map((track) =>
                      track.id === trackId
                        ? { ...track, markers: [...track.markers, newMarker] }
                        : track
                    ),
                  })),
                }
              : null
          );
        }
        // Update selected book too
        if (selectedBook) {
          setSelectedBook((prev) =>
            prev
              ? {
                  ...prev,
                  tracks: prev.tracks.map((track) =>
                    track.id === trackId
                      ? { ...track, markers: [...track.markers, newMarker] }
                      : track
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
        const updateMarkers = (tracks: Track[]) =>
          tracks.map((track) => ({
            ...track,
            markers: track.markers.map((m) =>
              m.id === markerId ? { ...m, timestamp } : m
            ),
          }));

        if (currentTrack) {
          setCurrentTrack({
            ...currentTrack,
            markers: currentTrack.markers.map((m) =>
              m.id === markerId ? { ...m, timestamp } : m
            ),
          });
        }

        setAuthors((prevAuthors) =>
          prevAuthors.map((author) => ({
            ...author,
            books: author.books.map((book) => ({
              ...book,
              tracks: updateMarkers(book.tracks),
            })),
          }))
        );

        if (selectedAuthor) {
          setSelectedAuthor((prev) =>
            prev
              ? {
                  ...prev,
                  books: prev.books.map((book) => ({
                    ...book,
                    tracks: updateMarkers(book.tracks),
                  })),
                }
              : null
          );
        }

        if (selectedBook) {
          setSelectedBook((prev) =>
            prev
              ? {
                  ...prev,
                  tracks: updateMarkers(prev.tracks),
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
        const updateMarkers = (tracks: Track[]) =>
          tracks.map((track) => ({
            ...track,
            markers: track.markers.map((m) =>
              m.id === markerId ? { ...m, name } : m
            ),
          }));

        if (currentTrack) {
          setCurrentTrack({
            ...currentTrack,
            markers: currentTrack.markers.map((m) =>
              m.id === markerId ? { ...m, name } : m
            ),
          });
        }

        setAuthors((prevAuthors) =>
          prevAuthors.map((author) => ({
            ...author,
            books: author.books.map((book) => ({
              ...book,
              tracks: updateMarkers(book.tracks),
            })),
          }))
        );

        if (selectedAuthor) {
          setSelectedAuthor((prev) =>
            prev
              ? {
                  ...prev,
                  books: prev.books.map((book) => ({
                    ...book,
                    tracks: updateMarkers(book.tracks),
                  })),
                }
              : null
          );
        }

        if (selectedBook) {
          setSelectedBook((prev) =>
            prev
              ? {
                  ...prev,
                  tracks: updateMarkers(prev.tracks),
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
        const updateMarkers = (tracks: Track[]) =>
          tracks.map((track) => ({
            ...track,
            markers: track.markers.filter((m) => m.id !== markerId),
          }));

        if (currentTrack) {
          setCurrentTrack({
            ...currentTrack,
            markers: currentTrack.markers.filter((m) => m.id !== markerId),
          });
        }

        setAuthors((prevAuthors) =>
          prevAuthors.map((author) => ({
            ...author,
            books: author.books.map((book) => ({
              ...book,
              tracks: updateMarkers(book.tracks),
            })),
          }))
        );

        if (selectedAuthor) {
          setSelectedAuthor((prev) =>
            prev
              ? {
                  ...prev,
                  books: prev.books.map((book) => ({
                    ...book,
                    tracks: updateMarkers(book.tracks),
                  })),
                }
              : null
          );
        }

        if (selectedBook) {
          setSelectedBook((prev) =>
            prev
              ? {
                  ...prev,
                  tracks: updateMarkers(prev.tracks),
                }
              : null
          );
        }
      }
    } catch (error) {
      console.error("Error deleting marker:", error);
    }
  };

  const handleMarkersClear = async (trackId: string) => {
    try {
      const response = await fetch(`/api/markers/clear/${trackId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        const updateMarkers = (tracks: Track[]) =>
          tracks.map((track) =>
            track.id === trackId ? { ...track, markers: [] } : track
          );

        if (currentTrack && currentTrack.id === trackId) {
          setCurrentTrack({
            ...currentTrack,
            markers: [],
          });
        }

        setAuthors((prevAuthors) =>
          prevAuthors.map((author) => ({
            ...author,
            books: author.books.map((book) => ({
              ...book,
              tracks: updateMarkers(book.tracks),
            })),
          }))
        );

        if (selectedAuthor) {
          setSelectedAuthor((prev) =>
            prev
              ? {
                  ...prev,
                  books: prev.books.map((book) => ({
                    ...book,
                    tracks: updateMarkers(book.tracks),
                  })),
                }
              : null
          );
        }

        if (selectedBook) {
          setSelectedBook((prev) =>
            prev
              ? {
                  ...prev,
                  tracks: updateMarkers(prev.tracks),
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
    trackId: string,
    title: string,
    authorName: string,
    bookName: string,
    trackNumber: number,
    pdfPage?: number | null,
    tempo?: number | null,
    timeSignature?: string
  ) => {
    const response = await fetch(`/api/tracks/${trackId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, author: authorName, book: bookName, trackNumber, pdfPage, tempo, timeSignature }),
    });

    if (!response.ok) {
      throw new Error("Failed to update metadata");
    }

    const { track, author, book } = await response.json();

    setCurrentTrack(track);
    setCurrentAuthor(author);
    setCurrentBook(book);

    await fetchLibrary();
  };

  const handleTempoChange = async (tempo: number | null, timeSignature: string) => {
    if (!currentTrack) return;

    try {
      const response = await fetch(`/api/tracks/${currentTrack.id}/tempo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempo, timeSignature }),
      });

      if (!response.ok) {
        throw new Error("Failed to update tempo");
      }

      const updatedTrack = await response.json();

      // Update current track
      setCurrentTrack(updatedTrack);

      // Update in authors list
      const updateTracks = (tracks: Track[]) =>
        tracks.map((track) =>
          track.id === currentTrack.id ? { ...track, tempo, timeSignature } : track
        );

      setAuthors((prevAuthors) =>
        prevAuthors.map((author) => ({
          ...author,
          books: author.books.map((book) => ({
            ...book,
            tracks: updateTracks(book.tracks),
          })),
        }))
      );

      if (selectedAuthor) {
        setSelectedAuthor((prev) =>
          prev
            ? {
                ...prev,
                books: prev.books.map((book) => ({
                  ...book,
                  tracks: updateTracks(book.tracks),
                })),
              }
            : null
        );
      }

      if (selectedBook) {
        setSelectedBook((prev) =>
          prev
            ? {
                ...prev,
                tracks: updateTracks(prev.tracks),
              }
            : null
        );
      }
    } catch (error) {
      console.error("Error updating tempo:", error);
    }
  };

  const handleBookUpdate = async (
    bookId: string,
    bookName: string,
    authorName: string
  ) => {
    const response = await fetch(`/api/books/${bookId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookName, authorName }),
    });

    if (!response.ok) {
      throw new Error("Failed to update book metadata");
    }

    await fetchLibrary();
  };

  const handleBookInProgress = async (bookId: string, inProgress: boolean) => {
    const response = await fetch(`/api/books/${bookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inProgress }),
    });

    if (!response.ok) {
      throw new Error("Failed to update book in-progress status");
    }

    // Update local state
    const updateBooks = (books: Book[]) =>
      books.map((book) =>
        book.id === bookId ? { ...book, inProgress } : book
      );

    setAuthors((prevAuthors) =>
      prevAuthors.map((author) => ({
        ...author,
        books: updateBooks(author.books),
      }))
    );

    if (selectedAuthor) {
      setSelectedAuthor((prev) =>
        prev
          ? {
              ...prev,
              books: updateBooks(prev.books),
            }
          : null
      );
    }

    if (selectedBook?.id === bookId) {
      setSelectedBook((prev) => (prev ? { ...prev, inProgress } : null));
    }
  };

  const handleTrackComplete = async (trackId: string, completed: boolean) => {
    const response = await fetch(`/api/tracks/${trackId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });

    if (!response.ok) {
      throw new Error("Failed to update track completed status");
    }

    // Update local state
    const updateTracks = (tracks: Track[]) =>
      tracks.map((track) =>
        track.id === trackId ? { ...track, completed } : track
      );

    if (currentTrack?.id === trackId) {
      setCurrentTrack({ ...currentTrack, completed });
    }

    setAuthors((prevAuthors) =>
      prevAuthors.map((author) => ({
        ...author,
        books: author.books.map((book) => ({
          ...book,
          tracks: updateTracks(book.tracks),
        })),
      }))
    );

    if (selectedAuthor) {
      setSelectedAuthor((prev) =>
        prev
          ? {
              ...prev,
              books: prev.books.map((book) => ({
                ...book,
                tracks: updateTracks(book.tracks),
              })),
            }
          : null
      );
    }

    if (selectedBook) {
      setSelectedBook((prev) =>
        prev
          ? {
              ...prev,
              tracks: updateTracks(prev.tracks),
            }
          : null
      );
    }
  };

  // PDF handlers
  const handlePdfUpload = async (bookId: string, file: File) => {
    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const response = await fetch(`/api/books/${bookId}/pdf`, {
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

  const handlePdfDelete = async (bookId: string) => {
    try {
      const response = await fetch(`/api/books/${bookId}/pdf`, {
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

  const handlePdfConvert = async (bookId: string) => {
    try {
      const response = await fetch(`/api/books/${bookId}/pdf`, {
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

  const handleShowPdf = (bookPdfPath: string, page?: number) => {
    setPdfPath(bookPdfPath);
    if (page) {
      setPdfPage(page);
    }
  };

  // Auto-navigate to track's PDF page when track changes
  useEffect(() => {
    if (currentTrack?.pdfPage) {
      setPdfPage(currentTrack.pdfPage);
    }
  }, [currentTrack?.id, currentTrack?.pdfPage]);


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
                {/* Author Sidebar */}
                <div className="w-56 border-r border-gray-700 shrink-0">
                  <AuthorSidebar
                    authors={authors}
                    selectedAuthor={selectedAuthor}
                    onAuthorSelect={handleAuthorSelect}
                    onScan={handleScan}
                    onUpload={handleUpload}
                    isScanning={isScanning}
                    isUploading={isUploading}
                    inProgressCount={inProgressCount}
                    isInProgressSelected={isInProgressSelected}
                    onInProgressSelect={handleInProgressSelect}
                  />
                </div>

                {/* Content: BookGrid OR TrackListView OR InProgressGrid */}
                <div className="flex-1 min-w-0">
                  {selectedBook && selectedAuthor ? (
                    <TrackListView
                      author={selectedAuthor}
                      book={selectedBook}
                      currentTrack={currentTrack}
                      onTrackSelect={handleTrackSelect}
                      onBack={() => {
                        setSelectedBook(null);
                        if (isInProgressSelected) {
                          updateLibraryUrl(null, null);
                        } else {
                          updateLibraryUrl(selectedAuthor?.id || null, null);
                        }
                      }}
                      onBookUpdate={handleBookUpdate}
                      onTrackUpdate={handleMetadataUpdate}
                      onTrackComplete={handleTrackComplete}
                      onBookInProgress={handleBookInProgress}
                      onShowPdf={handleShowPdf}
                      onPdfUpload={handlePdfUpload}
                      onPdfDelete={handlePdfDelete}
                      onPdfConvert={handlePdfConvert}
                    />
                  ) : isInProgressSelected ? (
                    <InProgressGrid
                      books={inProgressBooks}
                      onBookSelect={handleInProgressBookSelect}
                    />
                  ) : selectedAuthor ? (
                    <BookGrid
                      author={selectedAuthor}
                      onBookSelect={handleBookSelect}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center bg-gray-900 text-gray-500">
                      <div className="text-center">
                        <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                        <p className="text-lg">Select an author to view books</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Player - Fixed height for waveform visibility */}
              <div className="h-[30vh] min-h-55 max-h-80 shrink-0">
                <BottomPlayer
                  track={currentTrack}
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
                    <p className="text-lg">Select a book with a PDF</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Markers Bar - Spans full width underneath both player and PDF */}
          {currentTrack && markerBarState && (
            <MarkersBar
              markers={currentTrack.markers}
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
              onClearAll={() => handleMarkersClear(currentTrack.id)}
              formatTime={markerBarState.formatTime}
              isCountingIn={markerBarState.isCountingIn}
              currentCountInBeat={markerBarState.currentCountInBeat}
              totalCountInBeats={markerBarState.totalCountInBeats}
              trackTempo={markerBarState.trackTempo}
              trackTimeSignature={markerBarState.trackTimeSignature}
              onTempoChange={handleTempoChange}
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
