"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import BookGrid from "@/components/BookGrid";
import TrackListView from "@/components/TrackListView";
import JamTracksView from "@/components/JamTracksView";
import JamTrackCompactSelector from "@/components/JamTrackCompactSelector";
import BottomPlayer, { MarkerBarState } from "@/components/BottomPlayer";
import MarkersBar from "@/components/MarkersBar";
import TopNav from "@/components/TopNav";
import Fretboard from "@/components/Fretboard";
import CircleOfFifths from "@/components/CircleOfFifths";
import IntervalExplorer from "@/components/IntervalExplorer";
import ChordBuilder from "@/components/ChordBuilder";

import { sortPdfs } from "@/lib/formatting";
import PdfViewer from "@/components/PdfViewer";
import Videos from "@/components/Videos";
import Tools from "@/components/Tools";
import TabEditor from "@/components/TabEditor";
import MetricsView from "@/components/MetricsView";
import HomeView from "@/components/HomeView";
import PageSyncEditor from "@/components/PageSyncEditor";
import VideoUploadModal from "@/components/VideoUploadModal";
import VideoPlayer from "@/components/VideoPlayer";
import { AuthorSummary, BookSummary, Book, Track, Marker, JamTrack, JamTrackMarker, BookVideo, SearchResultTrack, SearchResultBook, SearchResultJamTrack } from "@/types";

type Section = 'home' | 'lessons' | 'videos' | 'fretboard' | 'intervals' | 'chords' | 'tools' | 'circle' | 'tabs' | 'jamtracks' | 'metrics';

