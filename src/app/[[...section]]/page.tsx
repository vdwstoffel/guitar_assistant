"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import CircleOfFifths from "@/components/CircleOfFifths";
import PdfViewer from "@/components/PdfViewer";
import Videos from "@/components/Videos";
import Tools from "@/components/Tools";
import PageSyncEditor from "@/components/PageSyncEditor";
import VideoUploadModal from "@/components/VideoUploadModal";
import VideoPlayer from "@/components/VideoPlayer";
import { AuthorSummary, BookSummary, Book, Track, Marker, JamTrack, JamTrackMarker, BookVideo } from "@/types";

type Section = 'library' | 'videos' | 'fretboard' | 'tools' | 'circle';

const getSectionFromPath = (section: string[] | undefined): Section => {
  if (!section || section.length === 0) return 'library';
  const first = section[0];
  if (first === 'videos' || first === 'fretboard' || first === 'tools' || first === 'circle') {
    return first;
  }
  return 'library';
};

export default function Home() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Lightweight library data (authors with book summaries, no tracks/markers)
  const [authors, setAuthors] = useState<AuthorSummary[]>([]);
  const [jamTracks, setJamTracks] = useState<JamTrack[]>([]);

  // Navigation state
  const [selectedAuthorId, setSelectedAuthorId] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedBookDetail, setSelectedBookDetail] = useState<Book | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentAuthorId, setCurrentAuthorId] = useState<string | null>(null);
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  const [currentJamTrackId, setCurrentJamTrackId] = useState<string | null>(null);

  // Ref so fetchLibrary callback can access current selectedBookId
  const selectedBookIdRef = useRef<string | null>(null);
  selectedBookIdRef.current = selectedBookId;

  // Derive lightweight objects from IDs
  const selectedAuthor = useMemo(() =>
    authors.find(a => a.id === selectedAuthorId) || null,
    [authors, selectedAuthorId]
  );

  const currentJamTrack = useMemo(() =>
    jamTracks.find(jt => jt.id === currentJamTrackId) || null,
    [jamTracks, currentJamTrackId]
  );
  const [isScanning, setIsScanning] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingJamTracks, setIsUploadingJamTracks] = useState(false);
  const [isImportingFromYouTube, setIsImportingFromYouTube] = useState(false);
  const [isInProgressSelected, setIsInProgressSelected] = useState(false);
  const [isJamTracksSelected, setIsJamTracksSelected] = useState(false);
  const [isVideoUploadModalOpen, setIsVideoUploadModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<BookVideo | null>(null);
  const [showVideo, setShowVideo] = useState(false);

  // Helper: update a track inside selectedBookDetail (both uncategorized and chapter tracks)
  // Short-circuits to avoid cloning chapters/tracks that don't contain the target track
  const updateTrackInBookDetail = useCallback((trackId: string, updater: (track: Track) => Track) => {
    setSelectedBookDetail(prev => {
      if (!prev) return prev;

      // Only map uncategorized tracks if the target is among them
      const hasUncategorized = prev.tracks.some(t => t.id === trackId);
      const newTracks = hasUncategorized
        ? prev.tracks.map(t => t.id === trackId ? updater(t) : t)
        : prev.tracks;

      // Only clone chapters that contain the target track
      let chaptersChanged = false;
      const newChapters = prev.chapters?.map(ch => {
        if (!ch.tracks.some(t => t.id === trackId)) return ch;
        chaptersChanged = true;
        return {
          ...ch,
          tracks: ch.tracks.map(t => t.id === trackId ? updater(t) : t),
        };
      });

      if (!hasUncategorized && !chaptersChanged) return prev;

      return {
        ...prev,
        tracks: newTracks,
        chapters: newChapters,
      };
    });
  }, []);

  // Compute in-progress books from all authors (memoized to prevent recalculation on every render)
  const inProgressBooks = useMemo(() =>
    authors.flatMap((author) =>
      author.books.filter((book) => book.inProgress).map((book) => ({ book, author }))
    ),
    [authors]
  );
  const inProgressCount = inProgressBooks.length;

  // PDF state
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfVersion, setPdfVersion] = useState(0);

  // Marker bar state from BottomPlayer
  const [markerBarState, setMarkerBarState] = useState<MarkerBarState | null>(null);

  // Audio time state (used for page sync)
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const [audioIsPlaying, setAudioIsPlaying] = useState(false);
  const seekFnRef = useRef<((time: number) => void) | null>(null);

  // Page sync state for jam track PDFs
  const [pageSyncEditMode, setPageSyncEditMode] = useState(false);
  const [activePdfId, setActivePdfId] = useState<string | null>(null);
  const [activePdfPage, setActivePdfPage] = useState(1);

  // Refs for stable BottomPlayer callbacks (avoids new function references every render)
  const currentJamTrackRef = useRef(currentJamTrack);
  currentJamTrackRef.current = currentJamTrack;

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
      setCurrentAuthorId(null);
      setCurrentBookId(null);
    }
    if (section === 'library') {
      router.push('/');
    } else {
      router.push(`/${section}`);
    }
  };

  const fetchBookDetail = useCallback(async (bookId: string) => {
    try {
      const response = await fetch(`/api/books/${bookId}/detail`);
      if (response.ok) {
        const bookData: Book = await response.json();
        setSelectedBookDetail(bookData);

        // Update currentTrack if it belongs to this book
        setCurrentTrack(prev => {
          if (!prev) return prev;
          const found = bookData.tracks.find(t => t.id === prev.id)
            || bookData.chapters?.flatMap(ch => ch.tracks).find(t => t.id === prev.id);
          return found || prev;
        });
      }
    } catch (error) {
      console.error("Error fetching book detail:", error);
    }
  }, []);

  const fetchLibrary = useCallback(async (restoreFromUrl = false) => {
    try {
      const response = await fetch("/api/library");
      if (response.ok) {
        const data = await response.json();
        const authorsData: AuthorSummary[] = data.authors || [];
        const jamTracksData = data.jamTracks || [];
        setAuthors(authorsData);
        setJamTracks(jamTracksData);

        // Restore state from URL on initial load
        if (restoreFromUrl) {
          const authorId = searchParams.get('artist');
          const bookId = searchParams.get('album');
          if (authorId) {
            const author = authorsData.find((a: AuthorSummary) => a.id === authorId);
            if (author) {
              setSelectedAuthorId(authorId);
              if (bookId) {
                const book = author.books.find((b: BookSummary) => b.id === bookId);
                if (book) {
                  setSelectedBookId(bookId);
                  if (book.pdfPath) {
                    setPdfPath(book.pdfPath);
                  }
                  await fetchBookDetail(bookId);
                }
              }
            }
          }
          return;
        }

        // Refresh current book detail if one is selected
        const bookId = selectedBookIdRef.current;
        if (bookId) {
          await fetchBookDetail(bookId);
        }
      }
    } catch (error) {
      console.error("Error fetching library:", error);
    }
  }, [searchParams, fetchBookDetail]);

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

      // Left arrow to restart from beginning
      if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if ((currentTrack || currentJamTrack) && seekFnRef.current) {
          e.preventDefault();
          seekFnRef.current(0);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeSection, currentTrack, currentJamTrack]);

  const handleAuthorSelect = (author: AuthorSummary) => {
    setIsInProgressSelected(false);
    setIsJamTracksSelected(false);
    setSelectedAuthorId(author.id);
    setSelectedBookId(null);
    setSelectedBookDetail(null);
    setCurrentTrack(null);
    setCurrentAuthorId(null);
    setCurrentBookId(null);
    setCurrentJamTrackId(null);
    updateLibraryUrl(author.id, null);
  };

  const handleInProgressSelect = () => {
    setIsInProgressSelected(true);
    setIsJamTracksSelected(false);
    setSelectedAuthorId(null);
    setSelectedBookId(null);
    setSelectedBookDetail(null);
    setCurrentTrack(null);
    setCurrentAuthorId(null);
    setCurrentBookId(null);
    setCurrentJamTrackId(null);
    updateLibraryUrl(null, null);
  };

  const handleJamTracksSelect = () => {
    setIsJamTracksSelected(true);
    setIsInProgressSelected(false);
    setSelectedAuthorId(null);
    setSelectedBookId(null);
    setSelectedBookDetail(null);
    setCurrentTrack(null);
    setCurrentAuthorId(null);
    setCurrentBookId(null);
    updateLibraryUrl(null, null);
  };

  const handleInProgressBookSelect = (book: BookSummary, author: AuthorSummary) => {
    setSelectedAuthorId(author.id);
    setSelectedBookId(book.id);
    setSelectedBookDetail(null);
    setCurrentJamTrackId(null);
    if (book.pdfPath) {
      setPdfPath(book.pdfPath);
    }
    updateLibraryUrl(author.id, book.id);
    fetchBookDetail(book.id);
  };

  const handleBookSelect = (book: BookSummary) => {
    setSelectedBookId(book.id);
    setSelectedBookDetail(null);
    setCurrentTrack(null);
    setCurrentAuthorId(null);
    setCurrentBookId(null);
    setCurrentJamTrackId(null);
    if (book.pdfPath) {
      setPdfPath(book.pdfPath);
    }
    updateLibraryUrl(selectedAuthorId || null, book.id);
    fetchBookDetail(book.id);
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

  const handleYouTubeImport = async (url: string, title?: string) => {
    setIsImportingFromYouTube(true);
    try {
      const response = await fetch("/api/jamtracks/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, title }),
      });

      if (!response.ok) {
        const data = await response.json();
        const error = new Error(data.error || "Failed to import from YouTube");
        (error as Error & { needsTitle?: boolean }).needsTitle = data.needsTitle === true;
        throw error;
      }

      await fetchLibrary();
    } catch (error) {
      console.error("Error importing from YouTube:", error);
      throw error;
    } finally {
      setIsImportingFromYouTube(false);
    }
  };

  const handleTrackSelect = (track: Track) => {
    setCurrentTrack(track);
    setCurrentAuthorId(selectedAuthorId);
    setCurrentBookId(selectedBookId);
    setCurrentJamTrackId(null);
    setSelectedVideo(null);
    if (selectedBookDetail?.pdfPath) {
      setPdfPath(selectedBookDetail.pdfPath);
    }
  };

  const handleVideoSelect = (video: BookVideo) => {
    setSelectedVideo(video);
    setShowVideo(false);
    setCurrentTrack(null);
    setCurrentAuthorId(null);
    setCurrentBookId(null);
    setCurrentJamTrackId(null);
    if (video.pdfPage && selectedBookDetail?.pdfPath) {
      setPdfPage(video.pdfPage);
    }
  };

  const handleJamTrackSelect = (jamTrack: JamTrack) => {
    setCurrentJamTrackId(jamTrack.id);
    setCurrentTrack(null);
    setCurrentAuthorId(null);
    setCurrentBookId(null);
    setPageSyncEditMode(false);
    setActivePdfId(null);
    setActivePdfPage(1);
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
        setCurrentTrack(prev =>
          prev?.id === trackId ? { ...prev, markers: [...prev.markers, newMarker] } : prev
        );
        updateTrackInBookDetail(trackId, t => ({ ...t, markers: [...t.markers, newMarker] }));
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
        const updateMarkers = (markers: Marker[]) =>
          markers.map(m => m.id === markerId ? { ...m, timestamp } : m);
        setCurrentTrack(prev =>
          prev ? { ...prev, markers: updateMarkers(prev.markers) } : prev
        );
        updateTrackInBookDetail(currentTrack?.id || '', t => ({ ...t, markers: updateMarkers(t.markers) }));
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
        const updateMarkers = (markers: Marker[]) =>
          markers.map(m => m.id === markerId ? { ...m, name } : m);
        setCurrentTrack(prev =>
          prev ? { ...prev, markers: updateMarkers(prev.markers) } : prev
        );
        updateTrackInBookDetail(currentTrack?.id || '', t => ({ ...t, markers: updateMarkers(t.markers) }));
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
        const removeMarker = (markers: Marker[]) => markers.filter(m => m.id !== markerId);
        setCurrentTrack(prev =>
          prev ? { ...prev, markers: removeMarker(prev.markers) } : prev
        );
        updateTrackInBookDetail(currentTrack?.id || '', t => ({ ...t, markers: removeMarker(t.markers) }));
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
        setCurrentTrack(prev =>
          prev?.id === trackId ? { ...prev, markers: [] } : prev
        );
        updateTrackInBookDetail(trackId, t => ({ ...t, markers: [] }));
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
    timeSignature?: string,
    chapterId?: string | null
  ) => {
    const response = await fetch(`/api/tracks/${trackId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, author: authorName, book: bookName, trackNumber, pdfPage, tempo, timeSignature }),
    });

    if (!response.ok) {
      throw new Error("Failed to update metadata");
    }

    // Update chapterId separately using PATCH
    if (chapterId !== undefined) {
      await fetch(`/api/tracks/${trackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId }),
      });
    }

    // Fetch library to refresh all data - derived states will update automatically
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

      setCurrentTrack(prev =>
        prev?.id === currentTrack.id ? { ...prev, tempo, timeSignature } : prev
      );
      updateTrackInBookDetail(currentTrack.id, t => ({ ...t, tempo, timeSignature }));
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

    // Update lightweight authors data - only clone the author that contains the target book
    setAuthors((prevAuthors) =>
      prevAuthors.map((author) => {
        if (!author.books.some(b => b.id === bookId)) return author;
        return {
          ...author,
          books: author.books.map((book) =>
            book.id === bookId ? { ...book, inProgress } : book
          ),
        };
      })
    );
    // Update book detail if it's the currently selected book
    setSelectedBookDetail(prev =>
      prev?.id === bookId ? { ...prev, inProgress } : prev
    );
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

    setCurrentTrack(prev =>
      prev?.id === trackId ? { ...prev, completed } : prev
    );
    updateTrackInBookDetail(trackId, t => ({ ...t, completed }));
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

    setCurrentTrack(prev =>
      prev?.id === trackId ? { ...prev, pdfPage: page } : prev
    );
    updateTrackInBookDetail(trackId, t => ({ ...t, pdfPage: page }));
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

  const handleVideoUpload = async (bookId: string, file: File) => {
    const formData = new FormData();
    formData.append("video", file);

    try {
      const response = await fetch(`/api/books/${bookId}/videos`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        await fetchLibrary();
      }
    } catch (error) {
      console.error("Error uploading video:", error);
    }
  };

  const handleVideoDelete = async (bookId: string, videoId: string) => {
    try {
      const response = await fetch(`/api/books/${bookId}/videos/${videoId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchLibrary();
      }
    } catch (error) {
      console.error("Error deleting video:", error);
    }
  };

  const handleVideoUpdate = async (
    bookId: string,
    videoId: string,
    filename: string,
    sortOrder: number,
    title?: string | null,
    trackNumber?: number | null,
    pdfPage?: number | null,
    chapterId?: string | null,
    completed?: boolean
  ) => {
    try {
      const response = await fetch(`/api/books/${bookId}/videos/${videoId}/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filename, sortOrder, title, trackNumber, pdfPage, chapterId, completed }),
      });

      if (response.ok) {
        await fetchLibrary();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update video");
      }
    } catch (error) {
      console.error("Error updating video:", error);
      alert("Failed to update video");
    }
  };

  const handleVideoComplete = async (bookId: string, videoId: string, completed: boolean) => {
    // Get the current video to pass its required fields - search both book-level and chapter videos
    const video = selectedBookDetail?.videos?.find(v => v.id === videoId)
      || selectedBookDetail?.chapters?.flatMap(ch => ch.videos).find(v => v.id === videoId);
    if (!video) return;

    await handleVideoUpdate(
      bookId,
      videoId,
      video.filename,
      video.sortOrder,
      video.title,
      video.trackNumber,
      video.pdfPage,
      video.chapterId,
      completed
    );
  };

  const handleBulkVideoUpload = async (files: File[], authorName: string, bookName: string) => {
    const formData = new FormData();
    formData.append("authorName", authorName);
    formData.append("bookName", bookName);

    for (const file of files) {
      formData.append("videos", file);
    }

    try {
      const response = await fetch("/api/videos/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        await fetchLibrary();
      } else {
        const data = await response.json();
        throw new Error(data.error || "Failed to upload videos");
      }
    } catch (error) {
      console.error("Error uploading videos:", error);
      throw error;
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

    if (currentJamTrackId === jamTrackId) {
      setCurrentJamTrackId(null);
    }
  };

  const handleJamTrackPdfUpload = async (jamTrackId: string, file: File, name: string) => {
    const formData = new FormData();
    formData.append("pdf", file);
    formData.append("name", name);

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
      }
    } catch (error) {
      console.error("Error uploading jam track PDF:", error);
    }
  };

  const handleJamTrackPdfDelete = async (jamTrackId: string, pdfId: string) => {
    try {
      const response = await fetch(`/api/jamtracks/${jamTrackId}/pdf?pdfId=${pdfId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setJamTracks((prev) =>
          prev.map((jt) =>
            jt.id === jamTrackId
              ? { ...jt, pdfs: jt.pdfs.filter((p) => p.id !== pdfId) }
              : jt
          )
        );
        if (activePdfId === pdfId) {
          setActivePdfId(null);
          setActivePdfPage(1);
        }
      }
    } catch (error) {
      console.error("Error deleting jam track PDF:", error);
    }
  };

  // Page Sync Point handlers for jam track PDFs
  const handleActivePdfChange = useCallback((pdfId: string, page: number) => {
    setActivePdfId(pdfId);
    setActivePdfPage(page);
  }, []);

  const handleAddPageSyncPoint = async () => {
    if (!currentJamTrack || !activePdfId) return;

    try {
      const response = await fetch(
        `/api/jamtracks/${currentJamTrack.id}/pdf/${activePdfId}/syncpoints`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timeInSeconds: currentAudioTime,
            pageNumber: activePdfPage,
          }),
        }
      );

      if (response.ok) {
        const newSyncPoint = await response.json();
        setJamTracks((prev) =>
          prev.map((jt) =>
            jt.id === currentJamTrack.id
              ? {
                  ...jt,
                  pdfs: jt.pdfs.map((pdf) =>
                    pdf.id === activePdfId
                      ? { ...pdf, pageSyncPoints: [...pdf.pageSyncPoints, newSyncPoint] }
                      : pdf
                  ),
                }
              : jt
          )
        );
      }
    } catch (error) {
      console.error("Error adding page sync point:", error);
    }
  };

  const handleDeletePageSyncPoint = async (syncPointId: string) => {
    if (!currentJamTrack || !activePdfId) return;

    try {
      const response = await fetch(
        `/api/jamtracks/${currentJamTrack.id}/pdf/${activePdfId}/syncpoints?syncPointId=${syncPointId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setJamTracks((prev) =>
          prev.map((jt) =>
            jt.id === currentJamTrack.id
              ? {
                  ...jt,
                  pdfs: jt.pdfs.map((pdf) =>
                    pdf.id === activePdfId
                      ? { ...pdf, pageSyncPoints: pdf.pageSyncPoints.filter((sp) => sp.id !== syncPointId) }
                      : pdf
                  ),
                }
              : jt
          )
        );
      }
    } catch (error) {
      console.error("Error deleting page sync point:", error);
    }
  };

  const handleClearPageSyncPoints = async () => {
    if (!currentJamTrack || !activePdfId) return;

    try {
      const response = await fetch(
        `/api/jamtracks/${currentJamTrack.id}/pdf/${activePdfId}/syncpoints`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setJamTracks((prev) =>
          prev.map((jt) =>
            jt.id === currentJamTrack.id
              ? {
                  ...jt,
                  pdfs: jt.pdfs.map((pdf) =>
                    pdf.id === activePdfId
                      ? { ...pdf, pageSyncPoints: [] }
                      : pdf
                  ),
                }
              : jt
          )
        );
      }
    } catch (error) {
      console.error("Error clearing page sync points:", error);
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
        setJamTracks((prev) =>
          prev.map((jt) =>
            jt.id === jamTrackId
              ? { ...jt, markers: jt.markers.map(m => m.id === markerId ? { ...m, timestamp } : m) }
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
        setJamTracks((prev) =>
          prev.map((jt) =>
            jt.id === jamTrackId
              ? { ...jt, markers: jt.markers.map(m => m.id === markerId ? { ...m, name } : m) }
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
        setJamTracks((prev) =>
          prev.map((jt) =>
            jt.id === jamTrackId
              ? { ...jt, markers: jt.markers.filter(m => m.id !== markerId) }
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

  // Refs for handler functions so useCallback wrappers stay stable
  const handleMarkerAddRef = useRef(handleMarkerAdd);
  handleMarkerAddRef.current = handleMarkerAdd;
  const handleJamTrackMarkerAddRef = useRef(handleJamTrackMarkerAdd);
  handleJamTrackMarkerAddRef.current = handleJamTrackMarkerAdd;
  const handleMarkerUpdateRef = useRef(handleMarkerUpdate);
  handleMarkerUpdateRef.current = handleMarkerUpdate;
  const handleJamTrackMarkerUpdateRef = useRef(handleJamTrackMarkerUpdate);
  handleJamTrackMarkerUpdateRef.current = handleJamTrackMarkerUpdate;
  const handleMarkerRenameRef = useRef(handleMarkerRename);
  handleMarkerRenameRef.current = handleMarkerRename;
  const handleJamTrackMarkerRenameRef = useRef(handleJamTrackMarkerRename);
  handleJamTrackMarkerRenameRef.current = handleJamTrackMarkerRename;
  const handleMarkerDeleteRef = useRef(handleMarkerDelete);
  handleMarkerDeleteRef.current = handleMarkerDelete;
  const handleJamTrackMarkerDeleteRef = useRef(handleJamTrackMarkerDelete);
  handleJamTrackMarkerDeleteRef.current = handleJamTrackMarkerDelete;
  const handleMarkersClearRef = useRef(handleMarkersClear);
  handleMarkersClearRef.current = handleMarkersClear;
  const handleJamTrackMarkersClearRef = useRef(handleJamTrackMarkersClear);
  handleJamTrackMarkersClearRef.current = handleJamTrackMarkersClear;

  // Stable callbacks for BottomPlayer (never change reference, read from refs)
  const stableOnMarkerAdd = useCallback((trackId: string, name: string, timestamp: number) => {
    if (currentJamTrackRef.current) {
      handleJamTrackMarkerAddRef.current(trackId, name, timestamp);
    } else {
      handleMarkerAddRef.current(trackId, name, timestamp);
    }
  }, []);

  const stableOnMarkerUpdate = useCallback((markerId: string, timestamp: number) => {
    if (currentJamTrackRef.current) {
      handleJamTrackMarkerUpdateRef.current(currentJamTrackRef.current.id, markerId, timestamp);
    } else {
      handleMarkerUpdateRef.current(markerId, timestamp);
    }
  }, []);

  const stableOnMarkerRename = useCallback((markerId: string, name: string) => {
    if (currentJamTrackRef.current) {
      handleJamTrackMarkerRenameRef.current(currentJamTrackRef.current.id, markerId, name);
    } else {
      handleMarkerRenameRef.current(markerId, name);
    }
  }, []);

  const stableOnMarkerDelete = useCallback((markerId: string) => {
    if (currentJamTrackRef.current) {
      handleJamTrackMarkerDeleteRef.current(currentJamTrackRef.current.id, markerId);
    } else {
      handleMarkerDeleteRef.current(markerId);
    }
  }, []);

  const stableOnMarkersClear = useCallback((trackId: string) => {
    if (currentJamTrackRef.current) {
      handleJamTrackMarkersClearRef.current(trackId);
    } else {
      handleMarkersClearRef.current(trackId);
    }
  }, []);

  const stableOnTimeUpdate = useCallback((time: number, playing: boolean) => {
    setCurrentAudioTime(time);
    setAudioIsPlaying(playing);
  }, []);

  const stableOnSeekReady = useCallback((seekFn: (time: number) => void) => {
    seekFnRef.current = seekFn;
  }, []);

  // Auto-navigate to track's PDF page when track changes
  useEffect(() => {
    if (currentTrack?.pdfPage) {
      setPdfPage(currentTrack.pdfPage);
    }
  }, [currentTrack?.id, currentTrack?.pdfPage]);

  // Auto-navigate to video's PDF page when video changes
  useEffect(() => {
    if (selectedVideo?.pdfPage) {
      setPdfPage(selectedVideo.pdfPage);
    }
  }, [selectedVideo?.id, selectedVideo?.pdfPage]);

  // Reset video state when selected book changes
  useEffect(() => {
    setSelectedVideo(null);
    setShowVideo(false);
  }, [selectedBookId]);


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
                    onVideoUploadClick={() => setIsVideoUploadModalOpen(true)}
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
                  {selectedBookId && !selectedBookDetail ? (
                    <div className="h-full flex items-center justify-center bg-gray-900">
                      <div className="w-8 h-8 border-4 border-gray-600 border-t-gray-400 rounded-full animate-spin"></div>
                    </div>
                  ) : selectedBookDetail && selectedAuthor ? (
                    <TrackListView
                      author={selectedAuthor}
                      book={selectedBookDetail}
                      currentTrack={currentTrack}
                      selectedVideo={selectedVideo}
                      showVideo={showVideo}
                      onTrackSelect={(track) => handleTrackSelect(track)}
                      onVideoSelect={handleVideoSelect}
                      onToggleVideo={() => setShowVideo(!showVideo)}
                      onBack={() => {
                        setSelectedBookId(null);
                        setSelectedBookDetail(null);
                        setCurrentTrack(null);
                        setCurrentAuthorId(null);
                        setCurrentBookId(null);
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
                      onVideoUpload={handleVideoUpload}
                      onVideoDelete={handleVideoDelete}
                      onVideoUpdate={handleVideoUpdate}
                      onVideoComplete={handleVideoComplete}
                      onLibraryRefresh={fetchLibrary}
                    />
                  ) : isJamTracksSelected ? (
                    <JamTracksView
                      jamTracks={jamTracks}
                      currentJamTrack={currentJamTrack}
                      onJamTrackSelect={handleJamTrackSelect}
                      onJamTrackUpdate={handleJamTrackUpdate}
                      onJamTrackComplete={handleJamTrackComplete}
                      onJamTrackDelete={handleJamTrackDelete}
                      onPdfUpload={handleJamTrackPdfUpload}
                      onPdfDelete={handleJamTrackPdfDelete}
                      onUpload={handleJamTrackUpload}
                      isUploading={isUploadingJamTracks}
                      onYouTubeImport={handleYouTubeImport}
                      isImportingFromYouTube={isImportingFromYouTube}
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

              {/* Bottom Player - Collapses when no track selected */}
              <div
                className={`shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
                  currentTrack || currentJamTrack
                    ? "h-[30vh] min-h-55 max-h-80"
                    : "h-0 min-h-0 max-h-0"
                }`}
              >
                <BottomPlayer
                  track={currentTrack || currentJamTrack}
                  onMarkerAdd={stableOnMarkerAdd}
                  onMarkerUpdate={stableOnMarkerUpdate}
                  onMarkerRename={stableOnMarkerRename}
                  onMarkerDelete={stableOnMarkerDelete}
                  onMarkersClear={stableOnMarkersClear}
                  externalMarkersBar={true}
                  onMarkerBarStateChange={setMarkerBarState}
                  onTimeUpdate={stableOnTimeUpdate}
                  onSeekReady={stableOnSeekReady}
                />
              </div>
            </div>

            {/* PDF/Video Panel - Always visible, 50% width */}
            <div className="w-1/2 flex flex-col">
              {selectedVideo && showVideo ? (
                /* Video Player - Full Height */
                <div className="flex-1 overflow-hidden">
                  <VideoPlayer video={selectedVideo} />
                </div>
              ) : currentJamTrack && currentJamTrack.pdfs.length > 0 ? (
                <>
                  {(() => {
                    const activePdf = currentJamTrack.pdfs.find(p => p.id === activePdfId) || currentJamTrack.pdfs[0];
                    return activePdf ? (
                      <PageSyncEditor
                        pdfId={activePdf.id}
                        pdfName={activePdf.name}
                        syncPoints={activePdf.pageSyncPoints}
                        syncEditMode={pageSyncEditMode}
                        onToggleSyncEditMode={() => setPageSyncEditMode(!pageSyncEditMode)}
                        currentAudioTime={currentAudioTime}
                        currentVisiblePage={activePdfPage}
                        onAddSyncPoint={handleAddPageSyncPoint}
                        onDeleteSyncPoint={handleDeletePageSyncPoint}
                        onClearSyncPoints={handleClearPageSyncPoints}
                      />
                    ) : null;
                  })()}
                  <div className="flex-1 overflow-hidden">
                    <PdfViewer
                      pdfs={currentJamTrack.pdfs}
                      currentAudioTime={currentAudioTime}
                      audioIsPlaying={audioIsPlaying}
                      onActivePdfChange={handleActivePdfChange}
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
                    <p className="text-lg">Select a book with a PDF or jam track with sheets</p>
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
      ) : activeSection === 'tools' ? (
        <Tools />
      ) : activeSection === 'circle' ? (
        <CircleOfFifths />
      ) : (
        <Fretboard />
      )}

      {/* Video Upload Modal */}
      <VideoUploadModal
        isOpen={isVideoUploadModalOpen}
        onClose={() => setIsVideoUploadModalOpen(false)}
        onUpload={handleBulkVideoUpload}
        authors={authors}
      />
    </div>
  );
}
