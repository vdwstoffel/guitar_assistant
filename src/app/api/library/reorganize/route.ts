import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";
import NodeID3 from "node-id3";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

function sanitizeFilename(name: string): string {
  // Remove or replace characters that are invalid in filenames
  return name
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTrackNumberFromFilename(filename: string): number | null {
  // Try to extract track number from start of filename
  // Patterns: "02_Track.mp3", "02 - Track.mp3", "02. Track.mp3", "02 Track.mp3"
  const basename = path.basename(filename, path.extname(filename));
  const match = basename.match(/^(\d{1,3})[\s_.\-]+/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

function stripTrackNumberPrefix(title: string): string {
  // Remove track number prefix from title
  // Patterns: "02_Track", "02 - Track", "02. Track", "02 Track"
  return title.replace(/^(\d{1,3})[\s_.\-]+/, "").trim();
}

function padTrackNumber(trackNumber: number, totalTracks: number): string {
  if (totalTracks >= 100) {
    return trackNumber.toString().padStart(3, "0");
  }
  return trackNumber.toString().padStart(2, "0");
}

export async function POST() {
  try {
    const musicPath = path.resolve(MUSIC_DIR);

    // Get all tracks with their book and author info
    const tracks = await prisma.track.findMany({
      include: {
        book: {
          include: {
            author: true,
            tracks: { select: { id: true } }, // Get track count for book
          },
        },
      },
    });

    const results: { track: string; oldPath: string; newPath: string; success: boolean; error?: string }[] = [];

    for (const track of tracks) {
      const authorName = sanitizeFilename(track.book.author.name);
      const bookName = sanitizeFilename(track.book.name);
      const ext = path.extname(track.filePath);
      const totalTracksInBook = track.book.tracks.length;

      // Determine track number
      let trackNumber = track.trackNumber;

      // If no track number, try to extract from filename
      if (!trackNumber || trackNumber === 0) {
        const extractedTrack = extractTrackNumberFromFilename(track.filePath);
        if (extractedTrack) {
          trackNumber = extractedTrack;
        }
      }

      // Clean up the title by removing any track number prefix
      const cleanTitle = stripTrackNumberPrefix(track.title);

      // Build filename with track number prefix if available
      let trackFilename: string;
      if (trackNumber && trackNumber > 0) {
        const paddedTrack = padTrackNumber(trackNumber, totalTracksInBook);
        trackFilename = `${paddedTrack} - ${sanitizeFilename(cleanTitle)}${ext}`;
      } else {
        trackFilename = sanitizeFilename(cleanTitle) + ext;
      }

      // Build new path: Author/Book/XX - track.mp3
      const newRelativePath = path.join(authorName, bookName, trackFilename);
      const oldFullPath = path.join(musicPath, track.filePath);
      const newFullPath = path.join(musicPath, newRelativePath);

      // Skip if already in correct location and track number unchanged
      if (track.filePath === newRelativePath && track.trackNumber === trackNumber) {
        results.push({
          track: track.title,
          oldPath: track.filePath,
          newPath: newRelativePath,
          success: true,
        });
        continue;
      }

      try {
        // Check if source file exists
        await fs.access(oldFullPath);

        // Update metadata in file if it's an MP3 and something changed
        if (ext.toLowerCase() === ".mp3") {
          const needsUpdate =
            (trackNumber && trackNumber !== track.trackNumber) ||
            (cleanTitle !== track.title);

          if (needsUpdate) {
            const tags: NodeID3.Tags = {
              title: cleanTitle,
              trackNumber: trackNumber ? String(trackNumber) : undefined,
            };
            NodeID3.update(tags, oldFullPath);
          }
        }

        // Create directory structure
        const newDir = path.dirname(newFullPath);
        await fs.mkdir(newDir, { recursive: true });

        // Check if destination already exists (avoid overwriting)
        let finalPath = newFullPath;
        let finalRelativePath = newRelativePath;
        let counter = 1;

        // Only check for conflicts if we're actually moving the file
        if (oldFullPath !== finalPath) {
          while (true) {
            try {
              await fs.access(finalPath);
              // File exists, add counter
              const baseName = sanitizeFilename(cleanTitle);
              let newFilename: string;
              if (trackNumber && trackNumber > 0) {
                const paddedTrack = padTrackNumber(trackNumber, totalTracksInBook);
                newFilename = `${paddedTrack} - ${baseName} (${counter})${ext}`;
              } else {
                newFilename = `${baseName} (${counter})${ext}`;
              }
              finalRelativePath = path.join(authorName, bookName, newFilename);
              finalPath = path.join(musicPath, finalRelativePath);
              counter++;
            } catch {
              // File doesn't exist, we can use this path
              break;
            }
          }

          // Move the file
          await fs.rename(oldFullPath, finalPath);
        }

        // Update database with clean title
        await prisma.track.update({
          where: { id: track.id },
          data: {
            title: cleanTitle,
            filePath: finalRelativePath,
            trackNumber: trackNumber || 0,
          },
        });

        results.push({
          track: track.title,
          oldPath: track.filePath,
          newPath: finalRelativePath,
          success: true,
        });

        // Try to clean up empty directories
        if (oldFullPath !== finalPath) {
          try {
            let dirToClean = path.dirname(oldFullPath);
            while (dirToClean !== musicPath && dirToClean.startsWith(musicPath)) {
              const files = await fs.readdir(dirToClean);
              if (files.length === 0) {
                await fs.rmdir(dirToClean);
                dirToClean = path.dirname(dirToClean);
              } else {
                break;
              }
            }
          } catch {
            // Ignore cleanup errors
          }
        }
      } catch (err) {
        results.push({
          track: track.title,
          oldPath: track.filePath,
          newPath: newRelativePath,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      message: `Reorganized ${successCount} of ${tracks.length} tracks`,
      results,
    });
  } catch (error) {
    console.error("Error reorganizing library:", error);
    return NextResponse.json(
      { error: "Failed to reorganize library" },
      { status: 500 }
    );
  }
}
