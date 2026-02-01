import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";
import * as mm from "music-metadata";
import NodeID3 from "node-id3";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
const SUPPORTED_EXTENSIONS = [".mp3", ".flac", ".wav", ".ogg", ".m4a", ".aac"];

// Reorganize helpers
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function padTrackNumber(trackNumber: number, totalTracks: number): string {
  if (totalTracks >= 100) {
    return trackNumber.toString().padStart(3, "0");
  }
  return trackNumber.toString().padStart(2, "0");
}

interface ScannedSong {
  title: string;
  trackNumber: number;
  duration: number;
  filePath: string;
  artist: string;
  album: string;
}

async function findAudioFiles(dir: string): Promise<string[]> {
  const audioFiles: string[] = [];

  async function scanDir(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          audioFiles.push(fullPath);
        }
      }
    }
  }

  await scanDir(dir);
  return audioFiles;
}

async function scanMusicFolder(): Promise<ScannedSong[]> {
  const songs: ScannedSong[] = [];
  const musicPath = path.resolve(MUSIC_DIR);

  try {
    const audioFiles = await findAudioFiles(musicPath);

    for (const filePath of audioFiles) {
      try {
        const metadata = await mm.parseFile(filePath);
        const ext = path.extname(filePath);
        // Remove extension case-insensitively
        const baseName = path.basename(filePath);
        const fileName = baseName.replace(new RegExp(ext.replace('.', '\\.') + '$', 'i'), '');

        // Clean up title for display: strip extension, replace dashes/underscores with spaces
        const cleanTitle = (raw: string) => {
          // Remove any file extension
          const withoutExt = raw.replace(/\.(mp3|wav|flac|ogg|m4a|aac)$/i, '');
          // Replace dashes/underscores with spaces
          return withoutExt.replace(/[-_]/g, ' ').trim();
        };

        // Use metadata as primary source, fall back to filename - clean both
        const rawTitle = metadata.common.title || fileName;
        const title = cleanTitle(rawTitle);
        const artist = metadata.common.artist || "Unknown Artist";
        const album = metadata.common.album || "Unknown Album";
        const trackNumber = metadata.common.track?.no || 0;
        const duration = metadata.format.duration || 0;

        songs.push({
          title,
          trackNumber,
          duration,
          filePath: path.relative(musicPath, filePath),
          artist,
          album,
        });
      } catch (err) {
        console.error(`Error parsing ${filePath}:`, err);
      }
    }
  } catch (err) {
    console.error("Error scanning music folder:", err);
  }

  return songs;
}

