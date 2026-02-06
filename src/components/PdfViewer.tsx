"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";

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
if (typeof window !== "undefined") {
  import("react-pdf").then((pdfjs) => {
    pdfjs.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.pdfjs.version}/build/pdf.worker.min.mjs`;
  });
}

interface PdfViewerProps {
  pdfPath: string;
  currentPage: number;
  onPageChange: (page: number) => void;
  version?: number; // Cache-busting version
}

// Only render pages within this distance from the visible page
const PAGE_BUFFER = 2; // Renders current page ± 2 pages (5 total)
const ESTIMATED_PAGE_HEIGHT = 1100; // Fallback height for unrendered pages

export default function PdfViewer({
  pdfPath,
  currentPage,
  onPageChange,
  version = 0,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [visiblePage, setVisiblePage] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const isScrollingToPage = useRef(false);
  const targetPage = useRef<number | null>(null);
  const pageHeights = useRef<Map<number, number>>(new Map());

  // Stable URL that busts cache when pdfPath or version changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pdfUrl = useMemo(() => `/api/pdf/${encodeURIComponent(pdfPath)}?v=${Date.now()}`, [pdfPath, version]);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth - 16); // Account for padding
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
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

      // Then scroll once the page is rendered (may need a small delay)
      const scrollToPage = () => {
        const pageEl = pageRefs.current.get(currentPage);
        if (pageEl && containerRef.current) {
          isScrollingToPage.current = true;
          targetPage.current = currentPage;
          pageEl.scrollIntoView({ behavior: "auto", block: "start" }); // Use instant scroll to avoid timing issues
          setTimeout(() => {
            isScrollingToPage.current = false;
            targetPage.current = null;
          }, 300); // Shorter timeout since instant scroll completes immediately
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

  const goToPage = (page: number) => {
    const clampedPage = Math.max(1, Math.min(numPages || 1, page));

    // Update visiblePage first to render the target page
    setVisiblePage(clampedPage);
    onPageChange(clampedPage);

    // Then scroll to it once rendered
    const scrollToPage = () => {
      const pageEl = pageRefs.current.get(clampedPage);
      if (pageEl) {
        isScrollingToPage.current = true;
        targetPage.current = clampedPage;
        pageEl.scrollIntoView({ behavior: "auto", block: "start" }); // Use instant scroll to avoid timing issues
        setTimeout(() => {
          isScrollingToPage.current = false;
          targetPage.current = null;
        }, 300); // Shorter timeout since instant scroll completes immediately
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
      <div className="flex items-center px-3 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-1 text-xs">
          <input
            type="number"
            min={1}
            max={numPages || 1}
            value={visiblePage}
            onChange={(e) => goToPage(parseInt(e.target.value, 10) || 1)}
            className="w-12 px-1 py-1 bg-gray-700 border border-gray-600 rounded text-center text-xs focus:outline-none focus:border-green-500"
          />
          <span className="text-gray-400">/ {numPages}</span>
        </div>
      </div>

      {/* PDF Display - Scrollable */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-2"
        onScroll={handleScroll}
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
          className="flex flex-col items-center gap-4"
        >
          {containerWidth > 0 &&
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
            })}
        </Document>
      </div>
    </div>
  );
}
