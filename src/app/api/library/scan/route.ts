import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";
import * as mm from "music-metadata";
import NodeID3 from "node-id3";
import { File as TagFile } from "node-taglib-sharp";
import ffmpeg from "fluent-ffmpeg";

// ffmpeg is installed in the system PATH via Docker

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
const SUPPORTED_EXTENSIONS = [".mp3", ".flac", ".wav", ".ogg", ".m4a", ".aac"];
const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".m4v"];

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

// Extract track number from video filename (e.g., "001 - First String Notes.mp4" → 1)
function extractTrackNumberFromFilename(filename: string): number | null {
  // Match leading digits followed by optional separator (space, dash, underscore, dot)
  const match = filename.match(/^(\d+)[\s\-_.]*/);
  if (match) {
    const num = parseInt(match[1], 10);
    return isNaN(num) ? null : num;
  }
  return null;
}

// Extract title from video filename (e.g., "001 - Power Chords 1.mp4" → "Power Chords 1")
function extractTitleFromFilename(filename: string): string {
  // Remove extension
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  // Remove leading track number and separator (digits followed by space/dash/underscore/dot combinations)
  const withoutNumber = withoutExt.replace(/^\d+[\s\-_.]*/, "");
  // Return the cleaned title, or the filename without extension if nothing left
  return withoutNumber.trim() || withoutExt;
}

interface ScannedTrack {
  title: string;
  trackNumber: number;
  duration: number;
  filePath: string;
  author: string;
  book: string;
}

interface ScannedJamTrack {
  title: string;
  duration: number;
  filePath: string;
  pdfPath: string | null;
}

interface ScannedVideo {
  filename: string;
  title: string;
  filePath: string;
  duration: number | null;
  bookId: string;
  trackNumber: number | null;
}

const JAM_TRACKS_FOLDER = "JamTracks";

// Helper function to get video duration
function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const duration = metadata.format.duration || 0;
        resolve(duration);
      }
    });
  });
}

async function findPdfInFolder(folderPath: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
        return path.join(folderPath, entry.name);
      }
    }
  } catch {
    // Folder doesn't exist or can't be read
  }
  return null;
}

async function findAudioFiles(dir: string, skipJamTracks: boolean = true): Promise<string[]> {
  const audioFiles: string[] = [];
  const musicPath = path.resolve(MUSIC_DIR);

  async function scanDir(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip JamTracks folder during regular scanning
        if (skipJamTracks && currentDir === musicPath && entry.name === JAM_TRACKS_FOLDER) {
          continue;
        }
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

async function scanJamTracksFolder(): Promise<ScannedJamTrack[]> {
  const jamTracks: ScannedJamTrack[] = [];
  const musicPath = path.resolve(MUSIC_DIR);
  const jamTracksPath = path.join(musicPath, JAM_TRACKS_FOLDER);

  try {
    await fs.access(jamTracksPath);
  } catch {
    // JamTracks folder doesn't exist, return empty array
    return jamTracks;
  }

  const entries = await fs.readdir(jamTracksPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const trackFolder = path.join(jamTracksPath, entry.name);
    const folderEntries = await fs.readdir(trackFolder, { withFileTypes: true });

    // Find audio file in folder
    let audioFile: string | null = null;
    let pdfFile: string | null = null;

    for (const fileEntry of folderEntries) {
      if (!fileEntry.isFile()) continue;

      const ext = path.extname(fileEntry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext) && !audioFile) {
        audioFile = path.join(trackFolder, fileEntry.name);
      } else if (ext === ".pdf" && !pdfFile) {
        pdfFile = path.join(trackFolder, fileEntry.name);
      }
    }

    if (!audioFile) continue;

    try {
      const metadata = await mm.parseFile(audioFile);
      const title = metadata.common.title || entry.name;
      const duration = metadata.format.duration || 0;

      jamTracks.push({
        title,
        duration,
        filePath: path.relative(musicPath, audioFile),
        pdfPath: pdfFile ? path.relative(musicPath, pdfFile) : null,
      });
    } catch (err) {
      console.error(`Error parsing jam track ${audioFile}:`, err);
    }
  }

  return jamTracks;
}

async function scanBookVideos(bookId: string, bookFolderPath: string): Promise<ScannedVideo[]> {
  const videos: ScannedVideo[] = [];
  const musicPath = path.resolve(MUSIC_DIR);
  const videosPath = path.join(bookFolderPath, "videos");

  try {
    await fs.access(videosPath);
  } catch {
    // No videos folder for this book
    return videos;
  }

  try {
    const entries = await fs.readdir(videosPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_VIDEO_EXTENSIONS.includes(ext)) continue;

      const videoFullPath = path.join(videosPath, entry.name);
      let duration: number | null = null;

      try {
        duration = await getVideoDuration(videoFullPath);
      } catch (err) {
        console.error(`Error getting video duration for ${videoFullPath}:`, err);
      }

      const trackNumber = extractTrackNumberFromFilename(entry.name);
      const title = extractTitleFromFilename(entry.name);
      videos.push({
        filename: entry.name,
        title,
        filePath: path.relative(musicPath, videoFullPath),
        duration,
        bookId,
        trackNumber,
      });
    }
  } catch (err) {
    console.error(`Error scanning videos in ${videosPath}:`, err);
  }

  return videos;
}