export async function POST() {
  try {
    const songs = await scanMusicFolder();

    if (songs.length === 0) {
      return NextResponse.json({
        message: "No songs found in music folder",
        count: 0,
      });
    }

    // Group songs by artist and album
    const artistAlbumMap = new Map<
      string,
      Map<string, ScannedSong[]>
    >();

    for (const song of songs) {
      if (!artistAlbumMap.has(song.artist)) {
        artistAlbumMap.set(song.artist, new Map());
      }
      const albumMap = artistAlbumMap.get(song.artist)!;
      if (!albumMap.has(song.album)) {
        albumMap.set(song.album, []);
      }
      albumMap.get(song.album)!.push(song);
    }

    // Upsert artists, albums, and songs
    for (const [artistName, albums] of artistAlbumMap) {
      const artist = await prisma.artist.upsert({
        where: { name: artistName },
        update: {},
        create: { name: artistName },
      });

      for (const [albumName, albumSongs] of albums) {
        const album = await prisma.album.upsert({
          where: {
            name_artistId: {
              name: albumName,
              artistId: artist.id,
            },
          },
          update: {},
          create: {
            name: albumName,
            artistId: artist.id,
          },
        });

        for (const song of albumSongs) {
          await prisma.song.upsert({
            where: { filePath: song.filePath },
            update: {
              title: song.title,
              trackNumber: song.trackNumber,
              duration: song.duration,
              albumId: album.id,
            },
            create: {
              title: song.title,
              trackNumber: song.trackNumber,
              duration: song.duration,
              filePath: song.filePath,
              albumId: album.id,
            },
          });
        }
      }
    }

    // Clean up: remove songs that no longer exist on disk
    const validPaths = new Set(songs.map((s) => s.filePath));
    const allDbSongs = await prisma.song.findMany({ select: { id: true, filePath: true } });
    const songsToDelete = allDbSongs.filter((s) => !validPaths.has(s.filePath));

    if (songsToDelete.length > 0) {
      await prisma.song.deleteMany({
        where: { id: { in: songsToDelete.map((s) => s.id) } },
      });
    }

    // Clean up empty albums
    await prisma.album.deleteMany({
      where: { songs: { none: {} } },
    });

    // Clean up empty artists
    await prisma.artist.deleteMany({
      where: { albums: { none: {} } },
    });

    // Reorganize: move files into Artist/Album/XX - Title.ext structure
    const musicPath = path.resolve(MUSIC_DIR);
    const allSongs = await prisma.song.findMany({
      include: {
        album: {
          include: {
            artist: true,
            songs: { select: { id: true } },
          },
        },
      },
    });

    let reorganizedCount = 0;

    for (const song of allSongs) {
      const artistName = sanitizeFilename(song.album.artist.name);
      const albumName = sanitizeFilename(song.album.name);
      const ext = path.extname(song.filePath);
      const totalTracksInAlbum = song.album.songs.length;

      // Build filename with track number prefix if available
      let songFilename: string;
      if (song.trackNumber && song.trackNumber > 0) {
        const paddedTrack = padTrackNumber(song.trackNumber, totalTracksInAlbum);
        songFilename = `${paddedTrack} - ${sanitizeFilename(song.title)}${ext}`;
      } else {
        songFilename = sanitizeFilename(song.title) + ext;
      }

      // Build new path: Artist/Album/XX - song.mp3
      const newRelativePath = path.join(artistName, albumName, songFilename);
      const oldFullPath = path.join(musicPath, song.filePath);
      const newFullPath = path.join(musicPath, newRelativePath);

      // Skip if already in correct location
      if (song.filePath === newRelativePath) {
        continue;
      }

      try {
        // Check if source file exists
        await fs.access(oldFullPath);

        // Update MP3 metadata if needed
        if (ext.toLowerCase() === ".mp3") {
          const tags: NodeID3.Tags = {
            title: song.title,
            artist: song.album.artist.name,
            album: song.album.name,
            trackNumber: song.trackNumber ? String(song.trackNumber) : undefined,
          };
          NodeID3.update(tags, oldFullPath);
        }

        // Create directory structure
        const newDir = path.dirname(newFullPath);
        await fs.mkdir(newDir, { recursive: true });

        // Handle filename conflicts
        let finalPath = newFullPath;
        let finalRelativePath = newRelativePath;
        let counter = 1;

        while (oldFullPath !== finalPath) {
          try {
            await fs.access(finalPath);
            // File exists, add counter
            let newFilename: string;
            if (song.trackNumber && song.trackNumber > 0) {
              const paddedTrack = padTrackNumber(song.trackNumber, totalTracksInAlbum);
              newFilename = `${paddedTrack} - ${sanitizeFilename(song.title)} (${counter})${ext}`;
            } else {
              newFilename = `${sanitizeFilename(song.title)} (${counter})${ext}`;
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
        if (oldFullPath !== finalPath) {
          await fs.rename(oldFullPath, finalPath);

          // Update database with new path
          await prisma.song.update({
            where: { id: song.id },
            data: { filePath: finalRelativePath },
          });

          reorganizedCount++;

          // Clean up empty directories
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
        console.error(`Failed to reorganize ${song.filePath}:`, err);
      }
    }

    return NextResponse.json({
      message: "Library scan complete",
      count: songs.length,
      removed: songsToDelete.length,
      reorganized: reorganizedCount,
    });
  } catch (error) {
    console.error("Error scanning library:", error);
    return NextResponse.json(
      { error: "Failed to scan library" },
      { status: 500 }
    );
  }
}
