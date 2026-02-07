import { NextRequest, NextResponse } from "next/server";
import * as path from "path";
import * as mm from "music-metadata";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

// In-memory cache for album art to avoid re-parsing audio files
interface AlbumArtCache {
  data: Buffer;
  format: string;
  timestamp: number;
}

const albumArtCache = new Map<string, AlbumArtCache>();
const CACHE_MAX_SIZE = 200; // Limit cache to 200 entries
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

// Clean up old cache entries
function cleanupCache() {
  const now = Date.now();
  const entriesToDelete: string[] = [];

  for (const [key, value] of albumArtCache.entries()) {
    if (now - value.timestamp > CACHE_MAX_AGE) {
      entriesToDelete.push(key);
    }
  }

  entriesToDelete.forEach(key => albumArtCache.delete(key));

  // If cache is still too large, remove oldest entries
  if (albumArtCache.size > CACHE_MAX_SIZE) {
    const entries = Array.from(albumArtCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, albumArtCache.size - CACHE_MAX_SIZE);
    toRemove.forEach(([key]) => albumArtCache.delete(key));
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const filePath = decodeURIComponent(pathSegments.join("/"));
    const fullPath = path.join(path.resolve(MUSIC_DIR), filePath);

    // Security check: ensure the path is within MUSIC_DIR
    const resolvedPath = path.resolve(fullPath);
    const resolvedMusicDir = path.resolve(MUSIC_DIR);
    if (!resolvedPath.startsWith(resolvedMusicDir)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 403 });
    }

    // Check cache first
    const cached = albumArtCache.get(filePath);
    if (cached) {
      return new NextResponse(new Uint8Array(cached.data), {
        headers: {
          "Content-Type": cached.format,
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Cache": "HIT",
        },
      });
    }

    // Parse metadata if not cached
    const metadata = await mm.parseFile(fullPath);
    const picture = metadata.common.picture?.[0];

    if (!picture) {
      // Return a 404 if no album art is found
      return NextResponse.json({ error: "No album art found" }, { status: 404 });
    }

    // Store in cache
    const imageBuffer = Buffer.from(picture.data);
    albumArtCache.set(filePath, {
      data: imageBuffer,
      format: picture.format,
      timestamp: Date.now(),
    });

    // Periodically clean up cache
    if (Math.random() < 0.1) { // 10% chance on each request
      cleanupCache();
    }

    // Return the image with the correct content type
    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": picture.format,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Error fetching album art:", error);
    return NextResponse.json(
      { error: "Failed to fetch album art" },
      { status: 500 }
    );
  }
}
