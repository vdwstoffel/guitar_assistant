'use client';

import { buildEmbedUrl } from '@/lib/youtube';

interface YouTubeEmbedProps {
  videoId: string;
  title?: string;
  className?: string;
}

export default function YouTubeEmbed({ videoId, title, className }: YouTubeEmbedProps) {
  return (
    <div className={`relative w-full ${className ?? ''}`} style={{ aspectRatio: '16 / 9' }}>
      <iframe
        src={buildEmbedUrl(videoId)}
        title={title ?? 'YouTube video player'}
        className="absolute inset-0 w-full h-full rounded-lg"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