const getSectionFromPath = (section: string[] | undefined): Section => {
  if (!section || section.length === 0) return 'home';
  const first = section[0];
  if (first === 'home' || first === 'lessons' || first === 'videos' || first === 'fretboard' || first === 'intervals' || first === 'chords' || first === 'tools' || first === 'circle' || first === 'tabs' || first === 'jamtracks' || first === 'metrics') {
    return first;
  }
  return 'home';
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
  const [showInProgressOnly, setShowInProgressOnly] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState<{ processed: number; total: number } | null>(null);
  const [isUploadingJamTracks, setIsUploadingJamTracks] = useState(false);
  const [isImportingFromYouTube, setIsImportingFromYouTube] = useState(false);
  const [isImportingPsarc, setIsImportingPsarc] = useState(false);

  // Flatten all books from all authors for the library grid
  const allBooks = useMemo(() =>
    authors.flatMap((author) =>
      author.books.map((book) => ({ book, author }))
    ),
    [authors]
  );
  const [isVideoUploadModalOpen, setIsVideoUploadModalOpen] = useState(false);
  const [pendingVideoFiles, setPendingVideoFiles] = useState<File[]>([]);
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
  const lastTrackAutoFlipPage = useRef<number>(0);

  // Page sync state for jam track PDFs
  const [pageSyncEditMode, setPageSyncEditMode] = useState(false);
  const [activePdfId, setActivePdfId] = useState<string | null>(null);
  const [activePdfPage, setActivePdfPage] = useState(1);

  // Mobile responsive state
  const [mobileView, setMobileView] = useState<'library' | 'player' | 'pdf'>('library');

  // Refs for stable BottomPlayer callbacks (avoids new function references every render)
  const currentJamTrackRef = useRef(currentJamTrack);
  currentJamTrackRef.current = currentJamTrack;

  // Get active section from URL path
  const activeSection = getSectionFromPath(params.section as string[] | undefined);

  // Helper to update library URL with artist/album params
  const updateLibraryUrl = (
    artistId: string | null,
    albumId: string | null,
    trackId?: string | null
  ) => {
    const params = new URLSearchParams();
    if (artistId) params.set('artist', artistId);
    if (albumId) params.set('album', albumId);
    if (trackId) params.set('track', trackId);
    const newUrl = params.toString() ? `/lessons?${params.toString()}` : '/lessons';
    window.history.replaceState({}, '', newUrl);
  };

  const updateJamTrackUrl = (jamTrackId: string | null) => {
    const newUrl = jamTrackId ? `/jamtracks?track=${jamTrackId}` : '/jamtracks';
    window.history.replaceState({}, '', newUrl);
  };

  const handleSectionChange = (section: Section) => {
    window.dispatchEvent(new Event('practiceSessionFlush'));
    if (section !== 'lessons') {
      setCurrentTrack(null);
      setCurrentAuthorId(null);
      setCurrentBookId(null);
    }
    if (section !== 'jamtracks') {
      setCurrentJamTrackId(null);
    }
    router.push(`/${section}`);
  };

  const fetchBookDetail = useCallback(async (bookId: string): Promise<Book | null> => {
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

        return bookData;
      }
    } catch (error) {
      console.error("Error fetching book detail:", error);
    }
    return null;
  }, []);

  const fetchLibrary = useCallback(async (restoreFromUrl = false) => {
    try {
      const response = await fetch("/api/library");
      if (response.ok) {
        const data = await response.json();
        const authorsData: AuthorSummary[] = data.authors || [];
        const jamTracksData = (data.jamTracks || []).map((jt: JamTrack) => ({
          ...jt,
          markers: jt.markers ?? [],
        }));
        setAuthors(authorsData);
        setJamTracks(jamTracksData);

        // Restore state from URL on initial load
        if (restoreFromUrl) {
          const bookId = searchParams.get('album');
          const trackId = searchParams.get('track');
          const videoId = searchParams.get('video');
          const jamTrackId = searchParams.get('track'); // For jamtracks section

          // Restore library selection (book/track/video)
          if (bookId) {
            // Find the book and its author across all authors
            let foundBook: BookSummary | null = null;
            let foundAuthor: AuthorSummary | null = null;
            for (const author of authorsData) {
              const book = author.books.find((b: BookSummary) => b.id === bookId);
              if (book) {
                foundBook = book;
                foundAuthor = author;
                break;
              }
            }

            if (foundBook && foundAuthor) {
              setSelectedAuthorId(foundAuthor.id);
              setSelectedBookId(bookId);
              if (foundBook.pdfPath) {
                setPdfPath(foundBook.pdfPath);
              }
              const bookDetail = await fetchBookDetail(bookId);

              // Restore video selection if specified in URL
              if (videoId && bookDetail) {
                const video = bookDetail.videos?.find((v: BookVideo) => v.id === videoId)
                  ?? bookDetail.chapters?.flatMap((ch: { videos: BookVideo[] }) => ch.videos).find((v: BookVideo) => v.id === videoId);
                if (video) {
                  setTimeout(() => handleVideoSelect(video), 0);
                }
              }
              // Restore track selection if specified in URL
              else if (trackId && bookDetail) {
                const track = bookDetail.tracks?.find((t: Track) => t.id === trackId)
                  ?? bookDetail.chapters?.flatMap((ch: { tracks: Track[] }) => ch.tracks).find((t: Track) => t.id === trackId);
                if (track) {
                  setCurrentTrack(track);
                  setCurrentAuthorId(foundAuthor.id);
                  setCurrentBookId(bookId);
                }
              }
            }
          }

          // Restore jam track selection if on jamtracks section
          if (jamTrackId && window.location.pathname.includes('jamtracks')) {
            const jamTrack = jamTracksData.find((jt: JamTrack) => jt.id === jamTrackId);
            if (jamTrack) {
              // Use setTimeout to ensure state is set after component mounts
              setTimeout(() => {
                handleJamTrackSelect(jamTrack);
              }, 0);
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


  const handleBookSelect = (book: BookSummary, author: AuthorSummary) => {
    setSelectedAuthorId(author.id);
    setSelectedBookId(book.id);
    setSelectedBookDetail(null);
    setCurrentTrack(null);
    setCurrentAuthorId(null);
    setCurrentBookId(null);
    setCurrentJamTrackId(null);
    if (book.pdfPath) {
      setPdfPath(book.pdfPath);
    }
    updateLibraryUrl(author.id, book.id);
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

  const handleAnalyzeLoudness = async () => {
    setIsAnalyzing(true);
    setAnalyzeProgress(null);
    try {
      const response = await fetch("/api/library/analyze-loudness", { method: "POST" });
      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const match = line.match(/^data: (.+)$/m);
          if (match) {
            try {
              const data = JSON.parse(match[1]);
              if (data.type === "progress" || data.type === "done") {
                setAnalyzeProgress({ processed: data.processed, total: data.total });
              }
            } catch { /* skip malformed */ }
          }
        }
      }
    } catch (error) {
      console.error("Error analyzing loudness:", error);
    } finally {
      setIsAnalyzing(false);
      setAnalyzeProgress(null);
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

  const handlePsarcImport = async (file: File) => {
    setIsImportingPsarc(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/jamtracks/rocksmith", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to import .psarc file");
      }

      await fetchLibrary();
    } catch (error) {
      console.error("Error importing .psarc:", error);
      throw error;
    } finally {
      setIsImportingPsarc(false);
    }
  };

  const handleTrackSelect = (track: Track) => {
    setCurrentTrack(track);
    setCurrentAuthorId(selectedAuthorId);
    setCurrentBookId(selectedBookId);
    setCurrentJamTrackId(null);
    setSelectedVideo(null);
    setShowVideo(false);
    if (selectedBookDetail?.pdfPath) {
      setPdfPath(selectedBookDetail.pdfPath);
    }
    // Always reset to track's initial PDF page on selection (including re-select)
    if (track.pdfPage) {
      lastTrackAutoFlipPage.current = track.pdfPage;
      setPdfPage(track.pdfPage);
    }
    // Update URL with track selection
    updateLibraryUrl(selectedAuthorId, selectedBookId, track.id);
  };

  const handleVideoSelect = (video: BookVideo) => {
    setSelectedVideo(video);
    // Only show video if no video was previously selected, otherwise maintain current view mode
    if (!selectedVideo) {
      setShowVideo(true);
    }
    setCurrentTrack(null);
    setCurrentAuthorId(null);
    setCurrentBookId(null);
    setCurrentJamTrackId(null);
    if (video.pdfPage && selectedBookDetail?.pdfPath) {
      setPdfPath(selectedBookDetail.pdfPath);
      setPdfPage(video.pdfPage);
    }
  };

  const handleGoToTrackFromMetrics = (
    trackId: string | null,
    jamTrackId: string | null,
    authorId: string | null,
    bookId: string | null,
    bookVideoId?: string | null,
    videoId?: string | null,
  ) => {
    if (videoId) {
      router.push(`/videos?video=${videoId}`);
      return;
    }

    if (jamTrackId) {
      router.push(`/jamtracks?track=${jamTrackId}`);
      return;
    }

    if (bookVideoId && bookId) {
      const params = new URLSearchParams();
      if (authorId) params.set('artist', authorId);
      params.set('album', bookId);
      params.set('video', bookVideoId);
      router.push(`/lessons?${params.toString()}`);
      return;
    }

    if (trackId && bookId) {
      const params = new URLSearchParams();
      if (authorId) params.set('artist', authorId);
      params.set('album', bookId);
      params.set('track', trackId);
      router.push(`/lessons?${params.toString()}`);
      return;
    }

    if (bookId) {
      const params = new URLSearchParams();
      if (authorId) params.set('artist', authorId);
      params.set('album', bookId);
      router.push(`/lessons?${params.toString()}`);
    }
  };

  const handleJamTrackSelect = async (jamTrack: JamTrack) => {
    setCurrentJamTrackId(jamTrack.id);
    setCurrentTrack(null);
    setCurrentAuthorId(null);
    setCurrentBookId(null);
    setPageSyncEditMode(false);
    setActivePdfId(null);
    setActivePdfPage(1);

    // Update URL with jam track selection
    updateJamTrackUrl(jamTrack.id);

    // Fetch full jam track data (markers, sync points) - not loaded by library endpoint
    try {
      const res = await fetch(`/api/jamtracks/${jamTrack.id}`);
      if (res.ok) {
        const fullJamTrack = await res.json();
        setJamTracks(prev => prev.map(jt => jt.id === jamTrack.id ? fullJamTrack : jt));
      }
    } catch (err) {
      console.error("Failed to fetch jam track details:", err);
    }
  };

  // Search result handlers
  const handleSearchTrackSelect = async (result: SearchResultTrack) => {
    // Set selection state before navigating (handleTrackSelect reads these)
    setSelectedAuthorId(result.book.authorId);
    setSelectedBookId(result.book.id);
    updateLibraryUrl(result.book.authorId, result.book.id, result.id);
    router.push("/lessons");

    // Fetch book detail, then select the track
    const bookDetail = await fetchBookDetail(result.book.id);
    if (bookDetail) {
      const track = bookDetail.tracks.find(t => t.id === result.id)
        || bookDetail.chapters?.flatMap(ch => ch.tracks).find(t => t.id === result.id);
      if (track) {
        handleTrackSelect(track);
      }
    }
  };

  const handleSearchBookSelect = (result: SearchResultBook) => {
    const authorSummary: AuthorSummary = { id: result.authorId, name: result.author.name, books: [] };
    const bookSummary: BookSummary = {
      id: result.id, name: result.name, authorId: result.authorId,
      pdfPath: result.pdfPath, inProgress: false, trackCount: 0, coverTrackPath: null,
    };
    handleBookSelect(bookSummary, authorSummary);
    router.push("/lessons");
  };

  const handleSearchJamTrackSelect = (result: SearchResultJamTrack) => {
    const jamTrack = jamTracks.find(jt => jt.id === result.id);
    if (jamTrack) {
      handleJamTrackSelect(jamTrack);
    }
    router.push("/jamtracks");
  };

  const handleMarkerAdd = async (
    trackId: string,
    name: string,
    timestamp: number,
    pdfPage?: number | null
  ) => {
    try {
      const response = await fetch("/api/markers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, name, timestamp, pdfPage }),
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

  const handleMarkerRename = async (markerId: string, name: string, pdfPage?: number | null) => {
    try {
      const body: Record<string, unknown> = { name };
      if (pdfPage !== undefined) body.pdfPage = pdfPage;
      const response = await fetch(`/api/markers/${markerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const updateMarkers = (markers: Marker[]) =>
          markers.map(m => m.id === markerId ? { ...m, name, ...(pdfPage !== undefined ? { pdfPage } : {}) } : m);
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

  const handleTrackFavorite = async (trackId: string, favorite: boolean) => {
    const response = await fetch(`/api/tracks/${trackId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite }),
    });

    if (!response.ok) {
      throw new Error("Failed to update track favorite status");
    }

    setCurrentTrack(prev =>
      prev?.id === trackId ? { ...prev, favorite } : prev
    );
    updateTrackInBookDetail(trackId, t => ({ ...t, favorite }));
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
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("authorName", authorName);
        formData.append("bookName", bookName);
        formData.append("videos", file);

        const response = await fetch("/api/videos/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to upload ${file.name}`);
        }
      }
      await fetchLibrary();
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

  const handleJamTrackFavorite = async (jamTrackId: string, favorite: boolean) => {
    const response = await fetch(`/api/jamtracks/${jamTrackId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite }),
    });

    if (!response.ok) {
      throw new Error("Failed to update jam track favorite status");
    }

    setJamTracks((prev) =>
      prev.map((jt) => (jt.id === jamTrackId ? { ...jt, favorite } : jt))
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
  const stableOnMarkerAdd = useCallback((trackId: string, name: string, timestamp: number, pdfPage?: number | null) => {
    if (currentJamTrackRef.current) {
      handleJamTrackMarkerAddRef.current(trackId, name, timestamp);
    } else {
      handleMarkerAddRef.current(trackId, name, timestamp, pdfPage);
    }
  }, []);

  const stableOnMarkerUpdate = useCallback((markerId: string, timestamp: number) => {
    if (currentJamTrackRef.current) {
      handleJamTrackMarkerUpdateRef.current(currentJamTrackRef.current.id, markerId, timestamp);
    } else {
      handleMarkerUpdateRef.current(markerId, timestamp);
    }
  }, []);

  const stableOnMarkerRename = useCallback((markerId: string, name: string, pdfPage?: number | null) => {
    if (currentJamTrackRef.current) {
      handleJamTrackMarkerRenameRef.current(currentJamTrackRef.current.id, markerId, name);
    } else {
      handleMarkerRenameRef.current(markerId, name, pdfPage);
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

  // Reset page flip tracking when track changes
  const prevTrackIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentTrack?.id !== prevTrackIdRef.current) {
      lastTrackAutoFlipPage.current = 0;
      prevTrackIdRef.current = currentTrack?.id ?? null;
      // Immediately navigate to track's initial pdfPage on selection
      if (currentTrack?.pdfPage) {
        setPdfPage(currentTrack.pdfPage);
        lastTrackAutoFlipPage.current = currentTrack.pdfPage;
      }
    }
  }, [currentTrack?.id, currentTrack?.pdfPage]);

  // Auto-flip PDF page based on marker pdfPages during playback
  useEffect(() => {
    if (!currentTrack) return;

    // Markers with pdfPage, sorted by timestamp
    const pageMarkers = currentTrack.markers
      .filter((m): m is Marker & { pdfPage: number } => m.pdfPage != null)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (pageMarkers.length === 0) return;

    let targetPage: number | null = null;
    for (let i = pageMarkers.length - 1; i >= 0; i--) {
      if (currentAudioTime >= pageMarkers[i].timestamp) {
        targetPage = pageMarkers[i].pdfPage;
        break;
      }
    }

    // Before any marker is reached, fall back to track's initial pdfPage
    if (targetPage === null && currentTrack.pdfPage) {
      targetPage = currentTrack.pdfPage;
    }

    if (targetPage !== null && targetPage !== lastTrackAutoFlipPage.current) {
      lastTrackAutoFlipPage.current = targetPage;
      setPdfPage(targetPage);
    }
  }, [currentTrack?.id, currentTrack?.markers, currentAudioTime]);

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
      <TopNav
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onSearchTrackSelect={handleSearchTrackSelect}
        onSearchBookSelect={handleSearchBookSelect}
        onSearchJamTrackSelect={handleSearchJamTrackSelect}
      />

      {/* Loudness Analysis Progress Banner */}
      {isAnalyzing && (
        <div className="flex items-center gap-3 px-4 py-2 bg-purple-900/50 border-b border-purple-700/50 text-sm text-purple-200">
          <div className="w-4 h-4 border-2 border-purple-400 border-t-purple-200 rounded-full animate-spin shrink-0" />
          <span>
            Analyzing loudness{analyzeProgress ? ` — ${analyzeProgress.processed} / ${analyzeProgress.total} tracks` : '...'}
          </span>
        </div>
      )}

      {/* Section Content */}
      {activeSection === 'home' ? (
        <HomeView onGoToTrack={handleGoToTrackFromMetrics} authors={authors} />
      ) : activeSection === 'lessons' ? (
        <>
          <div className="flex flex-col xl:flex-row flex-1 min-h-0">
            {/* Left side: Content + Player - Full width when no book selected, 50% on xl+ when book open */}
            <div className={`w-full ${selectedBookId ? 'xl:w-1/2 xl:border-r border-gray-700' : ''} flex flex-col min-w-0`}>
              {/* Main Content Area */}
              <div className="flex-1 min-h-0">
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
                    onTrackSelect={handleTrackSelect}
                    onVideoSelect={handleVideoSelect}
                    onToggleVideo={() => setShowVideo(!showVideo)}
                    onBack={() => {
                      setSelectedBookId(null);
                      setSelectedBookDetail(null);
                      setCurrentTrack(null);
                      setCurrentAuthorId(null);
                      setCurrentBookId(null);
                      updateLibraryUrl(null, null);
                    }}
                    onBookUpdate={handleBookUpdate}
                    onTrackUpdate={handleMetadataUpdate}
                    onTrackComplete={handleTrackComplete}
                    onTrackFavorite={handleTrackFavorite}
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
                ) : (
                  <BookGrid
                    books={allBooks}
                    onBookSelect={handleBookSelect}
                    onScan={handleScan}
                    onUpload={handleUpload}
                    onVideoUpload={(files) => {
                      setPendingVideoFiles(files);
                      setIsVideoUploadModalOpen(true);
                    }}
                    isScanning={isScanning}
                    isUploading={isUploading}
                    showInProgressOnly={showInProgressOnly}
                    onToggleInProgress={() => setShowInProgressOnly(v => !v)}
                    onAnalyzeLoudness={handleAnalyzeLoudness}
                    isAnalyzing={isAnalyzing}
                    analyzeProgress={analyzeProgress}
                  />
                )}
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

            {/* PDF/Video Panel - Hidden on mobile and when no book selected, visible on xl+ */}
            <div className={`${selectedBookId ? 'hidden xl:flex xl:w-1/2' : 'hidden'} flex-col`}>
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
                        syncPoints={activePdf.pageSyncPoints ?? []}
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
                      pdfs={sortPdfs(currentJamTrack.pdfs)}
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
              editingMarkerId={markerBarState.editingMarkerId}
              editingMarkerName={markerBarState.editingMarkerName}
              currentTime={markerBarState.currentTime}
              onLeadInChange={markerBarState.setLeadIn}
              onAddMarker={markerBarState.addMarker}
              onJumpToMarker={markerBarState.jumpToMarker}
              onStartEdit={(id, name) => {
                markerBarState.setEditingMarkerId(id);
                markerBarState.setEditingMarkerName(name);
              }}
              onEditNameChange={markerBarState.setEditingMarkerName}
              onSaveEdit={(markerId, name, markerPdfPage) => {
                if (currentJamTrack) {
                  handleJamTrackMarkerRename(currentJamTrack.id, markerId, name);
                } else {
                  handleMarkerRename(markerId, name, markerPdfPage);
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
              currentPdfPage={pdfPage}
              hasPdf={!!pdfPath && !currentJamTrack}
            />
          )}

          {/* Mobile Bottom Navigation - Only visible on mobile */}
          <div className="xl:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-30 safe-area-inset-bottom">
            <div className="flex">
              <button
                className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 ${
                  mobileView === 'library' ? 'text-blue-400' : 'text-gray-400'
                }`}
                onClick={() => setMobileView('library')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
                </svg>
                <span className="text-xs">Lessons</span>
              </button>
              <button
                className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 ${
                  mobileView === 'player' ? 'text-blue-400' : 'text-gray-400'
                } ${!currentTrack && !currentJamTrack ? 'opacity-50' : ''}`}
                onClick={() => currentTrack || currentJamTrack ? setMobileView('player') : null}
                disabled={!currentTrack && !currentJamTrack}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs">Player</span>
              </button>
              <button
                className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 ${
                  mobileView === 'pdf' ? 'text-blue-400' : 'text-gray-400'
                } ${!pdfPath && (!currentJamTrack || currentJamTrack.pdfs.length === 0) ? 'opacity-50' : ''}`}
                onClick={() => (pdfPath || (currentJamTrack && currentJamTrack.pdfs.length > 0)) ? setMobileView('pdf') : null}
                disabled={!pdfPath && (!currentJamTrack || currentJamTrack.pdfs.length === 0)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs">PDF</span>
              </button>
            </div>
          </div>
        </>
      ) : activeSection === 'jamtracks' ? (
        <>
          {/* Show full layout when no track selected */}
          {!currentJamTrack ? (
            <div className="flex flex-col xl:flex-row flex-1 min-h-0">
              {/* Left: Full track list */}
              <div className="w-full xl:w-1/2 flex flex-col min-w-0 xl:border-r border-gray-700">
                <div className="flex-1 min-w-0 overflow-y-auto">
                  <JamTracksView
                    jamTracks={jamTracks}
                    currentJamTrack={currentJamTrack}
                    onJamTrackSelect={handleJamTrackSelect}
                    onJamTrackUpdate={handleJamTrackUpdate}
                    onJamTrackComplete={handleJamTrackComplete}
                    onJamTrackFavorite={handleJamTrackFavorite}
                    onJamTrackDelete={handleJamTrackDelete}
                    onPdfUpload={handleJamTrackPdfUpload}
                    onPdfDelete={handleJamTrackPdfDelete}
                    onUpload={handleJamTrackUpload}
                    isUploading={isUploadingJamTracks}
                    onYouTubeImport={handleYouTubeImport}
                    isImportingFromYouTube={isImportingFromYouTube}
                    onPsarcImport={handlePsarcImport}
                    isImportingPsarc={isImportingPsarc}
                  />
                </div>
              </div>

              {/* Right: Empty state */}
              <div className="hidden xl:flex xl:w-1/2 flex-col items-center justify-center bg-gray-900 text-gray-500">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  <p className="text-lg">Select a jam track to get started</p>
                </div>
              </div>
            </div>
          ) : (
            /* Compact layout when track selected */
            <div className="flex flex-col h-full overflow-hidden">
              {/* Top: Compact selector - Desktop only */}
              <div className="hidden xl:block shrink-0">
                <JamTrackCompactSelector
                  jamTracks={jamTracks}
                  currentJamTrack={currentJamTrack}
                  onJamTrackSelect={handleJamTrackSelect}
                  onJamTrackUpdate={handleJamTrackUpdate}
                  onUpload={handleJamTrackUpload}
                  isUploading={isUploadingJamTracks}
                  onYouTubeImport={handleYouTubeImport}
                  isImportingFromYouTube={isImportingFromYouTube}
                  onPsarcImport={handlePsarcImport}
                  isImportingPsarc={isImportingPsarc}
                />
              </div>

              {/* Mobile: Keep full JamTracksView */}
              <div className="xl:hidden flex-1 overflow-y-auto">
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
                  onPsarcImport={handlePsarcImport}
                  isImportingPsarc={isImportingPsarc}
                />
              </div>

              {/* Middle: PDF Viewer + Markers Sidebar - Desktop */}
              <div className="hidden xl:flex flex-1 min-h-0 overflow-hidden" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                {/* PDF Viewer - Left side */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  {currentJamTrack.pdfs.length > 0 ? (
                    <>
                      {(() => {
                        const activePdf = currentJamTrack.pdfs.find(p => p.id === activePdfId) || currentJamTrack.pdfs[0];
                        return activePdf ? (
                          <PageSyncEditor
                            pdfId={activePdf.id}
                            pdfName={activePdf.name}
                            syncPoints={activePdf.pageSyncPoints ?? []}
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
                          pdfs={sortPdfs(currentJamTrack.pdfs)}
                          currentAudioTime={currentAudioTime}
                          audioIsPlaying={audioIsPlaying}
                          onActivePdfChange={handleActivePdfChange}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center bg-gray-900 text-gray-500">
                      <div className="text-center">
                        <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-lg">No tabs or sheets available for this track</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Markers Sidebar - Right side */}
                {markerBarState && (
                  <div className="w-80 border-l border-gray-700 bg-gray-900 flex flex-col overflow-hidden">
                    <MarkersBar
                      markers={currentJamTrack.markers}
                      visible={true}
                      leadIn={markerBarState.leadIn}
                      editingMarkerId={markerBarState.editingMarkerId}
                      editingMarkerName={markerBarState.editingMarkerName}
                      currentTime={markerBarState.currentTime}
                      onLeadInChange={markerBarState.setLeadIn}
                      onAddMarker={markerBarState.addMarker}
                      onJumpToMarker={markerBarState.jumpToMarker}
                      onStartEdit={(id, name) => {
                        markerBarState.setEditingMarkerId(id);
                        markerBarState.setEditingMarkerName(name);
                      }}
                      onEditNameChange={markerBarState.setEditingMarkerName}
                      onSaveEdit={(markerId, name) => {
                        handleJamTrackMarkerRename(currentJamTrack.id, markerId, name);
                        markerBarState.setEditingMarkerId(null);
                      }}
                      onCancelEdit={() => markerBarState.setEditingMarkerId(null)}
                      onDelete={(markerId) => handleJamTrackMarkerDelete(currentJamTrack.id, markerId)}
                      onClearAll={() => handleJamTrackMarkersClear(currentJamTrack.id)}
                      formatTime={markerBarState.formatTime}
                      isCountingIn={markerBarState.isCountingIn}
                      currentCountInBeat={markerBarState.currentCountInBeat}
                      totalCountInBeats={markerBarState.totalCountInBeats}
                      trackTempo={markerBarState.trackTempo}
                      trackTimeSignature={markerBarState.trackTimeSignature}
                      onTempoChange={handleTempoChange}
                      hasPdf={false}
                    />
                  </div>
                )}
              </div>

              {/* Bottom: Compact Player - Desktop */}
              <div className="hidden xl:block shrink-0">
                <BottomPlayer
                  track={currentJamTrack}
                  compact={true}
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

              {/* Mobile: Keep existing player at full size */}
              <div className={`xl:hidden shrink-0 overflow-hidden transition-all duration-300 ${currentJamTrack ? "h-[30vh] min-h-55 max-h-80" : "h-0"}`}>
                <BottomPlayer
                  track={currentJamTrack}
                  compact={false}
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
          )}

          {/* Mobile Bottom Navigation - unchanged */}
          <div className="xl:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-30">
            <div className="flex">
              <button
                className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 ${mobileView === 'library' ? 'text-blue-400' : 'text-gray-400'}`}
                onClick={() => setMobileView('library')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
                </svg>
                <span className="text-xs">Tracks</span>
              </button>
              <button
                className={`flex-1 flex flex-col items-center py-3 gap-1 ${mobileView === 'player' ? 'text-blue-400' : 'text-gray-400'} ${!currentJamTrack ? 'opacity-50' : ''}`}
                onClick={() => currentJamTrack && setMobileView('player')}
                disabled={!currentJamTrack}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
                <span className="text-xs">Player</span>
              </button>
              <button
                className={`flex-1 flex flex-col items-center py-3 gap-1 ${mobileView === 'pdf' ? 'text-blue-400' : 'text-gray-400'} ${!currentJamTrack || !currentJamTrack.pdfs.length ? 'opacity-50' : ''}`}
                onClick={() => currentJamTrack && currentJamTrack.pdfs.length > 0 && setMobileView('pdf')}
                disabled={!currentJamTrack || !currentJamTrack.pdfs.length}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs">Tabs</span>
              </button>
            </div>
          </div>
        </>
      ) : activeSection === 'videos' ? (
        <Videos initialVideoId={searchParams.get('video')} />
      ) : activeSection === 'tools' ? (
        <Tools />
      ) : activeSection === 'circle' ? (
        <CircleOfFifths />
      ) : activeSection === 'intervals' ? (
        <IntervalExplorer />
      ) : activeSection === 'chords' ? (
        <ChordBuilder />
      ) : activeSection === 'tabs' ? (
        <TabEditor />
      ) : activeSection === 'metrics' ? (
        <MetricsView onGoToTrack={handleGoToTrackFromMetrics} />
      ) : (
        <Fretboard />
      )}

      {/* Video Upload Modal */}
      <VideoUploadModal
        isOpen={isVideoUploadModalOpen}
        onClose={() => {
          setIsVideoUploadModalOpen(false);
          setPendingVideoFiles([]);
        }}
        onUpload={handleBulkVideoUpload}
        authors={authors}
        initialFiles={pendingVideoFiles}
      />
    </div>
  );
}
