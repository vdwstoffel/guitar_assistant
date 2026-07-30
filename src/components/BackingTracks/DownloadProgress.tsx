'use client';

import type { DownloadProgressEvent } from '@/lib/downloadStream';

interface DownloadProgressProps {
  progress: DownloadProgressEvent | null;
}

/**
 * Progress indicator for a backing-track audio download.
 * - `downloading`: a real percentage bar.
 * - `converting` (or unknown percent): an indeterminate animated bar, since the
 *   ffmpeg extraction step reports no download percentage.
 */
export default function DownloadProgress({ progress }: DownloadProgressProps) {
  const phase = progress?.phase ?? 'downloading';
  const percent = progress?.percent ?? null;
  const converting = phase === 'converting' || percent === null;

  const label = converting
    ? 'Converting audio…'
    : `Downloading audio… ${Math.round(percent!)}%`;

  return (
    <div className="w-full max-w-sm mx-auto py-4">
      <div className="flex items-center justify-between mb-2 text-sm text-amber-200/80">
        <span>{label}</span>
        {!converting && <span className="font-mono text-amber-300">{Math.round(percent!)}%</span>}
      </div>
      <div className="h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
        {converting ? (
          <div className="h-full w-full bg-amber-500/70 animate-pulse" />
        ) : (
          <div
            className="h-full bg-amber-500 transition-[width] duration-200 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, percent!))}%` }}
          />
        )}
      </div>
    </div>
  );
}
