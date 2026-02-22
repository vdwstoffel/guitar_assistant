"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { PageSyncPoint } from "@/types";
import AlphaTexViewer from "@/components/AlphaTexViewer";

// Dynamically import react-pdf to avoid SSR issues
const Document = dynamic(
  () => import("react-pdf").then((mod) => mod.Document),
  { ssr: false }
);

const Page = dynamic(
  () => import("react-pdf").then((mod) => mod.Page),
  { ssr: false }
);

// Configure PDF.js worker on client side only
// Worker is served locally from public/ to work offline and in Docker environments
if (typeof window !== "undefined") {
  import("react-pdf").then((pdfjs) => {
    pdfjs.pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  });
}

interface SinglePdfViewerProps {
  pdfPath: string;
  currentPage: number;
  onPageChange: (page: number) => void;
  version?: number;
}

interface MultiPdfViewerProps {
  pdfs: {
    id: string;
    name: string;
    filePath: string;
    fileType?: string;
    pageSyncPoints: PageSyncPoint[];
  }[];
  currentAudioTime: number;
  audioIsPlaying: boolean;
  onActivePdfChange?: (pdfId: string, page: number) => void;
  syncEditMode?: boolean;
  version?: number;
}

// Only render pages within this distance from the visible page
const PAGE_BUFFER = 2; // Renders current page ± 2 pages (5 total)
const ESTIMATED_PAGE_HEIGHT = 1100; // Fallback height for unrendered pages

// ─── Internal Single PDF Viewer ───────────────────────────────────────

