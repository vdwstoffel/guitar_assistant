'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Author } from '@/types';

interface BookOption {
  bookId: string;
  bookName: string;
  authorName: string;
  hasPdf: boolean;
}

interface ImagePreview {
  file: File;
  url: string;
}

export default function Tools() {
  const [books, setBooks] = useState<BookOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // PDF Concatenation state
  const [selectedBookId, setSelectedBookId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Images to PDF state
  const [imgBookId, setImgBookId] = useState('');
  const [imgPreviews, setImgPreviews] = useState<ImagePreview[]>([]);
  const [imgIsProcessing, setImgIsProcessing] = useState(false);
  const [imgResult, setImgResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const imgFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchBooks();
  }, []);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      imgPreviews.forEach(p => URL.revokeObjectURL(p.url));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBooks = async () => {
    try {
      const res = await fetch('/api/library');
      const data = await res.json();
      const authors: Author[] = data.authors || [];
      const options: BookOption[] = [];
      for (const author of authors) {
        for (const book of author.books) {
          options.push({
            bookId: book.id,
            bookName: book.name,
            authorName: author.name,
            hasPdf: !!book.pdfPath,
          });
        }
      }
      options.sort((a, b) => {
        const authorCmp = a.authorName.localeCompare(b.authorName);
        if (authorCmp !== 0) return authorCmp;
        return a.bookName.localeCompare(b.bookName);
      });
      setBooks(options);
    } catch (err) {
      console.error('Failed to fetch books:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedBook = books.find(b => b.bookId === selectedBookId) || null;
  const imgSelectedBook = books.find(b => b.bookId === imgBookId) || null;

  // --- PDF Concatenation handlers ---
  const handleSubmit = async () => {
    if (!selectedBookId || !selectedFile) return;

    setIsProcessing(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('pdf', selectedFile);

      const endpoint = selectedBook?.hasPdf
        ? `/api/books/${selectedBookId}/pdf/concatenate`
        : `/api/books/${selectedBookId}/pdf`;

      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setResult({
          type: 'success',
          message: selectedBook?.hasPdf
            ? 'Pages appended successfully'
            : 'PDF uploaded successfully',
        });
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        await fetchBooks();
      } else {
        setResult({ type: 'error', message: data.error || 'Operation failed' });
      }
    } catch {
      setResult({ type: 'error', message: 'An unexpected error occurred' });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Images to PDF handlers ---
  const handleImgFilesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Revoke old URLs
    setImgPreviews(prev => {
      prev.forEach(p => URL.revokeObjectURL(p.url));
      return [];
    });

    // Sort by filename then create previews
    const sorted = files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const previews = sorted.map(file => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setImgPreviews(previews);
    setImgResult(null);
  }, []);

  const moveImage = useCallback((index: number, direction: -1 | 1) => {
    setImgPreviews(prev => {
      const next = [...prev];
      const targetIndex = index + direction;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }, []);

  const removeImage = useCallback((index: number) => {
    setImgPreviews(prev => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleImgSubmit = async () => {
    if (!imgBookId || imgPreviews.length === 0) return;

    setImgIsProcessing(true);
    setImgResult(null);

    try {
      const formData = new FormData();
      formData.append('bookId', imgBookId);

      // Append images in the current (user-arranged) order
      for (const { file } of imgPreviews) {
        formData.append('images', file);
      }

      const res = await fetch('/api/tools/images-to-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setImgResult({ type: 'success', message: data.message });
        imgPreviews.forEach(p => URL.revokeObjectURL(p.url));
        setImgPreviews([]);
        if (imgFileInputRef.current) imgFileInputRef.current.value = '';
        await fetchBooks();
      } else {
        setImgResult({ type: 'error', message: data.error || 'Conversion failed' });
      }
    } catch {
      setImgResult({ type: 'error', message: 'An unexpected error occurred' });
    } finally {
      setImgIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-white">Tools</h1>

        {/* Images to PDF Card */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-2">Images to PDF</h2>
          <p className="text-gray-400 text-sm mb-6">
            Convert scanned images (JPG, PNG) into a PDF and assign it to a book.
            If the book already has a PDF, the new pages will be appended.
          </p>

          {isLoading ? (
            <p className="text-gray-400 text-sm">Loading books...</p>
          ) : books.length === 0 ? (
            <p className="text-gray-400 text-sm">No books found. Upload some audio files first to create books.</p>
          ) : (
            <div className="space-y-4">
              {/* Book Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Book</label>
                <select
                  value={imgBookId}
                  onChange={(e) => { setImgBookId(e.target.value); setImgResult(null); }}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select a book...</option>
                  {books.map((b) => (
                    <option key={b.bookId} value={b.bookId}>
                      {b.authorName} — {b.bookName} {b.hasPdf ? '(has PDF)' : '(no PDF)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Image File Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Images</label>
                <input
                  ref={imgFileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  multiple
                  onChange={handleImgFilesChange}
                  className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-700 file:text-white hover:file:bg-gray-600 file:cursor-pointer"
                />
              </div>

              {/* Image Previews with Reorder */}
              {imgPreviews.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Page Order ({imgPreviews.length} image{imgPreviews.length !== 1 ? 's' : ''})
                  </label>
                  <div className="space-y-1 max-h-72 overflow-y-auto">
                    {imgPreviews.map((item, index) => (
                      <div key={item.url} className="flex items-center gap-2 bg-gray-700 rounded p-2">
                        <img src={item.url} alt="" className="w-10 h-14 object-cover rounded shrink-0" />
                        <span className="text-sm text-gray-300 flex-1 truncate">{item.file.name}</span>
                        <span className="text-xs text-gray-500 shrink-0">p.{index + 1}</span>
                        {/* Move up */}
                        <button
                          onClick={() => moveImage(index, -1)}
                          disabled={index === 0}
                          className="text-gray-400 hover:text-white disabled:opacity-30 p-1"
                          title="Move up"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        {/* Move down */}
                        <button
                          onClick={() => moveImage(index, 1)}
                          disabled={index === imgPreviews.length - 1}
                          className="text-gray-400 hover:text-white disabled:opacity-30 p-1"
                          title="Move down"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {/* Remove */}
                        <button
                          onClick={() => removeImage(index)}
                          className="text-gray-400 hover:text-red-400 p-1"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleImgSubmit}
                disabled={!imgBookId || imgPreviews.length === 0 || imgIsProcessing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
              >
                {imgIsProcessing
                  ? 'Converting...'
                  : imgSelectedBook?.hasPdf
                    ? 'Convert & Append'
                    : 'Convert to PDF'}
              </button>

              {/* Result Message */}
              {imgResult && (
                <p className={`text-sm ${imgResult.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {imgResult.message}
                </p>
              )}
            </div>
          )}
        </div>

        {/* PDF Concatenation Card */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-2">PDF Concatenation</h2>
          <p className="text-gray-400 text-sm mb-6">
            Append pages to a book&apos;s existing PDF. Useful for incrementally building digital
            versions of physical books — scan a few pages now, add more later.
          </p>

          {isLoading ? (
            <p className="text-gray-400 text-sm">Loading books...</p>
          ) : books.length === 0 ? (
            <p className="text-gray-400 text-sm">No books found. Upload some audio files first to create books.</p>
          ) : (
            <div className="space-y-4">
              {/* Book Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Book</label>
                <select
                  value={selectedBookId}
                  onChange={(e) => {
                    setSelectedBookId(e.target.value);
                    setResult(null);
                  }}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select a book...</option>
                  {books.map((b) => (
                    <option key={b.bookId} value={b.bookId}>
                      {b.authorName} — {b.bookName} {b.hasPdf ? '(has PDF)' : '(no PDF)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* File Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">PDF to append</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    setSelectedFile(e.target.files?.[0] || null);
                    setResult(null);
                  }}
                  className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-700 file:text-white hover:file:bg-gray-600 file:cursor-pointer"
                />
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={!selectedBookId || !selectedFile || isProcessing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
              >
                {isProcessing
                  ? 'Processing...'
                  : selectedBook?.hasPdf
                    ? 'Append Pages'
                    : 'Upload PDF'}
              </button>

              {/* Result Message */}
              {result && (
                <p className={`text-sm ${result.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {result.message}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
