"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import BookGrid from "@/components/BookGrid";
import TrackListView from "@/components/TrackListView";
import JamTrackList from "@/components/JamTrackList";
import JamTrackPdfPanel from "@/components/JamTrackPdfPanel";
import BottomPlayer from "@/components/BottomPlayer";
import TrackListRail from "@/components/practice/TrackListRail";
import PageFlipDialog from "@/components/PageFlipDialog";
import TopNav from "@/components/TopNav";
import Fretboard from "@/components/Fretboard";
import CircleOfFifths from "@/components/CircleOfFifths";
import ChordBuilder from "@/components/ChordBuilder";

import PdfViewer from "@/components/PdfViewer";
import Videos from "@/components/Videos";
import RecordingsView from "@/components/RecordingsView";
import Tools from "@/components/Tools";
import CAGEDSystem from "@/components/CAGEDSystem";
import HomeView from "@/components/HomeView";
import UploadModal from "@/components/UploadModal";
import VideoPlayer from "@/components/VideoPlayer";
import { AuthorSummary, BookSummary, Book, Track, TrackTab, Marker, JamTrack, JamTrackMarker, BookVideo, BookVideoMarker, SearchResultTrack, SearchResultBook, SearchResultJamTrack, SavedLoop, JamTrackLoop } from "@/types";
import TrackTabsModal from "@/components/TrackTabsModal";
import { resolvePageFlip } from "@/lib/pageFlips";
import { shouldCollapseOnPlay, usesFloatingLayout } from "@/lib/practiceLayout";
import { useIsWideViewport } from "@/hooks/useIsWideViewport";

type Section = 'home' | 'lessons' | 'videos' | 'fretboard' | 'chords' | 'tools' | 'circle' | 'jamtracks' | 'recordings' | 'caged';