function SinglePdfViewerInner({
  pdfPath,
  currentPage,
  onPageChange,
  version = 0,
}: SinglePdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const [fitToPage, setFitToPage] = useState(false);
  const [visiblePage, setVisiblePage] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const isScrollingToPage = useRef(false);
  const targetPage = useRef<number | null>(null);
  const pageHeights = useRef<Map<number, number>>(new Map());

  // Stable URL that busts cache when pdfPath or version changes
  const pdfUrl = useMemo(() => `/api/pdf/${encodeURIComponent(pdfPath)}?v=${version}`, [pdfPath, version]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      setContainerWidth(container.clientWidth - 16); // Account for padding
      setContainerHeight(container.clientHeight - 16);
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // Clear caches when PDF changes or component unmounts
  useEffect(() => {
    // Clear caches when switching to a new PDF
    pageHeights.current.clear();
    pageRefs.current.clear();

    // Copy refs to local variables for cleanup
    const heights = pageHeights.current;
    const refs = pageRefs.current;

    return () => {
      // Cleanup on unmount
      heights.clear();
      refs.clear();
    };
  }, [pdfPath]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setError(null);
    // Clear stale page heights from previous PDF
    pageHeights.current.clear();
  };

  const onDocumentLoadError = (err: Error) => {
    setError(err.message);
    setIsLoading(false);
    // Clear page heights on error
    pageHeights.current.clear();
  };

  // Scroll to page when currentPage prop changes
  useEffect(() => {
    if (currentPage && currentPage !== visiblePage && numPages > 0) {
      // Update visiblePage first to trigger re-render with target page in buffer
      setVisiblePage(currentPage);

      // In fit-to-page mode, just updating visiblePage is enough
      if (fitToPage) return;

      let scrollAttempts = 0;
      const maxScrollAttempts = 5;

      // Then scroll once the page is rendered (may need a small delay)
      const scrollToPage = () => {
        const pageEl = pageRefs.current.get(currentPage);
        if (pageEl && containerRef.current) {
          isScrollingToPage.current = true;
          targetPage.current = currentPage;
          pageEl.scrollIntoView({ behavior: "auto", block: "start" });
          scrollAttempts++;

          // After initial scroll, verify and correct position once page fully renders
          // This handles layout shifts when placeholder height differs from actual page height
          const verifyScroll = () => {
            const el = pageRefs.current.get(currentPage);
            if (el && containerRef.current) {
              const containerRect = containerRef.current.getBoundingClientRect();
              const pageRect = el.getBoundingClientRect();
              // If page top is not near container top, scroll again
              const offset = pageRect.top - containerRect.top;
              if (Math.abs(offset) > 10 && scrollAttempts < maxScrollAttempts) {
                el.scrollIntoView({ behavior: "auto", block: "start" });
                scrollAttempts++;
                setTimeout(verifyScroll, 50);
              } else {
                isScrollingToPage.current = false;
                targetPage.current = null;
              }
            } else {
              isScrollingToPage.current = false;
              targetPage.current = null;
            }
          };

          // Wait for render to complete before verifying
          setTimeout(verifyScroll, 100);
        } else {
          // If page not yet rendered, try again shortly
          setTimeout(scrollToPage, 100);
        }
      };

      // Small delay to allow React to render the new pages
      setTimeout(scrollToPage, 0);
    }
  }, [currentPage, numPages, visiblePage, onPageChange]);

  // Track visible page on scroll (debounced for performance)
  const handleScrollInternal = useCallback(() => {
    if (isScrollingToPage.current || !containerRef.current) return;

    // Don't update if we're targeting a specific page (prevents detecting intermediate pages during smooth scroll)
    if (targetPage.current !== null) return;

    const container = containerRef.current;
    const containerTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const viewCenter = containerTop + containerHeight / 2;

    let closestPage = 1;
    let closestDistance = Infinity;

    // Cache container rect to avoid repeated getBoundingClientRect calls
    const containerRect = container.getBoundingClientRect();

    pageRefs.current.forEach((el, pageNum) => {
      const rect = el.getBoundingClientRect();
      const pageTop = rect.top - containerRect.top + containerTop;
      const pageCenter = pageTop + rect.height / 2;
      const distance = Math.abs(pageCenter - viewCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestPage = pageNum;
      }
    });

    if (closestPage !== visiblePage) {
      setVisiblePage(closestPage);
      onPageChange(closestPage);
    }
  }, [visiblePage, onPageChange]);

  // Debounced scroll handler to reduce DOM queries
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      handleScrollInternal();
    }, 100); // 100ms debounce
  }, [handleScrollInternal]);

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // When switching from fit-to-page back to scroll mode, scroll to the current page
  const prevFitToPage = useRef(fitToPage);
  useEffect(() => {
    if (prevFitToPage.current && !fitToPage && visiblePage > 1) {
      // Small delay to let scroll-mode DOM render the pages
      const scrollToCurrentPage = () => {
        const pageEl = pageRefs.current.get(visiblePage);
        if (pageEl) {
          pageEl.scrollIntoView({ behavior: "auto", block: "start" });
        } else {
          setTimeout(scrollToCurrentPage, 100);
        }
      };
      setTimeout(scrollToCurrentPage, 50);
    }
    prevFitToPage.current = fitToPage;
  }, [fitToPage, visiblePage]);

  // Wheel navigation in fit-to-page mode
  const wheelCooldown = useRef(false);
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!fitToPage || wheelCooldown.current || numPages <= 1) return;

      const newPage = e.deltaY > 0 ? visiblePage + 1 : visiblePage - 1;
      if (newPage < 1 || newPage > numPages) return;

      wheelCooldown.current = true;
      setVisiblePage(newPage);
      onPageChange(newPage);

      setTimeout(() => {
        wheelCooldown.current = false;
      }, 300);
    },
    [fitToPage, visiblePage, numPages, onPageChange]
  );

  const goToPage = (page: number) => {
    const clampedPage = Math.max(1, Math.min(numPages || 1, page));

    // Update visiblePage first to render the target page
    setVisiblePage(clampedPage);
    onPageChange(clampedPage);

    // In fit-to-page mode, just changing visiblePage is enough (no scrolling needed)
    if (fitToPage) return;

    let scrollAttempts = 0;
    const maxScrollAttempts = 5;

    // Then scroll to it once rendered
    const scrollToPage = () => {
      const pageEl = pageRefs.current.get(clampedPage);
      if (pageEl && containerRef.current) {
        isScrollingToPage.current = true;
        targetPage.current = clampedPage;
        pageEl.scrollIntoView({ behavior: "auto", block: "start" });
        scrollAttempts++;

        // Verify and correct position once page fully renders
        const verifyScroll = () => {
          const el = pageRefs.current.get(clampedPage);
          if (el && containerRef.current) {
            const containerRect = containerRef.current.getBoundingClientRect();
            const pageRect = el.getBoundingClientRect();
            const offset = pageRect.top - containerRect.top;
            if (Math.abs(offset) > 10 && scrollAttempts < maxScrollAttempts) {
              el.scrollIntoView({ behavior: "auto", block: "start" });
              scrollAttempts++;
              setTimeout(verifyScroll, 50);
            } else {
              isScrollingToPage.current = false;
              targetPage.current = null;
            }
          } else {
            isScrollingToPage.current = false;
            targetPage.current = null;
          }
        };

        setTimeout(verifyScroll, 100);
      } else {
        // Retry if not yet rendered
        setTimeout(scrollToPage, 100);
      }
    };

    setTimeout(scrollToPage, 0);
  };

  // Calculate which pages should be rendered (visible page ± buffer)
  const getPageRange = () => {
    const startPage = Math.max(1, visiblePage - PAGE_BUFFER);
    const endPage = Math.min(numPages, visiblePage + PAGE_BUFFER);
    return { startPage, endPage };
  };

  const shouldRenderPage = (pageNum: number) => {
    const { startPage, endPage } = getPageRange();
    return pageNum >= startPage && pageNum <= endPage;
  };

  // Get placeholder height for unrendered pages
  const getPlaceholderHeight = (pageNum: number) => {
    // Use actual height if we've rendered this page before
    if (pageHeights.current.has(pageNum)) {
      return pageHeights.current.get(pageNum);
    }
    // Otherwise use estimated height
    return ESTIMATED_PAGE_HEIGHT;
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Controls */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-1 text-xs">
          {fitToPage && (
            <button
              onClick={() => goToPage(visiblePage - 1)}
              disabled={visiblePage <= 1}
              className="px-1.5 py-1 bg-gray-700 border border-gray-600 rounded text-gray-300 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          <input
            type="number"
            min={1}
            max={numPages || 1}
            value={visiblePage}
            onChange={(e) => goToPage(parseInt(e.target.value, 10) || 1)}
            className="w-12 px-1 py-1 bg-gray-700 border border-gray-600 rounded text-center text-xs focus:outline-none focus:border-green-500"
          />
          <span className="text-gray-400">/ {numPages}</span>
          {fitToPage && (
            <button
              onClick={() => goToPage(visiblePage + 1)}
              disabled={visiblePage >= numPages}
              className="px-1.5 py-1 bg-gray-700 border border-gray-600 rounded text-gray-300 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          )}
        </div>
        <button
          onClick={() => setFitToPage(!fitToPage)}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
            fitToPage
              ? "bg-green-600/30 text-green-400 hover:bg-green-600/40"
              : "bg-gray-700 text-gray-400 hover:bg-gray-600"
          }`}
          title={fitToPage ? "Fit to page (click for scroll mode)" : "Scroll mode (click for fit to page)"}
        >
          {fitToPage ? (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v18M15 3v18M3 9h18M3 15h18" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h10M7 16h10" />
            </svg>
          )}
          {fitToPage ? "Fit Page" : "Scroll"}
        </button>
      </div>

      {/* PDF Display */}
      <div
        ref={containerRef}
        className={`flex-1 p-2 ${fitToPage ? "overflow-hidden flex items-center justify-center" : "overflow-auto"}`}
        onScroll={!fitToPage ? handleScroll : undefined}
        onWheel={fitToPage ? handleWheel : undefined}
      >
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <span className="text-gray-500 text-sm">Loading PDF...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full text-red-400 text-sm">
            <span>Error: {error}</span>
          </div>
        )}

        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading=""
          className={fitToPage ? "flex items-center justify-center" : "flex flex-col items-center gap-4"}
        >
          {fitToPage ? (
            /* Fit-to-page mode: render only the current page, scaled to fit container height */
            containerHeight > 0 && (
              <Page
                pageNumber={visiblePage}
                height={containerHeight}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="shadow-lg"
              />
            )
          ) : (
            /* Scroll mode: render pages with virtual scrolling */
            containerWidth > 0 &&
              Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
                const shouldRender = shouldRenderPage(pageNum);

                return (
                  <div
                    key={pageNum}
                    ref={(el) => {
                      if (el) {
                        pageRefs.current.set(pageNum, el);
                        // Track actual page height when rendered
                        if (shouldRender && el.offsetHeight > 0) {
                          pageHeights.current.set(pageNum, el.offsetHeight);
                        }
                      } else {
                        // Clean up refs for unmounted pages
                        pageRefs.current.delete(pageNum);
                      }
                    }}
                    style={
                      !shouldRender
                        ? {
                            minHeight: `${getPlaceholderHeight(pageNum)}px`,
                            width: containerWidth,
                          }
                        : undefined
                    }
                    className={!shouldRender ? "bg-gray-800 flex items-center justify-center" : ""}
                  >
                    {shouldRender ? (
                      <Page
                        pageNumber={pageNum}
                        width={containerWidth}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        className="shadow-lg"
                      />
                    ) : (
                      <span className="text-gray-600 text-sm">Page {pageNum}</span>
                    )}
                  </div>
                );
              })
          )}
        </Document>
      </div>
    </div>
  );
}

// ─── Multi-PDF Viewer with Tabs and Page Sync ─────────────────────────

function MultiPdfViewer({
  pdfs,
  currentAudioTime,
  audioIsPlaying,
  onActivePdfChange,
  syncEditMode = false,
  version = 0,
}: MultiPdfViewerProps) {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [autoPageFlip, setAutoPageFlip] = useState(true);
  const lastAutoFlipPage = useRef<number>(0);
  const prevPdfsIdRef = useRef<string>("");

  const activePdf = pdfs[activeTabIndex];
  const syncPoints = activePdf?.pageSyncPoints || [];

  // Reset tab index when the jam track changes (pdfs array identity changes)
  const pdfsId = pdfs.map(p => p.id).join(",");
  useEffect(() => {
    if (pdfsId !== prevPdfsIdRef.current) {
      prevPdfsIdRef.current = pdfsId;
      setActiveTabIndex(0);
      setCurrentPage(1);
      lastAutoFlipPage.current = 0;
    }
  }, [pdfsId]);

  // Auto page-flip logic
  useEffect(() => {
    if (!autoPageFlip || !audioIsPlaying || syncEditMode || syncPoints.length === 0) return;

    const sorted = [...syncPoints].sort((a, b) => a.timeInSeconds - b.timeInSeconds);

    // Find the sync point with largest timeInSeconds <= currentAudioTime
    let targetPage: number | null = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (currentAudioTime >= sorted[i].timeInSeconds) {
        targetPage = sorted[i].pageNumber;
        break;
      }
    }

    if (targetPage !== null && targetPage !== lastAutoFlipPage.current) {
      lastAutoFlipPage.current = targetPage;
      setCurrentPage(targetPage);
    }
  }, [currentAudioTime, audioIsPlaying, syncEditMode, syncPoints, autoPageFlip]);

  // Notify parent of active PDF and page changes
  useEffect(() => {
    if (onActivePdfChange && activePdf) {
      onActivePdfChange(activePdf.id, currentPage);
    }
  }, [activePdf?.id, currentPage, onActivePdfChange]);

  const handleTabChange = (index: number) => {
    setActiveTabIndex(index);
    setCurrentPage(1);
    lastAutoFlipPage.current = 0;
  };

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  if (pdfs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900 text-gray-500">
        <p>No PDFs available for this jam track</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Tab Bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border-b border-gray-700 overflow-x-auto">
        {pdfs.map((pdf, index) => (
          <button
            key={pdf.id}
            onClick={() => handleTabChange(index)}
            className={`px-3 py-1.5 text-sm rounded transition-colors whitespace-nowrap ${
              index === activeTabIndex
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            {pdf.name}
          </button>
        ))}

        {/* Auto page-flip toggle */}
        {syncPoints.length > 0 && (
          <button
            onClick={() => setAutoPageFlip(!autoPageFlip)}
            className={`ml-auto flex items-center gap-1 px-2 py-1.5 text-xs rounded transition-colors ${
              autoPageFlip
                ? "bg-green-600/30 text-green-400 hover:bg-green-600/40"
                : "bg-gray-700 text-gray-500 hover:bg-gray-600"
            }`}
            title={autoPageFlip ? "Auto page-flip is ON" : "Auto page-flip is OFF"}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Sync
          </button>
        )}
      </div>

      {/* Content Viewer - branches on fileType */}
      <div className="flex-1 min-h-0">
        {activePdf.fileType === "alphatex" ? (
          <AlphaTexViewer
            filePath={activePdf.filePath}
            currentAudioTime={currentAudioTime}
            audioIsPlaying={audioIsPlaying}
          />
        ) : (
          <SinglePdfViewerInner
            pdfPath={activePdf.filePath}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            version={version}
          />
        )}
      </div>
    </div>
  );
}

// ─── Exported PdfViewer (dispatches based on props) ───────────────────

type PdfViewerProps =
  | (SinglePdfViewerProps & { pdfs?: undefined })
  | (MultiPdfViewerProps & { pdfPath?: undefined; currentPage?: undefined; onPageChange?: undefined });

export default function PdfViewer(props: PdfViewerProps) {
  if ("pdfPath" in props && props.pdfPath) {
    return (
      <SinglePdfViewerInner
        pdfPath={props.pdfPath}
        currentPage={props.currentPage}
        onPageChange={props.onPageChange}
        version={props.version}
      />
    );
  }

  if ("pdfs" in props && props.pdfs) {
    return (
      <MultiPdfViewer
        pdfs={props.pdfs}
        currentAudioTime={props.currentAudioTime}
        audioIsPlaying={props.audioIsPlaying}
        onActivePdfChange={props.onActivePdfChange}
        syncEditMode={props.syncEditMode}
        version={props.version}
      />
    );
  }

  return (
    <div className="h-full flex items-center justify-center bg-gray-900 text-gray-500">
      <p>No PDF to display</p>
    </div>
  );
}
