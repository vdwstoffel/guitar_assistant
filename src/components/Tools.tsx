'use client';

import { useState, useEffect, useRef } from 'react';
import { Author } from '@/types';

interface BookOption {
  bookId: string;
  bookName: string;
  authorName: string;
  hasPdf: boolean;
}

export default function Tools() {
  const [books, setBooks] = useState<BookOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchBooks();
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

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-8">Tools</h1>

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
