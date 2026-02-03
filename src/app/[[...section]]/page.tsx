"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AuthorSidebar from "@/components/AuthorSidebar";
import BookGrid from "@/components/BookGrid";
import InProgressGrid from "@/components/InProgressGrid";
import TrackListView from "@/components/TrackListView";
import JamTracksView from "@/components/JamTracksView";
import BottomPlayer, { MarkerBarState } from "@/components/BottomPlayer";
import MarkersBar from "@/components/MarkersBar";
import TopNav from "@/components/TopNav";
import Fretboard from "@/components/Fretboard";
import PdfViewer from "@/components/PdfViewer";
import Videos from "@/components/Videos";
import AlphaTabViewer from "@/components/AlphaTabViewer";
import SyncPointControls from "@/components/SyncPointControls";
import { Author, Book, Track, Marker, JamTrack, JamTrackMarker, TabSyncPoint } from "@/types";

type Section = 'library' | 'videos' | 'fretboard';

const getSectionFromPath = (section: string[] | undefined): Section => {
  if (!section || section.length === 0) return 'library';
  const first = section[0];
  if (first === 'videos' || first === 'fretboard') {
    return first;
  }
  return 'library';
};

export default function Home() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [authors, setAuthors] = useState<Author[]>([]);
  const [jamTracks, setJamTracks] = useState<JamTrack[]>([]);
  const [selectedAuthor, setSelectedAuthor] = useState<Author | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentJamTrack, setCurrentJamTrack] = useState<JamTrack | null>(null);
  const [currentAuthor, setCurrentAuthor] = useState<Author | null>(null);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingJamTracks, setIsUploadingJamTracks] = useState(false);
  const [isInProgressSelected, setIsInProgressSelected] = useState(false);
  const [isJamTracksSelected, setIsJamTracksSelected] = useState(false);

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

  // AlphaTab sync state
  const [syncEditMode, setSyncEditMode] = useState(false);
  const [pendingTabTick, setPendingTabTick] = useState<number | null>(null);
  const [pendingBarIndex, setPendingBarIndex] = useState<number | null>(null);
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const [audioIsPlaying, setAudioIsPlaying] = useState(false);
  const [tabVersion, setTabVersion] = useState(0);
  const seekFnRef = useRef<((time: number) => void) | null>(null);

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
        const authorsData = data.authors || data; // Handle both old and new response format
        const jamTracksData = data.jamTracks || [];
        setAuthors(authorsData);
        setJamTracks(jamTracksData);

        // Restore state from URL on initial load
        if (restoreFromUrl) {
          const authorId = searchParams.get('artist');
          const bookId = searchParams.get('album');
          if (authorId) {
            const author = authorsData.find((a: Author) => a.id === authorId);
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
          const updatedAuthor = authorsData.find((a: Author) => a.id === selectedAuthor.id);
          if (updatedAuthor) {
            setSelectedAuthor(updatedAuthor);
          }
        }

        // Update selected book if it exists in new data
        if (selectedBook && selectedAuthor) {
          const updatedAuthor = authorsData.find((a: Author) => a.id === selectedAuthor.id);
          if (updatedAuthor) {
            const updatedBook = updatedAuthor.books.find((b: Book) => b.id === selectedBook.id);
            if (updatedBook) {
              setSelectedBook(updatedBook);
            }
          }
        }

        // Update current track markers if track is playing
        if (currentTrack) {
          for (const author of authorsData) {
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

        // Update current jam track if one is playing
        if (currentJamTrack) {
          const updatedJamTrack = jamTracksData.find((jt: JamTrack) => jt.id === currentJamTrack.id);
          if (updatedJamTrack) {
            setCurrentJamTrack(updatedJamTrack);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching library:", error);
    }
  }, [currentTrack, currentJamTrack, selectedAuthor, selectedBook, searchParams]);

  useEffect(() => {
    fetchLibrary(true); // Restore from URL on initial load
  }, []);

  // Keyboard shortcut: 'r' to restart current track from beginning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only in library section
      if (activeSection !== 'library') return;

      // Ignore if typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // 'r' to restart from beginning
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if ((currentTrack || currentJamTrack) && seekFnRef.current) {
          e.preventDefault();
          seekFnRef.current(0);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeSection, currentTrack, currentJamTrack]);

  const handleAuthorSelect = (author: Author) => {
    setIsInProgressSelected(false);
    setIsJamTracksSelected(false);
    setSelectedAuthor(author);
    setSelectedBook(null);
    updateLibraryUrl(author.id, null);
  };

  const handleInProgressSelect = () => {
    setIsInProgressSelected(true);
    setIsJamTracksSelected(false);
    setSelectedAuthor(null);
    setSelectedBook(null);
    updateLibraryUrl(null, null);
  };

  const handleJamTracksSelect = () => {
    setIsJamTracksSelected(true);
    setIsInProgressSelected(false);
    setSelectedAuthor(null);
    setSelectedBook(null);
    updateLibraryUrl(null, null);
  };

  const handleInProgressBookSelect = (book: Book, author: Author) => {
    setSelectedAuthor(author);
    setSelectedBook(book);
    // Clear jam track when selecting a book (so PDF shows instead of tab)
    setCurrentJamTrack(null);
    if (book.pdfPath) {
      setPdfPath(book.pdfPath);
    }
    updateLibraryUrl(author.id, book.id);
  };

  const handleBookSelect = (book: Book) => {
    setSelectedBook(book);
    // Clear jam track when selecting a book (so PDF shows instead of tab)
    setCurrentJamTrack(null);
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

  const handleJamTrackUpload = async (files: FileList) => {
    setIsUploadingJamTracks(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }

      const response = await fetch("/api/jamtracks/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        await fetchLibrary();
      }
    } catch (error) {
      console.error("Error uploading jam tracks:", error);
    } finally {
      setIsUploadingJamTracks(false);
    }
  };

  const handleTrackSelect = (track: Track, author: Author, book: Book) => {
    setCurrentTrack(track);
    setCurrentJamTrack(null); // Clear jam track when selecting regular track
    setCurrentAuthor(author);
    setCurrentBook(book);
    // Update PDF path if book has one
    if (book.pdfPath) {
      setPdfPath(book.pdfPath);
    }
  };

  const handleJamTrackSelect = (jamTrack: JamTrack) => {
    setCurrentJamTrack(jamTrack);
    setCurrentTrack(null); // Clear regular track when selecting jam track
    setCurrentAuthor(null);
    setCurrentBook(null);
    // Update PDF path if jam track has one
    if (jamTrack.pdfPath) {
      setPdfPath(jamTrack.pdfPath);
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

  const handleAssignPdfPage = async (trackId: string, page: number) => {
    const response = await fetch(`/api/tracks/${trackId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfPage: page }),
    });

    if (!response.ok) {
      throw new Error("Failed to assign PDF page");
    }

    // Update local state
    const updateTracks = (tracks: Track[]) =>
      tracks.map((track) =>
        track.id === trackId ? { ...track, pdfPage: page } : track
      );

    if (currentTrack?.id === trackId) {
      setCurrentTrack({ ...currentTrack, pdfPage: page });
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

  // Jam Track handlers
  const handleJamTrackUpdate = async (
    jamTrackId: string,
    title: string,
    tempo: number | null,
    timeSignature: string
  ) => {
    const response = await fetch(`/api/jamtracks/${jamTrackId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, tempo, timeSignature }),
    });

    if (!response.ok) {
      throw new Error("Failed to update jam track");
    }

    const updatedJamTrack = await response.json();

    // Update local state
    setJamTracks((prev) =>
      prev.map((jt) => (jt.id === jamTrackId ? updatedJamTrack : jt))
    );

    if (currentJamTrack?.id === jamTrackId) {
      setCurrentJamTrack(updatedJamTrack);
    }
  };

  const handleJamTrackComplete = async (jamTrackId: string, completed: boolean) => {
    const response = await fetch(`/api/jamtracks/${jamTrackId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });

    if (!response.ok) {
      throw new Error("Failed to update jam track completed status");
    }

    // Update local state
    setJamTracks((prev) =>
      prev.map((jt) => (jt.id === jamTrackId ? { ...jt, completed } : jt))
    );

    if (currentJamTrack?.id === jamTrackId) {
      setCurrentJamTrack((prev) => (prev ? { ...prev, completed } : null));
    }
  };

  const handleJamTrackDelete = async (jamTrackId: string) => {
    const response = await fetch(`/api/jamtracks/${jamTrackId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Failed to delete jam track");
    }

    // Update local state
    setJamTracks((prev) => prev.filter((jt) => jt.id !== jamTrackId));

    if (currentJamTrack?.id === jamTrackId) {
      setCurrentJamTrack(null);
    }
  };

  const handleJamTrackPdfUpload = async (jamTrackId: string, file: File) => {
    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const response = await fetch(`/api/jamtracks/${jamTrackId}/pdf`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const updatedJamTrack = await response.json();
        setJamTracks((prev) =>
          prev.map((jt) => (jt.id === jamTrackId ? updatedJamTrack : jt))
        );
        if (currentJamTrack?.id === jamTrackId) {
          setCurrentJamTrack(updatedJamTrack);
          if (updatedJamTrack.pdfPath) {
            setPdfPath(updatedJamTrack.pdfPath);
          }
        }
      }
    } catch (error) {
      console.error("Error uploading jam track PDF:", error);
    }
  };

  const handleJamTrackPdfDelete = async (jamTrackId: string) => {
    try {
      const response = await fetch(`/api/jamtracks/${jamTrackId}/pdf`, {
        method: "DELETE",
      });

      if (response.ok) {
        setJamTracks((prev) =>
          prev.map((jt) => (jt.id === jamTrackId ? { ...jt, pdfPath: null } : jt))
        );
        if (currentJamTrack?.id === jamTrackId) {
          setCurrentJamTrack((prev) => (prev ? { ...prev, pdfPath: null } : null));
          setPdfPath(null);
        }
      }
    } catch (error) {
      console.error("Error deleting jam track PDF:", error);
    }
  };

  // Jam Track Tab handlers
  const handleJamTrackTabUpload = async (jamTrackId: string, file: File) => {
    const formData = new FormData();
    formData.append("tab", file);

    try {
      const response = await fetch(`/api/jamtracks/${jamTrackId}/tab`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const updatedJamTrack = await response.json();
        setJamTracks((prev) =>
          prev.map((jt) => (jt.id === jamTrackId ? updatedJamTrack : jt))
        );
        if (currentJamTrack?.id === jamTrackId) {
          setCurrentJamTrack(updatedJamTrack);
          setTabVersion((v) => v + 1);
        }
      }
    } catch (error) {
      console.error("Error uploading jam track tab:", error);
    }
  };

  const handleJamTrackTabDelete = async (jamTrackId: string) => {
    try {
      const response = await fetch(`/api/jamtracks/${jamTrackId}/tab`, {
        method: "DELETE",
      });

      if (response.ok) {
        setJamTracks((prev) =>
          prev.map((jt) =>
            jt.id === jamTrackId ? { ...jt, tabPath: null, tabSyncPoints: [] } : jt
          )
        );
        if (currentJamTrack?.id === jamTrackId) {
          setCurrentJamTrack((prev) =>
            prev ? { ...prev, tabPath: null, tabSyncPoints: [] } : null
          );
          setSyncEditMode(false);
          setPendingTabTick(null);
          setPendingBarIndex(null);
        }
      }
    } catch (error) {
      console.error("Error deleting jam track tab:", error);
    }
  };

  // Sync Point handlers
  const handleAddSyncPoint = async () => {
    if (!currentJamTrack || pendingTabTick === null) return;

    try {
      const response = await fetch(
        `/api/jamtracks/${currentJamTrack.id}/syncpoints`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioTime: currentAudioTime,
            tabTick: pendingTabTick,
            barIndex: pendingBarIndex,
          }),
        }
      );

      if (response.ok) {
        const newSyncPoint: TabSyncPoint = await response.json();
        const updatedSyncPoints = [
          ...currentJamTrack.tabSyncPoints,
          newSyncPoint,
        ].sort((a, b) => a.audioTime - b.audioTime);

        setCurrentJamTrack({
          ...currentJamTrack,
          tabSyncPoints: updatedSyncPoints,
        });
        setJamTracks((prev) =>
          prev.map((jt) =>
            jt.id === currentJamTrack.id
              ? { ...jt, tabSyncPoints: updatedSyncPoints }
              : jt
          )
        );
        setPendingTabTick(null);
        setPendingBarIndex(null);
      }
    } catch (error) {
      console.error("Error adding sync point:", error);
    }
  };

  const handleDeleteSyncPoint = async (syncPointId: string) => {
    if (!currentJamTrack) return;

    try {
      const response = await fetch(
        `/api/jamtracks/${currentJamTrack.id}/syncpoints?syncPointId=${syncPointId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        const updatedSyncPoints = currentJamTrack.tabSyncPoints.filter(
          (sp) => sp.id !== syncPointId
        );
        setCurrentJamTrack({
          ...currentJamTrack,
          tabSyncPoints: updatedSyncPoints,
        });
        setJamTracks((prev) =>
          prev.map((jt) =>
            jt.id === currentJamTrack.id
              ? { ...jt, tabSyncPoints: updatedSyncPoints }
              : jt
          )
        );
      }
    } catch (error) {
      console.error("Error deleting sync point:", error);
    }
  };

  const handleClearSyncPoints = async () => {
    if (!currentJamTrack) return;

    try {
      const response = await fetch(
        `/api/jamtracks/${currentJamTrack.id}/syncpoints`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setCurrentJamTrack({
          ...currentJamTrack,
          tabSyncPoints: [],
        });
        setJamTracks((prev) =>
          prev.map((jt) =>
            jt.id === currentJamTrack.id ? { ...jt, tabSyncPoints: [] } : jt
          )
        );
      }
    } catch (error) {
      console.error("Error clearing sync points:", error);
    }
  };

  const handleTabClick = (tabTick: number, barIndex: number) => {
    setPendingTabTick(tabTick);
    setPendingBarIndex(barIndex);
  };

  const handleSeekFromTab = (audioTime: number) => {
    if (seekFnRef.current) {
      seekFnRef.current(audioTime);
    }
  };

  // Jam Track Marker handlers
  const handleJamTrackMarkerAdd = async (
    jamTrackId: string,
    name: string,
    timestamp: number
  ) => {
    try {
      const response = await fetch(`/api/jamtracks/${jamTrackId}/markers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, timestamp }),
      });
      if (response.ok) {
        const newMarker: JamTrackMarker = await response.json();
        // Update the current jam track's markers
        if (currentJamTrack && currentJamTrack.id === jamTrackId) {
          setCurrentJamTrack({
            ...currentJamTrack,
            markers: [...currentJamTrack.markers, newMarker],
          });
        }
        // Also update in the jamTracks list
        setJamTracks((prev) =>
          prev.map((jt) =>
            jt.id === jamTrackId
              ? { ...jt, markers: [...jt.markers, newMarker] }
              : jt
          )
        );
      }
    } catch (error) {
      console.error("Error adding jam track marker:", error);
    }
  };

  const handleJamTrackMarkerUpdate = async (jamTrackId: string, markerId: string, timestamp: number) => {
    try {
      const response = await fetch(`/api/jamtracks/${jamTrackId}/markers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markerId, timestamp }),
      });
      if (response.ok) {
        const updateMarkers = (markers: JamTrackMarker[]) =>
          markers.map((m) => (m.id === markerId ? { ...m, timestamp } : m));

        if (currentJamTrack) {
          setCurrentJamTrack({
            ...currentJamTrack,
            markers: updateMarkers(currentJamTrack.markers),
          });
        }

        setJamTracks((prev) =>
          prev.map((jt) =>
            jt.id === jamTrackId
              ? { ...jt, markers: updateMarkers(jt.markers) }
              : jt
          )
        );
      }
    } catch (error) {
      console.error("Error updating jam track marker:", error);
    }
  };

  const handleJamTrackMarkerRename = async (jamTrackId: string, markerId: string, name: string) => {
    try {
      const response = await fetch(`/api/jamtracks/${jamTrackId}/markers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markerId, name }),
      });
      if (response.ok) {
        const updateMarkers = (markers: JamTrackMarker[]) =>
          markers.map((m) => (m.id === markerId ? { ...m, name } : m));

        if (currentJamTrack) {
          setCurrentJamTrack({
            ...currentJamTrack,
            markers: updateMarkers(currentJamTrack.markers),
          });
        }

        setJamTracks((prev) =>
          prev.map((jt) =>
            jt.id === jamTrackId
              ? { ...jt, markers: updateMarkers(jt.markers) }
              : jt
          )
        );
      }
    } catch (error) {
      console.error("Error renaming jam track marker:", error);
    }
  };

  const handleJamTrackMarkerDelete = async (jamTrackId: string, markerId: string) => {
    try {
      const response = await fetch(`/api/jamtracks/${jamTrackId}/markers?markerId=${markerId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        const updateMarkers = (markers: JamTrackMarker[]) =>
          markers.filter((m) => m.id !== markerId);

        if (currentJamTrack) {
          setCurrentJamTrack({
            ...currentJamTrack,
            markers: updateMarkers(currentJamTrack.markers),
          });
        }

        setJamTracks((prev) =>
          prev.map((jt) =>
            jt.id === jamTrackId
              ? { ...jt, markers: updateMarkers(jt.markers) }
              : jt
          )
        );
      }
    } catch (error) {
      console.error("Error deleting jam track marker:", error);
    }
  };

  const handleJamTrackMarkersClear = async (jamTrackId: string) => {
    try {
      const response = await fetch(`/api/jamtracks/${jamTrackId}/markers`, {
        method: "DELETE",
      });
      if (response.ok) {
        if (currentJamTrack && currentJamTrack.id === jamTrackId) {
          setCurrentJamTrack({
            ...currentJamTrack,
            markers: [],
          });
        }

        setJamTracks((prev) =>
          prev.map((jt) =>
            jt.id === jamTrackId ? { ...jt, markers: [] } : jt
          )
        );
      }
    } catch (error) {
      console.error("Error clearing jam track markers:", error);
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
                    jamTracksCount={jamTracks.length}
                    isJamTracksSelected={isJamTracksSelected}
                    onJamTracksSelect={handleJamTracksSelect}
                  />
                </div>

                {/* Content: BookGrid OR TrackListView OR InProgressGrid OR JamTracksView */}
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
                      currentPdfPage={pdfPage}
                      onAssignPdfPage={handleAssignPdfPage}
                    />
                  ) : isJamTracksSelected ? (
                    <JamTracksView
                      jamTracks={jamTracks}
                      currentJamTrack={currentJamTrack}
                      onJamTrackSelect={handleJamTrackSelect}
                      onJamTrackUpdate={handleJamTrackUpdate}
                      onJamTrackComplete={handleJamTrackComplete}
                      onJamTrackDelete={handleJamTrackDelete}
                      onShowPdf={handleShowPdf}
                      onPdfUpload={handleJamTrackPdfUpload}
                      onPdfDelete={handleJamTrackPdfDelete}
                      onTabUpload={handleJamTrackTabUpload}
                      onTabDelete={handleJamTrackTabDelete}
                      onUpload={handleJamTrackUpload}
                      isUploading={isUploadingJamTracks}
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
                  track={currentTrack || currentJamTrack}
                  onMarkerAdd={(trackId, name, timestamp) => {
                    if (currentJamTrack) {
                      handleJamTrackMarkerAdd(trackId, name, timestamp);
                    } else {
                      handleMarkerAdd(trackId, name, timestamp);
                    }
                  }}
                  onMarkerUpdate={(markerId, timestamp) => {
                    if (currentJamTrack) {
                      handleJamTrackMarkerUpdate(currentJamTrack.id, markerId, timestamp);
                    } else {
                      handleMarkerUpdate(markerId, timestamp);
                    }
                  }}
                  onMarkerRename={(markerId, name) => {
                    if (currentJamTrack) {
                      handleJamTrackMarkerRename(currentJamTrack.id, markerId, name);
                    } else {
                      handleMarkerRename(markerId, name);
                    }
                  }}
                  onMarkerDelete={(markerId) => {
                    if (currentJamTrack) {
                      handleJamTrackMarkerDelete(currentJamTrack.id, markerId);
                    } else {
                      handleMarkerDelete(markerId);
                    }
                  }}
                  onMarkersClear={(trackId) => {
                    if (currentJamTrack) {
                      handleJamTrackMarkersClear(trackId);
                    } else {
                      handleMarkersClear(trackId);
                    }
                  }}
                  externalMarkersBar={true}
                  onMarkerBarStateChange={setMarkerBarState}
                  onTimeUpdate={(time, playing) => {
                    setCurrentAudioTime(time);
                    setAudioIsPlaying(playing);
                  }}
                  onSeekReady={(seekFn) => {
                    seekFnRef.current = seekFn;
                  }}
                />
              </div>
            </div>

            {/* Tab/PDF Panel - Always visible, 50% width */}
            <div className="w-1/2 flex flex-col">
              {currentJamTrack?.tabPath ? (
                <>
                  <SyncPointControls
                    syncPoints={currentJamTrack.tabSyncPoints}
                    syncEditMode={syncEditMode}
                    onToggleSyncEditMode={() => setSyncEditMode(!syncEditMode)}
                    currentAudioTime={currentAudioTime}
                    pendingTabTick={pendingTabTick}
                    pendingBarIndex={pendingBarIndex}
                    onAddSyncPoint={handleAddSyncPoint}
                    onDeleteSyncPoint={handleDeleteSyncPoint}
                    onClearSyncPoints={handleClearSyncPoints}
                  />
                  <div className="flex-1 overflow-hidden">
                    <AlphaTabViewer
                      tabPath={currentJamTrack.tabPath}
                      syncPoints={currentJamTrack.tabSyncPoints}
                      currentAudioTime={currentAudioTime}
                      isPlaying={audioIsPlaying}
                      onSeek={handleSeekFromTab}
                      onTabClick={handleTabClick}
                      syncEditMode={syncEditMode}
                      version={tabVersion}
                    />
                  </div>
                </>
              ) : pdfPath ? (
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
                    <p className="text-lg">Select a book with a PDF or jam track with a tab</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Markers Bar - Spans full width underneath both player and PDF */}
          {(currentTrack || currentJamTrack) && markerBarState && (
            <MarkersBar
              markers={(currentTrack || currentJamTrack)!.markers}
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
                if (currentJamTrack) {
                  handleJamTrackMarkerRename(currentJamTrack.id, markerId, name);
                } else {
                  handleMarkerRename(markerId, name);
                }
                markerBarState.setEditingMarkerId(null);
              }}
              onCancelEdit={() => markerBarState.setEditingMarkerId(null)}
              onDelete={(markerId) => {
                if (currentJamTrack) {
                  handleJamTrackMarkerDelete(currentJamTrack.id, markerId);
                } else {
                  handleMarkerDelete(markerId);
                }
              }}
              onClearAll={() => {
                const activeTrack = currentTrack || currentJamTrack;
                if (activeTrack) {
                  if (currentJamTrack) {
                    handleJamTrackMarkersClear(activeTrack.id);
                  } else {
                    handleMarkersClear(activeTrack.id);
                  }
                }
              }}
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
      ) : (
        <Fretboard />
      )}
    </div>
  );
}