async function scanMusicFolder(): Promise<ScannedTrack[]> {
  const tracks: ScannedTrack[] = [];
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

        // Get folder structure as fallback: music/Author/Book/track.ext
        const relativePath = path.relative(musicPath, filePath);
        const pathParts = relativePath.split(path.sep);
        const folderAuthor = pathParts.length >= 3 ? pathParts[0] : null;
        const folderBook = pathParts.length >= 3 ? pathParts[1] : null;

        // Use metadata as primary source, fall back to folder structure, then defaults
        const rawTitle = metadata.common.title || fileName;
        const title = cleanTitle(rawTitle);
        const author = metadata.common.artist || folderAuthor || "Unknown Author";
        const book = metadata.common.album || folderBook || "Unknown Book";
        const trackNumber = metadata.common.track?.no || 0;
        const duration = metadata.format.duration || 0;

        tracks.push({
          title,
          trackNumber,
          duration,
          filePath: path.relative(musicPath, filePath),
          author,
          book,
        });
      } catch (err) {
        console.error(`Error parsing ${filePath}:`, err);
      }
    }
  } catch (err) {
    console.error("Error scanning music folder:", err);
  }

  return tracks;
}

async function discoverVideoOnlyBooks(): Promise<Map<string, Set<string>>> {
  const musicPath = path.resolve(MUSIC_DIR);
  const videoOnlyBooks = new Map<string, Set<string>>();

  try {
    const authorDirs = await fs.readdir(musicPath, { withFileTypes: true });

    for (const authorEntry of authorDirs) {
      if (!authorEntry.isDirectory()) continue;
      if (authorEntry.name === JAM_TRACKS_FOLDER) continue;

      const authorPath = path.join(musicPath, authorEntry.name);
      const bookDirs = await fs.readdir(authorPath, { withFileTypes: true });

      for (const bookEntry of bookDirs) {
        if (!bookEntry.isDirectory()) continue;

        const bookPath = path.join(authorPath, bookEntry.name);
        const videosPath = path.join(bookPath, "videos");

        // Check if book has a videos folder with video files
        try {
          await fs.access(videosPath);
          const videoEntries = await fs.readdir(videosPath, { withFileTypes: true });
          const hasVideos = videoEntries.some(entry => {
            const ext = path.extname(entry.name).toLowerCase();
            return entry.isFile() && SUPPORTED_VIDEO_EXTENSIONS.includes(ext);
          });

          if (hasVideos) {
            if (!videoOnlyBooks.has(authorEntry.name)) {
              videoOnlyBooks.set(authorEntry.name, new Set());
            }
            videoOnlyBooks.get(authorEntry.name)!.add(bookEntry.name);
          }
        } catch {
          // No videos folder, skip
        }
      }
    }
  } catch (err) {
    console.error("Error discovering video-only books:", err);
  }

  return videoOnlyBooks;
}