const getSectionFromPath = (section: string[] | undefined): Section => {
  if (!section || section.length === 0) return 'home';
  const first = section[0];
  if (first === 'home' || first === 'lessons' || first === 'videos' || first === 'fretboard' || first === 'chords' || first === 'tools' || first === 'circle' || first === 'jamtracks' || first === 'recordings' || first === 'caged') {
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

  const nowPlaying = useMemo<{ id: string; name: string } | null>(() => {
    if (currentTrack) return { id: currentTrack.id, name: currentTrack.title };
    if (currentJamTrack) return { id: currentJamTrack.id, name: currentJamTrack.title };
    return null;
  }, [currentTrack, currentJamTrack]);

  const [isScanning, setIsScanning] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingJamTracks, setIsUploadingJamTracks] = useState(false);
  const [isImportingFromYouTube, setIsImportingFromYouTube] = useState(false);
  const [extractingVideoId, setExtractingVideoId] = useState<string | null>(null);
  const [pageFlipAnticipation, setPageFlipAnticipation] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("pageFlipAnticipation");
      return stored === null ? true : stored === "true";
    }
    return true;
  });
  const handlePageFlipAnticipationChange = useCallback((value: boolean) => {
    setPageFlipAnticipation(value);
    localStorage.setItem("pageFlipAnticipation", String(value));
  }, []);

  // Flatten all books from all authors for the library grid
  const allBooks = useMemo(() =>
    authors.flatMap((author) =>
      author.books.map((book) => ({ book, author }))
    ),
    [authors]
  );
  const [tabsTrack, setTabsTrack] = useState<Track | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
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
  // Reported by PdfViewer. Scroll mode is width-bound, so it gets a bigger
  // share of the split; fit-to-page is height-bound and gains nothing from it.
  const [isFitToPage, setIsFitToPage] = useState(true);
  const listPaneWidth = isFitToPage ? "xl:w-1/2" : "xl:w-1/3";

  // Practice layout: the track list yields to the PDF once playback starts.
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const isWideViewport = useIsWideViewport();

  // Audio time state (used for page sync)
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const [audioIsPlaying, setAudioIsPlaying] = useState(false);
  const seekFnRef = useRef<((time: number) => void) | null>(null);
  const lastAutoFlipPage = useRef<number | null>(null);

  // Page-flip dialog state (editFlipId is set when editing an existing flip)
  const [pageFlipDialog, setPageFlipDialog] = useState<{ open: boolean; timestamp: number; defaultPage: number; editFlipId?: string } | null>(null);

  // Mobile responsive state
  const [mobileView, setMobileView] = useState<'library' | 'player' | 'pdf'>('library');

  // Active PDF tab state for the JamTrackPdfPanel
  const [activeJamPdfId, setActiveJamPdfId] = useState<string | null>(null);
  // Keep the active PDF valid: preserve the selection when it still exists
  // (uploads/renames), else fall back to the first PDF (track change or the
  // active PDF being deleted).
  useEffect(() => {
    const pdfs = currentJamTrack?.pdfs ?? [];
    setActiveJamPdfId((prev) =>
      prev && pdfs.some((p) => p.id === prev) ? prev : (pdfs[0]?.id ?? null)
    );
  }, [currentJamTrack?.id, currentJamTrack?.pdfs]);

  // Refs for stable BottomPlayer callbacks (avoids new function references every render)
  const currentJamTrackRef = useRef(currentJamTrack);
  currentJamTrackRef.current = currentJamTrack;
  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;

  // Get active section from URL path
  const activeSection = getSectionFromPath(params.section as string[] | undefined);

  // Floating only earns its keep with a PDF filling the panel beside the list.
  const isFloatingPractice = activeSection === 'lessons' && usesFloatingLayout({
    isWideViewport,
    hasPdf: !!pdfPath && !!selectedBookId,
    isShowingVideo: !!(selectedVideo && showVideo),
  });
  const isJamFloating = activeSection === 'jamtracks' && usesFloatingLayout({
    isWideViewport,
    hasPdf: (currentJamTrack?.pdfs?.length ?? 0) > 0,
    isShowingVideo: false,
  });
  const isPracticeCollapsed = isFloatingPractice && isListCollapsed;
  const isJamCollapsed = isJamFloating && isListCollapsed;

  // While practising the player becomes a column beside the PDF; the PDF then
  // renders narrower, so more of the page fits on screen at once.
  const isPracticeSidebar = isPracticeCollapsed && !!(currentTrack || currentJamTrack);
  const isJamSidebar = isJamCollapsed && !!currentJamTrack;

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

  const returnToBookGrid = () => {
    setSelectedBookId(null);
    setSelectedBookDetail(null);
    setCurrentTrack(null);
    setCurrentAuthorId(null);
    setCurrentBookId(null);
    updateLibraryUrl(null, null);
  };

  const handleSectionChange = (section: Section) => {
    window.dispatchEvent(new Event('practiceSessionFlush'));
    if (section === 'lessons') {
      // Clicking Lessons returns to the book grid rather than sitting in
      // whichever book happened to be open.
      returnToBookGrid();
    } else {
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

  // Restore selection from URL params on cross-section navigation
  // (router.push updates searchParams, but the initial-load effect won't re-run)
  const prevSearchParamsRef = useRef<string>('');
  useEffect(() => {
    const paramsStr = searchParams.toString();
    // Skip initial render (handled by fetchLibrary(true) above)
    if (!prevSearchParamsRef.current) {
      prevSearchParamsRef.current = paramsStr;
      return;
    }
    // Skip if params didn't actually change
    if (paramsStr === prevSearchParamsRef.current) return;
    prevSearchParamsRef.current = paramsStr;

    const bookId = searchParams.get('album');
    const trackId = searchParams.get('track');
    const videoId = searchParams.get('video');

    if (bookId && authors.length > 0) {
      // Find the book's author from already-loaded library data
      let foundAuthor: AuthorSummary | null = null;
      let foundBook: BookSummary | null = null;
      for (const author of authors) {
        const book = author.books.find((b: BookSummary) => b.id === bookId);
        if (book) {
          foundAuthor = author;
          foundBook = book;
          break;
        }
      }
      if (foundAuthor && foundBook) {
        setSelectedAuthorId(foundAuthor.id);
        setSelectedBookId(bookId);
        setCurrentJamTrackId(null);
        if (foundBook.pdfPath) {
          setPdfPath(foundBook.pdfPath);
        }
        fetchBookDetail(bookId).then((bookDetail) => {
          if (!bookDetail) return;
          if (videoId) {
            const video = bookDetail.videos?.find((v: BookVideo) => v.id === videoId)
              ?? bookDetail.chapters?.flatMap((ch: { videos: BookVideo[] }) => ch.videos).find((v: BookVideo) => v.id === videoId);
            if (video) handleVideoSelect(video);
          } else if (trackId) {
            const track = bookDetail.tracks?.find((t: Track) => t.id === trackId)
              ?? bookDetail.chapters?.flatMap((ch: { tracks: Track[] }) => ch.tracks).find((t: Track) => t.id === trackId);
            if (track) {
              setCurrentTrack(track);
              setCurrentAuthorId(foundAuthor!.id);
              setCurrentBookId(bookId);
              if (track.pdfPage) {
                lastAutoFlipPage.current = track.pdfPage;
                setPdfPage(track.pdfPage);
              }
            }
          }
        });
      }
    }

    // Handle jam track navigation
    if (activeSection === 'jamtracks' && trackId) {
      const jamTrack = jamTracks.find((jt: JamTrack) => jt.id === trackId);
      if (jamTrack) {
        handleJamTrackSelect(jamTrack);
      }
    }
  }, [searchParams]);

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

  const handleUpload = async (files: FileList, authorName?: string, bookName?: string) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      if (authorName) formData.append("authorName", authorName);
      if (bookName) formData.append("bookName", bookName);

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

  const handlePdfBookUpload = async (file: File, authorName: string, bookName: string) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("authorName", authorName);
      formData.append("bookName", bookName);

      const response = await fetch("/api/books/upload-pdf", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        await fetchLibrary();
      }
    } catch (error) {
      console.error("Error uploading PDF book:", error);
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
    setShowVideo(false);
    if (selectedBookDetail?.pdfPath) {
      setPdfPath(selectedBookDetail.pdfPath);
    }
    // Always reset to track's initial PDF page on selection (including re-select)
    if (track.pdfPage) {
      lastAutoFlipPage.current = track.pdfPage;
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

    if (bookId) {
      const params = new URLSearchParams();
      if (authorId) params.set('artist', authorId);
      params.set('album', bookId);
      if (trackId) params.set('track', trackId);
      if (bookVideoId) params.set('video', bookVideoId);
      router.push(`/lessons?${params.toString()}`);
    }
  };

  const handleJamTrackSelect = async (jamTrack: JamTrack) => {
    setCurrentJamTrackId(jamTrack.id);
    setCurrentTrack(null);
    setCurrentAuthorId(null);
    setCurrentBookId(null);

    updateJamTrackUrl(jamTrack.id);
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
      pdfPath: result.pdfPath, inProgress: false, trackCount: 0, coverTrackPath: null, customCoverPath: null,
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
  ) => {
    const isJamTrack = jamTracks.some(jt => jt.id === trackId);
    try {
      if (isJamTrack) {
        const response = await fetch(`/api/jamtracks/${trackId}/markers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, timestamp }),
        });
        if (response.ok) {
          const newMarker: JamTrackMarker = await response.json();
          setJamTracks(prev =>
            prev.map(jt => jt.id === trackId ? { ...jt, markers: [...jt.markers, newMarker] } : jt)
          );
        }
        return;
      }
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

  const findJamTrackForMarker = (markerId: string): JamTrack | undefined =>
    jamTracks.find(jt => jt.markers.some(m => m.id === markerId));

  const handleMarkerUpdate = async (markerId: string, timestamp: number) => {
    const owningJamTrack = findJamTrackForMarker(markerId);
    try {
      if (owningJamTrack) {
        const response = await fetch(`/api/jamtracks/${owningJamTrack.id}/markers/${markerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timestamp }),
        });
        if (response.ok) {
          setJamTracks(prev => prev.map(jt =>
            jt.id === owningJamTrack.id
              ? { ...jt, markers: jt.markers.map(m => m.id === markerId ? { ...m, timestamp } : m) }
              : jt
          ));
        }
        return;
      }
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
    const owningJamTrack = findJamTrackForMarker(markerId);
    try {
      if (owningJamTrack) {
        const response = await fetch(`/api/jamtracks/${owningJamTrack.id}/markers/${markerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (response.ok) {
          setJamTracks(prev => prev.map(jt =>
            jt.id === owningJamTrack.id
              ? { ...jt, markers: jt.markers.map(m => m.id === markerId ? { ...m, name } : m) }
              : jt
          ));
        }
        return;
      }
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
    const owningJamTrack = findJamTrackForMarker(markerId);
    try {
      if (owningJamTrack) {
        const response = await fetch(`/api/jamtracks/${owningJamTrack.id}/markers/${markerId}`, {
          method: "DELETE",
        });
        if (response.ok) {
          setJamTracks(prev => prev.map(jt =>
            jt.id === owningJamTrack.id
              ? { ...jt, markers: jt.markers.filter(m => m.id !== markerId) }
              : jt
          ));
        }
        return;
      }
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
    const isJamTrack = jamTracks.some(jt => jt.id === trackId);
    try {
      if (isJamTrack) {
        const response = await fetch(`/api/jamtracks/${trackId}/markers/clear`, {
          method: "DELETE",
        });
        if (response.ok) {
          setJamTracks(prev => prev.map(jt =>
            jt.id === trackId ? { ...jt, markers: [] } : jt
          ));
        }
        return;
      }
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

  const handleLoopSave = async (
    trackId: string,
    name: string,
    startTime: number,
    endTime: number
  ) => {
    const isJamTrack = jamTracks.some(jt => jt.id === trackId);
    try {
      if (isJamTrack) {
        const response = await fetch(`/api/jamtracks/${trackId}/loops`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, startTime, endTime }),
        });
        if (response.ok) {
          const newLoop: JamTrackLoop = await response.json();
          setJamTracks(prev =>
            prev.map(jt => jt.id === trackId ? { ...jt, loops: [...jt.loops, newLoop] } : jt)
          );
        }
        return;
      }
      const response = await fetch("/api/loops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, name, startTime, endTime }),
      });
      if (response.ok) {
        const newLoop: SavedLoop = await response.json();
        setCurrentTrack(prev =>
          prev?.id === trackId ? { ...prev, loops: [...prev.loops, newLoop] } : prev
        );
        updateTrackInBookDetail(trackId, t => ({ ...t, loops: [...t.loops, newLoop] }));
      }
    } catch (error) {
      console.error("Error saving loop:", error);
    }
  };

  const findJamTrackForLoop = (loopId: string): JamTrack | undefined =>
    jamTracks.find(jt => jt.loops.some(l => l.id === loopId));

  const handleLoopDelete = async (loopId: string) => {
    const owningJamTrack = findJamTrackForLoop(loopId);
    try {
      if (owningJamTrack) {
        const response = await fetch(`/api/jamtracks/${owningJamTrack.id}/loops/${loopId}`, {
          method: "DELETE",
        });
        if (response.ok) {
          setJamTracks(prev => prev.map(jt =>
            jt.id === owningJamTrack.id
              ? { ...jt, loops: jt.loops.filter(l => l.id !== loopId) }
              : jt
          ));
        }
        return;
      }
      const response = await fetch(`/api/loops/${loopId}`, { method: "DELETE" });
      if (response.ok) {
        const removeLoop = (loops: SavedLoop[]) => loops.filter(l => l.id !== loopId);
        setCurrentTrack(prev =>
          prev ? { ...prev, loops: removeLoop(prev.loops) } : prev
        );
        updateTrackInBookDetail(currentTrack?.id || '', t => ({ ...t, loops: removeLoop(t.loops) }));
      }
    } catch (error) {
      console.error("Error deleting loop:", error);
    }
  };

  const updateVideoInBookDetail = useCallback(
    (videoId: string, updater: (video: BookVideo) => BookVideo) => {
      setSelectedBookDetail(prev => {
        if (!prev) return prev;
        const newVideos = prev.videos?.map(v => (v.id === videoId ? updater(v) : v));
        let chaptersChanged = false;
        const newChapters = prev.chapters?.map(ch => {
          if (!ch.videos?.some(v => v.id === videoId)) return ch;
          chaptersChanged = true;
          return { ...ch, videos: ch.videos.map(v => (v.id === videoId ? updater(v) : v)) };
        });
        return {
          ...prev,
          videos: newVideos,
          ...(chaptersChanged ? { chapters: newChapters } : {}),
        };
      });
    },
    []
  );

  const applyVideoMarkers = (
    videoId: string,
    updater: (markers: BookVideoMarker[]) => BookVideoMarker[]
  ) => {
    setSelectedVideo(prev =>
      prev?.id === videoId ? { ...prev, markers: updater(prev.markers ?? []) } : prev
    );
    updateVideoInBookDetail(videoId, v => ({ ...v, markers: updater(v.markers ?? []) }));
  };

  // The player PATCHes the volume itself (debounced); this only keeps the
  // in-memory copies in step so switching videos and back doesn't re-apply a
  // stale value.
  const handleVideoVolumeChange = (videoId: string, volume: number) => {
    setSelectedVideo(prev => (prev?.id === videoId ? { ...prev, volume } : prev));
    updateVideoInBookDetail(videoId, v => ({ ...v, volume }));
  };

  const handleVideoPlaybackSpeedChange = (videoId: string, playbackSpeed: number) => {
    setSelectedVideo(prev => (prev?.id === videoId ? { ...prev, playbackSpeed } : prev));
    updateVideoInBookDetail(videoId, v => ({ ...v, playbackSpeed }));
  };

  const handleVideoMarkerAdd = async (
    bookId: string,
    videoId: string,
    name: string,
    timestamp: number
  ) => {
    try {
      const response = await fetch(`/api/books/${bookId}/videos/${videoId}/markers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, timestamp }),
      });
      if (response.ok) {
        const newMarker: BookVideoMarker = await response.json();
        applyVideoMarkers(videoId, markers => [...markers, newMarker]);
      }
    } catch (error) {
      console.error("Error adding video marker:", error);
    }
  };

  const handleVideoMarkerRename = async (
    bookId: string,
    videoId: string,
    markerId: string,
    name: string
  ) => {
    try {
      const response = await fetch(
        `/api/books/${bookId}/videos/${videoId}/markers/${markerId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }
      );
      if (response.ok) {
        applyVideoMarkers(videoId, markers =>
          markers.map(m => (m.id === markerId ? { ...m, name } : m))
        );
      }
    } catch (error) {
      console.error("Error renaming video marker:", error);
    }
  };

  const handleVideoMarkerDelete = async (
    bookId: string,
    videoId: string,
    markerId: string
  ) => {
    try {
      const response = await fetch(
        `/api/books/${bookId}/videos/${videoId}/markers/${markerId}`,
        { method: "DELETE" }
      );
      if (response.ok) {
        applyVideoMarkers(videoId, markers => markers.filter(m => m.id !== markerId));
      }
    } catch (error) {
      console.error("Error deleting video marker:", error);
    }
  };

  const handleVideoMarkersClear = async (bookId: string, videoId: string) => {
    try {
      const response = await fetch(
        `/api/books/${bookId}/videos/${videoId}/markers/clear`,
        { method: "DELETE" }
      );
      if (response.ok) {
        applyVideoMarkers(videoId, () => []);
      }
    } catch (error) {
      console.error("Error clearing video markers:", error);
    }
  };

  const handleTabCreate = async (
    trackId: string,
    name: string,
    alphatex: string | null,
    tempo: number
  ) => {
    const res = await fetch(`/api/tracks/${trackId}/tabs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, alphatex, tempo }),
    });
    const tab = await res.json();
    updateTrackInBookDetail(trackId, t => ({ ...t, tabs: [...(t.tabs ?? []), tab] }));
    setCurrentTrack(prev =>
      prev?.id === trackId ? { ...prev, tabs: [...(prev.tabs ?? []), tab] } : prev
    );
    return tab;
  };

  const handleTabUpdate = async (tabId: string, updates: { name?: string; alphatex?: string | null; tempo?: number }) => {
    await fetch(`/api/tracks/${currentTrack?.id}/tabs/${tabId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const applyUpdate = (tabs: TrackTab[]) =>
      tabs.map(t => (t.id === tabId ? { ...t, ...updates } : t));
    if (currentTrack) {
      updateTrackInBookDetail(currentTrack.id, t => ({ ...t, tabs: applyUpdate(t.tabs ?? []) }));
      setCurrentTrack(prev =>
        prev ? { ...prev, tabs: applyUpdate(prev.tabs ?? []) } : prev
      );
    }
  };

  const handleTabDelete = async (tabId: string) => {
    await fetch(`/api/tracks/${currentTrack?.id}/tabs/${tabId}`, {
      method: "DELETE",
    });
    const removeTab = (tabs: TrackTab[]) => tabs.filter(t => t.id !== tabId);
    if (currentTrack) {
      updateTrackInBookDetail(currentTrack.id, t => ({ ...t, tabs: removeTab(t.tabs ?? []) }));
      setCurrentTrack(prev =>
        prev ? { ...prev, tabs: removeTab(prev.tabs ?? []) } : prev
      );
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
    if (currentJamTrack) {
      try {
        const response = await fetch(`/api/jamtracks/${currentJamTrack.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tempo, timeSignature }),
        });

        if (!response.ok) {
          throw new Error("Failed to update jam track tempo");
        }

        setJamTracks(prev => prev.map(jt =>
          jt.id === currentJamTrack.id ? { ...jt, tempo, timeSignature } : jt
        ));
      } catch (error) {
        console.error("Error updating jam track tempo:", error);
      }
      return;
    }

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

  const handleBookDelete = async (bookId: string) => {
    const response = await fetch(`/api/books/${bookId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Failed to delete book");
    }

    // Clear selection if the deleted book was selected
    if (selectedBookId === bookId) {
      setSelectedBookId(null);
      setSelectedBookDetail(null);
    }

    await fetchLibrary();
  };

  const handleBookResetProgress = async (bookId: string) => {
    const response = await fetch(`/api/books/${bookId}/reset-progress`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Failed to reset book progress");
    }

    await fetchLibrary();
    // Refresh book detail so the track/video rows drop their status badges
    if (selectedBookId === bookId) {
      const detailRes = await fetch(`/api/books/${bookId}/detail`);
      if (detailRes.ok) {
        setSelectedBookDetail(await detailRes.json());
      }
    }
  };

  const handleCoverUpload = async (bookId: string, file: File) => {
    const formData = new FormData();
    formData.append("cover", file);
    const response = await fetch(`/api/books/${bookId}/cover`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      throw new Error("Failed to upload cover");
    }
    await fetchLibrary();
    // Refresh book detail if currently viewing this book
    if (selectedBookId === bookId) {
      const detailRes = await fetch(`/api/books/${bookId}/detail`);
      if (detailRes.ok) {
        setSelectedBookDetail(await detailRes.json());
      }
    }
  };

  const handleCoverUploadFromUrl = async (bookId: string, url: string) => {
    const response = await fetch(`/api/books/${bookId}/cover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error || "Failed to upload cover from URL");
    }
    await fetchLibrary();
    if (selectedBookId === bookId) {
      const detailRes = await fetch(`/api/books/${bookId}/detail`);
      if (detailRes.ok) {
        setSelectedBookDetail(await detailRes.json());
      }
    }
  };

  const handleCoverDelete = async (bookId: string) => {
    const response = await fetch(`/api/books/${bookId}/cover`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("Failed to delete cover");
    }
    await fetchLibrary();
    if (selectedBookId === bookId) {
      const detailRes = await fetch(`/api/books/${bookId}/detail`);
      if (detailRes.ok) {
        setSelectedBookDetail(await detailRes.json());
      }
    }
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
      prev?.id === trackId ? { ...prev, completed, inProgress: completed ? false : prev?.inProgress ?? false } : prev
    );
    updateTrackInBookDetail(trackId, t => ({ ...t, completed, inProgress: completed ? false : t.inProgress }));

    // If linked to a video, refresh book detail to pick up synced video status
    const track = selectedBookDetail?.tracks.find(t => t.id === trackId)
      || selectedBookDetail?.chapters?.flatMap(ch => ch.tracks).find(t => t.id === trackId);
    if (track?.sourceVideoId && selectedBookDetail) {
      fetchBookDetail(selectedBookDetail.id);
      fetchLibrary();
    }
  };

  const handleTrackInProgress = async (trackId: string, inProgress: boolean) => {
    const response = await fetch(`/api/tracks/${trackId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inProgress }),
    });

    if (!response.ok) {
      throw new Error("Failed to update track in-progress status");
    }

    setCurrentTrack(prev =>
      prev?.id === trackId ? { ...prev, inProgress, completed: inProgress ? false : prev?.completed ?? false } : prev
    );
    updateTrackInBookDetail(trackId, t => ({ ...t, inProgress, completed: inProgress ? false : t.completed }));

    // If linked to a video, refresh book detail to pick up synced video status
    const track = selectedBookDetail?.tracks.find(t => t.id === trackId)
      || selectedBookDetail?.chapters?.flatMap(ch => ch.tracks).find(t => t.id === trackId);
    if (track?.sourceVideoId && selectedBookDetail) {
      fetchBookDetail(selectedBookDetail.id);
      fetchLibrary();
    }
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

  const handleTrackNotesUpdate = async (trackId: string, notes: string | null) => {
    const response = await fetch(`/api/tracks/${trackId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });

    if (!response.ok) {
      throw new Error("Failed to update track notes");
    }

    setCurrentTrack(prev =>
      prev?.id === trackId ? { ...prev, notes } : prev
    );
    updateTrackInBookDetail(trackId, t => ({ ...t, notes }));
  };

  const handleVideoNotesUpdate = async (bookId: string, videoId: string, notes: string | null) => {
    const video = selectedBookDetail?.videos?.find(v => v.id === videoId)
      || selectedBookDetail?.chapters?.flatMap(ch => ch.videos).find(v => v.id === videoId);
    if (!video) return;

    const response = await fetch(`/api/books/${bookId}/videos/${videoId}/update`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: video.filename, sortOrder: video.sortOrder, notes }),
    });

    if (response.ok) {
      await fetchBookDetail(bookId);
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

  const handleAudioUploadForBook = async (bookId: string, files: FileList) => {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }
    try {
      const response = await fetch(`/api/books/${bookId}/tracks`, {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        await fetchLibrary();
      }
    } catch (error) {
      console.error("Error uploading audio for book:", error);
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

    // Refresh book detail to pick up synced track status
    if (video.extractedTrackId) {
      fetchBookDetail(bookId);
    }
  };

  const handleVideoInProgress = async (bookId: string, videoId: string, inProgress: boolean) => {
    const video = selectedBookDetail?.videos?.find(v => v.id === videoId)
      || selectedBookDetail?.chapters?.flatMap(ch => ch.videos).find(v => v.id === videoId);
    if (!video) return;

    const response = await fetch(`/api/books/${bookId}/videos/${videoId}/update`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: video.filename, sortOrder: video.sortOrder, inProgress }),
    });

    if (response.ok) {
      await fetchLibrary();
      // Refresh book detail to pick up synced track status
      if (video.extractedTrackId) {
        fetchBookDetail(bookId);
      }
    }
  };

  const handleExtractAudio = async (video: BookVideo) => {
    if (extractingVideoId) return;
    setExtractingVideoId(video.id);
    try {
      const response = await fetch(
        `/api/books/${video.bookId}/videos/${video.id}/extract-audio`,
        { method: "POST" }
      );
      const data = await response.json();
      if (response.ok) {
        await fetchLibrary();
        // Refresh book detail to pick up the new track with sourceVideoId link
        fetchBookDetail(video.bookId);
      } else {
        alert(data.error || "Failed to extract audio");
      }
    } catch (error) {
      console.error("Error extracting audio:", error);
      alert("Failed to extract audio from video");
    } finally {
      setExtractingVideoId(null);
    }
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
      prev.map((jt) => (jt.id === jamTrackId ? { ...jt, completed, inProgress: completed ? false : jt.inProgress } : jt))
    );
  };

  const handleJamTrackInProgress = async (jamTrackId: string, inProgress: boolean) => {
    const response = await fetch(`/api/jamtracks/${jamTrackId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inProgress }),
    });

    if (!response.ok) {
      throw new Error("Failed to update jam track in-progress status");
    }

    // Update local state
    setJamTracks((prev) =>
      prev.map((jt) => (jt.id === jamTrackId ? { ...jt, inProgress, completed: inProgress ? false : jt.completed } : jt))
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

  // Refetch the current jam track after PDF add/rename/delete
  const refreshCurrentJamTrack = useCallback(async () => {
    if (!currentJamTrackRef.current) return;
    const res = await fetch(`/api/jamtracks/${currentJamTrackRef.current.id}`);
    if (res.ok) {
      const updated = await res.json();
      setJamTracks((prev) => prev.map((jt) => (jt.id === updated.id ? updated : jt)));
    }
  }, []);

  // Refetch the current track (incl. pageFlips) after a page-flip is added/deleted
  const refreshCurrentTrack = useCallback(async () => {
    const track = currentTrackRef.current;
    if (!track) return;
    const bookId = track.bookId;
    const res = await fetch(`/api/books/${bookId}/detail`);
    if (res.ok) {
      const bookData = await res.json();
      // Find the refreshed track in the book data
      const allTracks: Track[] = [
        ...(bookData.tracks ?? []),
        ...(bookData.chapters ?? []).flatMap((ch: { tracks: Track[] }) => ch.tracks),
      ];
      const refreshed = allTracks.find((t) => t.id === track.id);
      if (refreshed) {
        setCurrentTrack(refreshed);
        updateTrackInBookDetail(refreshed.id, () => refreshed);
      }
    }
  }, [updateTrackInBookDetail]);

  // Refs for handler functions so useCallback wrappers stay stable.
  // Handlers internally branch on whether the target is a track or jam track.
  const handleMarkerAddRef = useRef(handleMarkerAdd);
  handleMarkerAddRef.current = handleMarkerAdd;
  const handleMarkerUpdateRef = useRef(handleMarkerUpdate);
  handleMarkerUpdateRef.current = handleMarkerUpdate;
  const handleMarkerRenameRef = useRef(handleMarkerRename);
  handleMarkerRenameRef.current = handleMarkerRename;
  const handleMarkerDeleteRef = useRef(handleMarkerDelete);
  handleMarkerDeleteRef.current = handleMarkerDelete;
  const handleMarkersClearRef = useRef(handleMarkersClear);
  handleMarkersClearRef.current = handleMarkersClear;

  const stableOnMarkerAdd = useCallback((trackId: string, name: string, timestamp: number) => {
    handleMarkerAddRef.current(trackId, name, timestamp);
  }, []);

  const stableOnMarkerUpdate = useCallback((markerId: string, timestamp: number) => {
    handleMarkerUpdateRef.current(markerId, timestamp);
  }, []);

  const stableOnMarkerRename = useCallback((markerId: string, name: string) => {
    handleMarkerRenameRef.current(markerId, name);
  }, []);

  const stableOnMarkerDelete = useCallback((markerId: string) => {
    handleMarkerDeleteRef.current(markerId);
  }, []);

  const stableOnMarkersClear = useCallback((trackId: string) => {
    handleMarkersClearRef.current(trackId);
  }, []);

  const handleLoopSaveRef = useRef(handleLoopSave);
  handleLoopSaveRef.current = handleLoopSave;
  const handleLoopDeleteRef = useRef(handleLoopDelete);
  handleLoopDeleteRef.current = handleLoopDelete;

  const stableOnLoopSave = useCallback(
    (trackId: string, name: string, startTime: number, endTime: number) => {
      handleLoopSaveRef.current(trackId, name, startTime, endTime);
    },
    []
  );

  const stableOnLoopDelete = useCallback((loopId: string) => {
    handleLoopDeleteRef.current(loopId);
  }, []);

  // Page-flip save/delete handlers (stable via refs)
  const activeJamPdfIdRef = useRef(activeJamPdfId);
  activeJamPdfIdRef.current = activeJamPdfId;
  const refreshCurrentJamTrackRef = useRef(refreshCurrentJamTrack);
  refreshCurrentJamTrackRef.current = refreshCurrentJamTrack;
  const refreshCurrentTrackRef = useRef(refreshCurrentTrack);
  refreshCurrentTrackRef.current = refreshCurrentTrack;

  const savePageFlip = useCallback(async (page: number, timestamp: number, editFlipId?: string) => {
    try {
      if (activeSection === "jamtracks" && activeJamPdfIdRef.current && currentJamTrackRef.current) {
        const base = `/api/jamtracks/${currentJamTrackRef.current.id}/pdf/${activeJamPdfIdRef.current}/pageflips`;
        if (editFlipId) {
          await fetch(`${base}/${editFlipId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pdfPage: page }),
          });
        } else {
          await fetch(base, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timestamp, pdfPage: page }),
          });
        }
        await refreshCurrentJamTrackRef.current();
      } else if (currentTrackRef.current) {
        const base = `/api/tracks/${currentTrackRef.current.id}/pageflips`;
        if (editFlipId) {
          await fetch(`${base}/${editFlipId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pdfPage: page }),
          });
        } else {
          await fetch(base, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timestamp, pdfPage: page }),
          });
        }
        await refreshCurrentTrackRef.current();
      }
    } catch (err) {
      console.error("Failed to save page flip:", err);
    }
  }, [activeSection]);

  const handlePageFlipDelete = useCallback(async (id: string) => {
    try {
      // Determine if we're in jamtracks or lessons
      if (activeSection === "jamtracks" && currentJamTrackRef.current && activeJamPdfIdRef.current) {
        await fetch(
          `/api/jamtracks/${currentJamTrackRef.current.id}/pdf/${activeJamPdfIdRef.current}/pageflips/${id}`,
          { method: "DELETE" }
        );
        await refreshCurrentJamTrackRef.current();
      } else if (currentTrackRef.current) {
        await fetch(`/api/tracks/${currentTrackRef.current.id}/pageflips/${id}`, {
          method: "DELETE",
        });
        await refreshCurrentTrackRef.current();
      }
    } catch (err) {
      console.error("Failed to delete page flip:", err);
    }
  }, [activeSection]);

  const stableOnTimeUpdate = useCallback((time: number, playing: boolean) => {
    setCurrentAudioTime(time);
    setAudioIsPlaying(playing);
  }, []);

  const stableOnSeekReady = useCallback((seekFn: (time: number) => void) => {
    seekFnRef.current = seekFn;
  }, []);

  // Reset page flip tracking when track/jamtrack/activePdf changes
  const prevTrackIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentTrack?.id !== prevTrackIdRef.current) {
      lastAutoFlipPage.current = null;
      prevTrackIdRef.current = currentTrack?.id ?? null;
      // Immediately navigate to track's initial pdfPage on selection
      if (currentTrack?.pdfPage) {
        setPdfPage(currentTrack.pdfPage);
        lastAutoFlipPage.current = currentTrack.pdfPage;
      }
    }
  }, [currentTrack?.id, currentTrack?.pdfPage]);

  // Reset page-flip tracking when the jam track or active PDF changes, and
  // start a freshly-selected jam track / PDF at page 1 so auto page-flips have
  // a clean baseline to advance from (otherwise a stale pdfPage can make a
  // flip to the same page a no-op).
  useEffect(() => {
    lastAutoFlipPage.current = null;
    if (currentJamTrackId) {
      setPdfPage(1);
    }
  }, [currentJamTrackId, activeJamPdfId]);

  // Auto-flip PDF page using resolvePageFlip — works for both Lessons and Jam Tracks
  useEffect(() => {
    const flips =
      activeSection === "jamtracks"
        ? (currentJamTrack?.pdfs?.find((p) => p.id === activeJamPdfId)?.pageFlips ?? [])
        : (currentTrack?.pageFlips ?? []);
    if (flips.length === 0) return;
    // Baseline page before the first flip: jam-track PDFs start at page 1
    // (so restarting the song snaps back to page 1 instead of the last page);
    // lesson tracks fall back to their designated starting pdfPage.
    const fallback =
      activeSection === "jamtracks" ? 1 : (currentTrack?.pdfPage ?? null);
    const target = resolvePageFlip(flips, currentAudioTime, pageFlipAnticipation ? 1 : 0, fallback);
    if (target != null && target !== lastAutoFlipPage.current) {
      lastAutoFlipPage.current = target;
      setPdfPage(target);
    }
  }, [activeSection, currentTrack?.id, currentJamTrack?.id, activeJamPdfId, currentAudioTime, pageFlipAnticipation, currentTrack?.pageFlips, currentJamTrack?.pdfs]);

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

  // Starting playback collapses the track list. Pausing deliberately does not
  // expand it again — only an explicit click on the rail does.
  useEffect(() => {
    if (!isFloatingPractice && !isJamFloating) return;
    setIsListCollapsed((prev) => shouldCollapseOnPlay(prev, audioIsPlaying));
  }, [isFloatingPractice, isJamFloating, audioIsPlaying]);

  // Browsing to another book or section should show the list again.
  useEffect(() => {
    setIsListCollapsed(false);
  }, [selectedBookId, activeSection]);


  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Top Navigation */}
      <TopNav
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onSearchTrackSelect={handleSearchTrackSelect}
        onSearchBookSelect={handleSearchBookSelect}
        onSearchJamTrackSelect={handleSearchJamTrackSelect}
        onGoToTrack={handleGoToTrackFromMetrics}
        nowPlaying={nowPlaying}
      />

      {/* Section Content */}
      {activeSection === 'home' ? (
        <HomeView onGoToTrack={handleGoToTrackFromMetrics} authors={authors} />
      ) : activeSection === 'lessons' ? (
        <>
          {/* Practice area. The panes sit on top; the player either docks
              beneath them or floats over the PDF while practising. */}
          <div className="flex-1 min-h-0 flex flex-col relative">
            <div className="flex flex-col xl:flex-row flex-1 min-h-0">
              {/* Left: track list, or the rail it collapses to */}
              {isPracticeCollapsed ? (
                <TrackListRail
                  trackName={currentTrack?.title ?? currentJamTrack?.title ?? null}
                  onExpand={() => setIsListCollapsed(false)}
                />
              ) : (
                <div className={`w-full ${selectedBookId ? `${listPaneWidth} xl:border-r border-gray-700` : ''} flex flex-col min-w-0`}>
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
                      onBack={returnToBookGrid}
                      onBookUpdate={handleBookUpdate}
                      onCoverUpload={handleCoverUpload}
                      onCoverUploadFromUrl={handleCoverUploadFromUrl}
                      onCoverDelete={handleCoverDelete}
                      onBookDelete={handleBookDelete}
                      onBookResetProgress={handleBookResetProgress}
                      onTrackUpdate={handleMetadataUpdate}
                      onTrackComplete={handleTrackComplete}
                      onTrackInProgress={handleTrackInProgress}
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
                      onVideoInProgress={handleVideoInProgress}
                      onTrackNotesUpdate={handleTrackNotesUpdate}
                      onVideoNotesUpdate={handleVideoNotesUpdate}
                      onAudioUpload={handleAudioUploadForBook}
                      onLibraryRefresh={fetchLibrary}
                      onExtractAudio={handleExtractAudio}
                      extractingVideoId={extractingVideoId}
                    />
                  ) : (
                    <BookGrid
                      books={allBooks}
                      onBookSelect={handleBookSelect}
                      onScan={handleScan}
                      onUploadClick={() => setIsUploadModalOpen(true)}
                      isScanning={isScanning}
                      isUploading={isUploading}
                    />
                  )}
                  </div>
                </div>
              )}

              {/* Reserves the practice sidebar's width. The player is absolutely
                  positioned over this so it never changes DOM parent — moving it
                  would remount the audio and restart playback. */}
              {isPracticeSidebar && (
                <div className="hidden xl:block w-[344px] shrink-0" aria-hidden="true" />
              )}

              {/* PDF/Video Panel - hidden below xl and when no book is selected */}
              <div className={`${selectedBookId ? 'hidden xl:flex xl:flex-1' : 'hidden'} flex-col min-w-0`}>
                {selectedVideo && showVideo ? (
                  /* Video Player - Full Height */
                  <div className="flex-1 overflow-hidden">
                    <VideoPlayer
                      video={selectedVideo}
                      markers={selectedVideo.markers ?? []}
                      onAddMarker={(name, timestamp) =>
                        handleVideoMarkerAdd(selectedVideo.bookId, selectedVideo.id, name, timestamp)
                      }
                      onRenameMarker={(markerId, name) =>
                        handleVideoMarkerRename(selectedVideo.bookId, selectedVideo.id, markerId, name)
                      }
                      onDeleteMarker={(markerId) =>
                        handleVideoMarkerDelete(selectedVideo.bookId, selectedVideo.id, markerId)
                      }
                      onClearMarkers={() =>
                        handleVideoMarkersClear(selectedVideo.bookId, selectedVideo.id)
                      }
                      onVolumeChange={(volume) =>
                        handleVideoVolumeChange(selectedVideo.id, volume)
                      }
                      onPlaybackSpeedChange={(speed) =>
                        handleVideoPlaybackSpeedChange(selectedVideo.id, speed)
                      }
                    />
                  </div>
              ) : pdfPath ? (
                <div className="flex-1 min-h-0">
                  <PdfViewer
                    pdfPath={pdfPath}
                    currentPage={pdfPage}
                    onPageChange={setPdfPage}
                    version={pdfVersion}
                    onFitToPageChange={setIsFitToPage}
                  />
                </div>
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

            {/* Player - a column beside the PDF while practising, a floating bar
                while browsing with a track loaded, docked otherwise */}
            <div
              className={
                isPracticeSidebar
                  ? "hidden xl:block absolute top-0 bottom-0 left-10 w-[344px] z-20"
                  : isFloatingPractice && (currentTrack || currentJamTrack)
                  ? `absolute bottom-0 right-0 z-20 ${isFitToPage ? "left-1/2" : "left-1/3"}`
                  : `shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
                      currentTrack || currentJamTrack ? "max-h-[70vh]" : "max-h-0"
                    }`
              }
            >
                <BottomPlayer
                  variant={isPracticeSidebar ? "sidebar" : isFloatingPractice ? "floating" : "docked"}
                  track={currentTrack || currentJamTrack}
                  onMarkerAdd={stableOnMarkerAdd}
                  onMarkerUpdate={stableOnMarkerUpdate}
                  onMarkerRename={stableOnMarkerRename}
                  onMarkerDelete={stableOnMarkerDelete}
                  onMarkersClear={stableOnMarkersClear}
                  onLoopSave={stableOnLoopSave}
                  onLoopDelete={stableOnLoopDelete}
                  onTimeUpdate={stableOnTimeUpdate}
                  onSeekReady={stableOnSeekReady}
                  onTrackTabs={currentTrack ? () => setTabsTrack(currentTrack) : undefined}
                  trackTabsCount={currentTrack?.tabs?.length ?? 0}
                  currentPdfPage={pdfPage}
                  onPageFlipAdd={(t, p) => setPageFlipDialog({ open: true, timestamp: t, defaultPage: p })}
                  pageFlips={currentTrack?.pageFlips ?? []}
                  onPageFlipEdit={(id) => {
                    const flip = currentTrack?.pageFlips?.find((f) => f.id === id);
                    if (flip) {
                      setPageFlipDialog({ open: true, timestamp: flip.timestamp, defaultPage: flip.pdfPage, editFlipId: id });
                    }
                  }}
                  onPageFlipDelete={handlePageFlipDelete}
                  onTempoChange={handleTempoChange}
                  pageFlipAnticipation={pageFlipAnticipation}
                  onPageFlipAnticipationChange={handlePageFlipAnticipationChange}
                />
            </div>
          </div>

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
                } ${!pdfPath ? 'opacity-50' : ''}`}
                onClick={() => pdfPath ? setMobileView('pdf') : null}
                disabled={!pdfPath}
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
        <div className="flex flex-col h-full overflow-hidden relative">
          <div className="flex flex-1 min-h-0">
            {/* Left: jam track list, or the rail it collapses to */}
            {isJamCollapsed ? (
              <TrackListRail
                trackName={currentJamTrack?.title ?? null}
                onExpand={() => setIsListCollapsed(false)}
              />
            ) : (
              <div className={`${isFitToPage ? "w-1/2" : "w-1/3"} flex flex-col min-h-0 border-r border-gray-700 overflow-y-auto`}>
                <JamTrackList
                  jamTracks={jamTracks}
                  currentJamTrackId={currentJamTrack?.id ?? null}
                  onSelect={(id) => {
                    const jt = jamTracks.find((t) => t.id === id);
                    if (jt) handleJamTrackSelect(jt);
                  }}
                  onUpload={handleJamTrackUpload}
                  isUploading={isUploadingJamTracks}
                  onYouTubeImport={handleYouTubeImport}
                  isImportingFromYouTube={isImportingFromYouTube}
                />
              </div>
            )}

            {/* Reserves the practice sidebar's width - see the lessons pane */}
            {isJamSidebar && (
              <div className="hidden xl:block w-[344px] shrink-0" aria-hidden="true" />
            )}

            {/* Right: PDF panel, fills top to bottom */}
            <div className="flex-1 min-w-0 min-h-0">
              {currentJamTrack ? (
                <JamTrackPdfPanel
                  jamTrackId={currentJamTrack.id}
                  pdfs={currentJamTrack.pdfs ?? []}
                  activePdfId={activeJamPdfId}
                  onActivePdfChange={setActiveJamPdfId}
                  currentPage={pdfPage}
                  onPageChange={setPdfPage}
                  onUploaded={refreshCurrentJamTrack}
                  onRenamed={refreshCurrentJamTrack}
                  onDeleted={refreshCurrentJamTrack}
                  onFitToPageChange={setIsFitToPage}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  Select a jam track to get started
                </div>
              )}
            </div>
          </div>

          {/* Player - floats over the sheets while practising, docks otherwise */}
          {currentJamTrack && (
            <div
              className={
                isJamSidebar
                  ? "hidden xl:block absolute top-0 bottom-0 left-10 w-[344px] z-20"
                  : isJamFloating
                  ? `absolute bottom-0 right-0 z-20 ${isFitToPage ? "left-1/2" : "left-1/3"}`
                  : "shrink-0 border-t border-gray-700"
              }
            >
                <BottomPlayer
                  variant={isJamSidebar ? "sidebar" : isJamFloating ? "floating" : "docked"}
                  compact={!isJamFloating && !isJamSidebar}
                  track={currentJamTrack}
                  onMarkerAdd={stableOnMarkerAdd}
                  onMarkerUpdate={stableOnMarkerUpdate}
                  onMarkerRename={stableOnMarkerRename}
                  onMarkerDelete={stableOnMarkerDelete}
                  onMarkersClear={stableOnMarkersClear}
                  onLoopSave={stableOnLoopSave}
                  onLoopDelete={stableOnLoopDelete}
                  onTimeUpdate={stableOnTimeUpdate}
                  onSeekReady={stableOnSeekReady}
                  currentPdfPage={pdfPage}
                  onPageFlipAdd={(t, p) => setPageFlipDialog({ open: true, timestamp: t, defaultPage: p })}
                  pageFlips={currentJamTrack.pdfs?.find((p) => p.id === activeJamPdfId)?.pageFlips ?? []}
                  onPageFlipEdit={(id) => {
                    const flip = currentJamTrack.pdfs?.find((p) => p.id === activeJamPdfId)?.pageFlips?.find((f) => f.id === id);
                    if (flip) {
                      setPageFlipDialog({ open: true, timestamp: flip.timestamp, defaultPage: flip.pdfPage, editFlipId: id });
                    }
                  }}
                  onPageFlipDelete={handlePageFlipDelete}
                  onTempoChange={handleTempoChange}
                  pageFlipAnticipation={pageFlipAnticipation}
                  onPageFlipAnticipationChange={handlePageFlipAnticipationChange}
                />
            </div>
          )}
        </div>

      ) : activeSection === 'videos' ? (
        <div className="flex-1 min-h-0">
          <Videos initialVideoId={searchParams.get('video')} />
        </div>
      ) : activeSection === 'recordings' ? (
        <RecordingsView />
      ) : activeSection === 'tools' ? (
        <Tools />
      ) : activeSection === 'circle' ? (
        <CircleOfFifths />
      ) : activeSection === 'chords' ? (
        <ChordBuilder />
      ) : activeSection === 'caged' ? (
        <CAGEDSystem />
      ) : (
        <Fretboard />
      )}

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onAudioUpload={handleUpload}
        onPdfBookUpload={handlePdfBookUpload}
        onVideoUpload={handleBulkVideoUpload}
        authors={authors}
      />

      {tabsTrack && (
        <TrackTabsModal
          track={tabsTrack}
          onClose={() => setTabsTrack(null)}
          onTabCreate={handleTabCreate}
          onTabUpdate={handleTabUpdate}
          onTabDelete={handleTabDelete}
        />
      )}

      {pageFlipDialog?.open && (
        <PageFlipDialog
          isOpen={pageFlipDialog.open}
          title={pageFlipDialog.editFlipId ? "Edit Page Flip" : "Add Page Flip"}
          timestamp={pageFlipDialog.timestamp}
          defaultPage={pageFlipDialog.defaultPage}
          formatTime={(seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, "0")}`;
          }}
          onSave={(page) => {
            const { timestamp, editFlipId } = pageFlipDialog;
            setPageFlipDialog(null);
            savePageFlip(page, timestamp, editFlipId);
          }}
          onCancel={() => setPageFlipDialog(null)}
          onDelete={
            pageFlipDialog.editFlipId
              ? () => {
                  const { editFlipId } = pageFlipDialog;
                  setPageFlipDialog(null);
                  if (editFlipId) handlePageFlipDelete(editFlipId);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
