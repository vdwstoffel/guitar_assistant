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
  // Patterns: "02_Song.mp3", "02 - Song.mp3", "02. Song.mp3", "02 Song.mp3"
  const basename = path.basename(filename, path.extname(filename));
  const match = basename.match(/^(\d{1,3})[\s_.\-]+/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

function stripTrackNumberPrefix(title: string): string {
  // Remove track number prefix from title
  // Patterns: "02_Song", "02 - Song", "02. Song", "02 Song"
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

    // Get all songs with their album and artist info
    const songs = await prisma.song.findMany({
      include: {
        album: {
          include: {
            artist: true,
            songs: { select: { id: true } }, // Get song count for album
          },
        },
      },
    });

    const results: { song: string; oldPath: string; newPath: string; success: boolean; error?: string }[] = [];

    for (const song of songs) {
      const artistName = sanitizeFilename(song.album.artist.name);
      const albumName = sanitizeFilename(song.album.name);
      const ext = path.extname(song.filePath);
      const totalTracksInAlbum = song.album.songs.length;

      // Determine track number
      let trackNumber = song.trackNumber;

      // If no track number, try to extract from filename
      if (!trackNumber || trackNumber === 0) {
        const extractedTrack = extractTrackNumberFromFilename(song.filePath);
        if (extractedTrack) {
          trackNumber = extractedTrack;
        }
      }

      // Clean up the title by removing any track number prefix
      const cleanTitle = stripTrackNumberPrefix(song.title);

      // Build filename with track number prefix if available
      let songFilename: string;
      if (trackNumber && trackNumber > 0) {
        const paddedTrack = padTrackNumber(trackNumber, totalTracksInAlbum);
        songFilename = `${paddedTrack} - ${sanitizeFilename(cleanTitle)}${ext}`;
      } else {
        songFilename = sanitizeFilename(cleanTitle) + ext;
      }

      // Build new path: Artist/Album/XX - song.mp3
      const newRelativePath = path.join(artistName, albumName, songFilename);
      const oldFullPath = path.join(musicPath, song.filePath);
      const newFullPath = path.join(musicPath, newRelativePath);

      // Skip if already in correct location and track number unchanged
      if (song.filePath === newRelativePath && song.trackNumber === trackNumber) {
        results.push({
          song: song.title,
          oldPath: song.filePath,
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
            (trackNumber && trackNumber !== song.trackNumber) ||
            (cleanTitle !== song.title);

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
                const paddedTrack = padTrackNumber(trackNumber, totalTracksInAlbum);
                newFilename = `${paddedTrack} - ${baseName} (${counter})${ext}`;
              } else {
                newFilename = `${baseName} (${counter})${ext}`;
              }
              finalRelativePath = path.join(artistName, albumName, newFilename);
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
        await prisma.song.update({
          where: { id: song.id },
          data: {
            title: cleanTitle,
            filePath: finalRelativePath,
            trackNumber: trackNumber || 0,
          },
        });

        results.push({
          song: song.title,
          oldPath: song.filePath,
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
          song: song.title,
          oldPath: song.filePath,
          newPath: newRelativePath,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      message: `Reorganized ${successCount} of ${songs.length} songs`,
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
