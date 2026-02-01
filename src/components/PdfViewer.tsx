"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (err: Error) => {
    setError(err.message);
    setIsLoading(false);
  };

  // Scroll to page when currentPage prop changes
  useEffect(() => {
    if (currentPage && currentPage !== visiblePage && numPages > 0) {
      const pageEl = pageRefs.current.get(currentPage);
      if (pageEl && containerRef.current) {
        isScrollingToPage.current = true;
        pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
        setVisiblePage(currentPage);
        // Reset the flag after scroll completes
        setTimeout(() => {
          isScrollingToPage.current = false;
        }, 500);
      }
    }
  }, [currentPage, numPages]);

  // Track visible page on scroll
  const handleScroll = useCallback(() => {
    if (isScrollingToPage.current || !containerRef.current) return;

    const container = containerRef.current;
    const containerTop = container.scrollTop;
    const containerHeight = container.clientHeight;

    let closestPage = 1;
    let closestDistance = Infinity;

    pageRefs.current.forEach((el, pageNum) => {
      const rect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const pageTop = rect.top - containerRect.top + containerTop;
      const pageCenter = pageTop + rect.height / 2;
      const viewCenter = containerTop + containerHeight / 2;
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

  const goToPage = (page: number) => {
    const clampedPage = Math.max(1, Math.min(numPages || 1, page));
    const pageEl = pageRefs.current.get(clampedPage);
    if (pageEl) {
      isScrollingToPage.current = true;
      pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
      setVisiblePage(clampedPage);
      onPageChange(clampedPage);
      setTimeout(() => {
        isScrollingToPage.current = false;
      }, 500);
    }
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
          file={`/api/pdf/${encodeURIComponent(pdfPath)}${version ? `?v=${version}` : ''}`}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading=""
          className="flex flex-col items-center gap-4"
        >
          {containerWidth > 0 &&
            Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <div
                key={pageNum}
                ref={(el) => {
                  if (el) pageRefs.current.set(pageNum, el);
                }}
              >
                <Page
                  pageNumber={pageNum}
                  width={containerWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="shadow-lg"
                />
              </div>
            ))}
        </Document>
      </div>
    </div>
  );
}