export async function POST() {
  try {
    const musicPath = path.resolve(MUSIC_DIR);
    const tracks = await scanMusicFolder();

    // Discover books that might have only videos (no audio tracks)
    const videoOnlyBooks = await discoverVideoOnlyBooks();

    // Group tracks by author and book
    const authorBookMap = new Map<
      string,
      Map<string, ScannedTrack[]>
    >();

    for (const track of tracks) {
      if (!authorBookMap.has(track.author)) {
        authorBookMap.set(track.author, new Map());
      }
      const bookMap = authorBookMap.get(track.author)!;
      if (!bookMap.has(track.book)) {
        bookMap.set(track.book, []);
      }
      bookMap.get(track.book)!.push(track);
    }

    // Add video-only books to the map with empty track arrays
    for (const [authorName, bookNames] of videoOnlyBooks) {
      if (!authorBookMap.has(authorName)) {
        authorBookMap.set(authorName, new Map());
      }
      const bookMap = authorBookMap.get(authorName)!;
      for (const bookName of bookNames) {
        if (!bookMap.has(bookName)) {
          bookMap.set(bookName, []);
        }
      }
    }

    if (authorBookMap.size === 0) {
      return NextResponse.json({
        message: "No tracks or videos found in music folder",
        count: 0,
      });
    }

    // Upsert authors, books, and tracks
    for (const [authorName, books] of authorBookMap) {
      const author = await prisma.author.upsert({
        where: { name: authorName },
        update: {},
        create: { name: authorName },
      });

      for (const [bookName, bookTracks] of books) {
        // Check for PDF in the book folder
        const bookFolderPath = path.join(musicPath, authorName, bookName);
        const pdfFullPath = await findPdfInFolder(bookFolderPath);
        const pdfPath = pdfFullPath ? path.relative(musicPath, pdfFullPath) : null;

        const book = await prisma.book.upsert({
          where: {
            name_authorId: {
              name: bookName,
              authorId: author.id,
            },
          },
          update: { pdfPath },
          create: {
            name: bookName,
            authorId: author.id,
            pdfPath,
          },
        });

        for (const track of bookTracks) {
          await prisma.track.upsert({
            where: { filePath: track.filePath },
            update: {
              title: track.title,
              trackNumber: track.trackNumber,
              duration: track.duration,
              bookId: book.id,
            },
            create: {
              title: track.title,
              trackNumber: track.trackNumber,
              duration: track.duration,
              filePath: track.filePath,
              bookId: book.id,
            },
          });
        }

        // Scan for videos in this book's folder
        const bookVideos = await scanBookVideos(book.id, bookFolderPath);
        for (const video of bookVideos) {
          await prisma.bookVideo.upsert({
            where: { filePath: video.filePath },
            update: {
              filename: video.filename,
              title: video.title,
              duration: video.duration,
              bookId: video.bookId,
              trackNumber: video.trackNumber,
              sortOrder: video.trackNumber ?? 0,
            },
            create: {
              filename: video.filename,
              title: video.title,
              filePath: video.filePath,
              duration: video.duration,
              bookId: video.bookId,
              trackNumber: video.trackNumber,
              sortOrder: video.trackNumber ?? 0,
            },
          });
        }
      }
    }

    // Clean up: remove tracks that no longer exist on disk
    const validPaths = new Set(tracks.map((t: ScannedTrack) => t.filePath));
    const allDbTracks = await prisma.track.findMany({ select: { id: true, filePath: true } });
    const tracksToDelete = allDbTracks.filter((t: { id: string; filePath: string }) => !validPaths.has(t.filePath));

    if (tracksToDelete.length > 0) {
      await prisma.track.deleteMany({
        where: { id: { in: tracksToDelete.map((t: { id: string }) => t.id) } },
      });
    }

    // Clean up: remove videos that no longer exist on disk
    const allDbVideos = await prisma.bookVideo.findMany({ select: { id: true, filePath: true } });
    const videosToDelete: { id: string }[] = [];

    for (const video of allDbVideos) {
      const videoFullPath = path.join(musicPath, video.filePath);
      try {
        await fs.access(videoFullPath);
      } catch {
        // Video file doesn't exist, mark for deletion
        videosToDelete.push({ id: video.id });
      }
    }

    if (videosToDelete.length > 0) {
      await prisma.bookVideo.deleteMany({
        where: { id: { in: videosToDelete.map((v) => v.id) } },
      });
    }

    // Clean up empty books (only delete if no tracks AND no videos)
    await prisma.book.deleteMany({
      where: {
        AND: [
          { tracks: { none: {} } },
          { videos: { none: {} } },
        ],
      },
    });

    // Clean up empty authors
    await prisma.author.deleteMany({
      where: { books: { none: {} } },
    });

    // Reorganize: move files into Author/Book/XX - Title.ext structure
    const allTracks = await prisma.track.findMany({
      include: {
        book: {
          include: {
            author: true,
            tracks: { select: { id: true } },
          },
        },
      },
    });

    let reorganizedCount = 0;

    for (const track of allTracks) {
      const authorName = sanitizeFilename(track.book.author.name);
      const bookName = sanitizeFilename(track.book.name);
      const ext = path.extname(track.filePath);
      const totalTracksInBook = track.book.tracks.length;

      // Build filename with track number prefix if available
      let trackFilename: string;
      if (track.trackNumber && track.trackNumber > 0) {
        const paddedTrack = padTrackNumber(track.trackNumber, totalTracksInBook);
        trackFilename = `${paddedTrack} - ${sanitizeFilename(track.title)}${ext}`;
      } else {
        trackFilename = sanitizeFilename(track.title) + ext;
      }

      // Build new path: Author/Book/XX - track.mp3
      const newRelativePath = path.join(authorName, bookName, trackFilename);
      const oldFullPath = path.join(musicPath, track.filePath);
      const newFullPath = path.join(musicPath, newRelativePath);

      try {
        // Check if source file exists
        await fs.access(oldFullPath);

        // Always update embedded metadata to match database values
        if (ext.toLowerCase() === ".mp3") {
          const tags: NodeID3.Tags = {
            title: track.title,
            artist: track.book.author.name,
            album: track.book.name,
            trackNumber: track.trackNumber ? String(track.trackNumber) : undefined,
          };
          NodeID3.update(tags, oldFullPath);
        } else if (ext.toLowerCase() === ".m4a") {
          try {
            const tagFile = TagFile.createFromPath(oldFullPath);
            tagFile.tag.title = track.title;
            tagFile.tag.performers = [track.book.author.name];
            tagFile.tag.album = track.book.name;
            if (track.trackNumber) {
              tagFile.tag.track = track.trackNumber;
            }
            tagFile.save();
            tagFile.dispose();
          } catch (tagErr) {
            console.error(`Failed to update m4a metadata for ${oldFullPath}:`, tagErr);
          }
        }

        // Skip file move if already in correct location
        if (track.filePath === newRelativePath) {
          continue;
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
            if (track.trackNumber && track.trackNumber > 0) {
              const paddedTrack = padTrackNumber(track.trackNumber, totalTracksInBook);
              newFilename = `${paddedTrack} - ${sanitizeFilename(track.title)} (${counter})${ext}`;
            } else {
              newFilename = `${sanitizeFilename(track.title)} (${counter})${ext}`;
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
        if (oldFullPath !== finalPath) {
          await fs.rename(oldFullPath, finalPath);

          // Update database with new path
          await prisma.track.update({
            where: { id: track.id },
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
        console.error(`Failed to reorganize ${track.filePath}:`, err);
      }
    }

    // Scan and process JamTracks folder
    const jamTracks = await scanJamTracksFolder();
    let jamTracksAdded = 0;
    let jamTracksRemoved = 0;

    for (const jamTrack of jamTracks) {
      await prisma.jamTrack.upsert({
        where: { filePath: jamTrack.filePath },
        update: {
          title: jamTrack.title,
          duration: jamTrack.duration,
          pdfPath: jamTrack.pdfPath,
        },
        create: {
          title: jamTrack.title,
          duration: jamTrack.duration,
          filePath: jamTrack.filePath,
          pdfPath: jamTrack.pdfPath,
        },
      });
      jamTracksAdded++;
    }

    // Clean up orphaned jam tracks
    const validJamPaths = new Set(jamTracks.map((t) => t.filePath));
    const allDbJamTracks = await prisma.jamTrack.findMany({ select: { id: true, filePath: true } });
    const jamTracksToDelete = allDbJamTracks.filter((t) => !validJamPaths.has(t.filePath));

    if (jamTracksToDelete.length > 0) {
      await prisma.jamTrack.deleteMany({
        where: { id: { in: jamTracksToDelete.map((t) => t.id) } },
      });
      jamTracksRemoved = jamTracksToDelete.length;
    }

    return NextResponse.json({
      message: "Library scan complete",
      count: tracks.length,
      removed: tracksToDelete.length,
      reorganized: reorganizedCount,
      videos: {
        removed: videosToDelete.length,
      },
      jamTracks: {
        found: jamTracks.length,
        removed: jamTracksRemoved,
      },
    });
  } catch (error) {
    console.error("Error scanning library:", error);
    return NextResponse.json(
      { error: "Failed to scan library" },
      { status: 500 }
    );
  }
}
