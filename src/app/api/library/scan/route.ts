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

const JAM_TRACKS_FOLDER = "JamTracks";

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

        // Use metadata as primary source, fall back to filename - clean both
        const rawTitle = metadata.common.title || fileName;
        const title = cleanTitle(rawTitle);
        const author = metadata.common.artist || "Unknown Author";
        const book = metadata.common.album || "Unknown Book";
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

export async function POST() {
  try {
    const musicPath = path.resolve(MUSIC_DIR);
    const tracks = await scanMusicFolder();

    if (tracks.length === 0) {
      return NextResponse.json({
        message: "No tracks found in music folder",
        count: 0,
      });
    }

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

    // Clean up empty books
    await prisma.book.deleteMany({
      where: { tracks: { none: {} } },
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

      // Skip if already in correct location
      if (track.filePath === newRelativePath) {
        continue;
      }

      try {
        // Check if source file exists
        await fs.access(oldFullPath);

        // Update MP3 metadata if needed
        if (ext.toLowerCase() === ".mp3") {
          const tags: NodeID3.Tags = {
            title: track.title,
            artist: track.book.author.name,
            album: track.book.name,
            trackNumber: track.trackNumber ? String(track.trackNumber) : undefined,
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
