import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as path from "path";
import * as fs from "fs";
import * as fsp from "fs/promises";
import NodeID3 from "node-id3";
import { WaveFile } from "wavefile";
import { File as TagFile } from "node-taglib-sharp";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function writeWavMetadata(
  filePath: string,
  metadata: { artist?: string; album?: string }
) {
  try {
    const buffer = fs.readFileSync(filePath);
    const wav = new WaveFile(buffer);

    if (metadata.artist) {
      wav.setTag("IART", metadata.artist);
    }
    if (metadata.album) {
      wav.setTag("IPRD", metadata.album);
    }

    fs.writeFileSync(filePath, wav.toBuffer());
    return true;
  } catch (err) {
    console.error("Failed to write WAV metadata:", err);
    return false;
  }
}

interface UpdateBookBody {
  bookName: string;
  authorName: string;
}

interface PatchBookBody {
  inProgress?: boolean;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: PatchBookBody = await request.json();

    const updatedBook = await prisma.book.update({
      where: { id },
      data: {
        ...(body.inProgress !== undefined && { inProgress: body.inProgress }),
      },
      include: {
        tracks: {
          orderBy: { trackNumber: "asc" },
          include: {
            markers: {
              orderBy: { timestamp: "asc" },
            },
          },
        },
      },
    });

    return NextResponse.json(updatedBook);
  } catch (error) {
    console.error("Error updating book:", error);
    return NextResponse.json(
      { error: "Failed to update book" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateBookBody = await request.json();
    const { bookName, authorName } = body;

    if (!bookName?.trim() || !authorName?.trim()) {
      return NextResponse.json(
        { error: "Book name and author name are required" },
        { status: 400 }
      );
    }

    // Get existing book with tracks
    const existingBook = await prisma.book.findUnique({
      where: { id },
      include: {
        author: true,
        tracks: true,
      },
    });

    if (!existingBook) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const oldAuthorName = existingBook.author.name;
    const oldBookName = existingBook.name;

    // Get or create the target author
    const targetAuthor = await prisma.author.upsert({
      where: { name: authorName.trim() },
      update: {},
      create: { name: authorName.trim() },
    });

    // Check if target book already exists under the target author
    let targetBook = await prisma.book.findUnique({
      where: {
        name_authorId: {
          name: bookName.trim(),
          authorId: targetAuthor.id,
        },
      },
    });

    // If target book doesn't exist, update the current book
    // If it does exist and is different from current, we need to merge
    if (!targetBook) {
      // Update the existing book's name and author
      targetBook = await prisma.book.update({
        where: { id },
        data: {
          name: bookName.trim(),
          authorId: targetAuthor.id,
        },
      });
    } else if (targetBook.id !== id) {
      // Target book exists and is different - move tracks and videos to target book
      await prisma.track.updateMany({
        where: { bookId: id },
        data: { bookId: targetBook.id },
      });
      await prisma.bookVideo.updateMany({
        where: { bookId: id },
        data: { bookId: targetBook.id },
      });

      // Delete the now-empty original book
      await prisma.book.delete({
        where: { id },
      });
    }

    // Update metadata in audio files
    const tracks = await prisma.track.findMany({
      where: { bookId: targetBook.id },
    });

    for (const track of tracks) {
      const filePath = path.resolve(MUSIC_DIR, track.filePath);
      const ext = path.extname(filePath).toLowerCase();

      if (ext === ".mp3") {
        try {
          const tags: NodeID3.Tags = {
            album: bookName.trim(),
            artist: authorName.trim(),
          };

          NodeID3.update(tags, filePath);
        } catch (err) {
          console.error(`Failed to update tags for ${track.filePath}:`, err);
        }
      } else if (ext === ".wav") {
        writeWavMetadata(filePath, {
          album: bookName.trim(),
          artist: authorName.trim(),
        });
      } else if (ext === ".m4a") {
        try {
          const tagFile = TagFile.createFromPath(filePath);
          tagFile.tag.performers = [authorName.trim()];
          tagFile.tag.album = bookName.trim();
          tagFile.save();
          tagFile.dispose();
        } catch (err) {
          console.error(`Failed to update m4a tags for ${track.filePath}:`, err);
        }
      }
    }

    // Relocate files on disk if author or book name changed
    const musicPath = path.resolve(MUSIC_DIR);
    const oldDir = path.join(musicPath, sanitizeFilename(oldAuthorName), sanitizeFilename(oldBookName));
    const newAuthorDir = sanitizeFilename(authorName.trim());
    const newBookDir = sanitizeFilename(bookName.trim());
    const newDir = path.join(musicPath, newAuthorDir, newBookDir);

    if (oldDir !== newDir) {
      // Create new directory structure
      await fsp.mkdir(newDir, { recursive: true });

      // Move tracks
      for (const track of tracks) {
        const oldFullPath = path.join(musicPath, track.filePath);
        const filename = path.basename(track.filePath);
        const newRelativePath = path.join(newAuthorDir, newBookDir, filename);
        const newFullPath = path.join(musicPath, newRelativePath);

        try {
          await fsp.access(oldFullPath);
          if (oldFullPath !== newFullPath) {
            await fsp.rename(oldFullPath, newFullPath);
            await prisma.track.update({
              where: { id: track.id },
              data: { filePath: newRelativePath },
            });
          }
        } catch (err) {
          console.error(`Failed to move track ${track.filePath}:`, err);
        }
      }

      // Move videos
      const videos = await prisma.bookVideo.findMany({
        where: { bookId: targetBook.id },
      });

      if (videos.length > 0) {
        const newVideosDir = path.join(newDir, "videos");
        await fsp.mkdir(newVideosDir, { recursive: true });

        for (const video of videos) {
          const oldFullPath = path.join(musicPath, video.filePath);
          const filename = path.basename(video.filePath);
          const newRelativePath = path.join(newAuthorDir, newBookDir, "videos", filename);
          const newFullPath = path.join(musicPath, newRelativePath);

          try {
            await fsp.access(oldFullPath);
            if (oldFullPath !== newFullPath) {
              await fsp.rename(oldFullPath, newFullPath);
              await prisma.bookVideo.update({
                where: { id: video.id },
                data: { filePath: newRelativePath },
              });
            }
          } catch (err) {
            console.error(`Failed to move video ${video.filePath}:`, err);
          }
        }
      }

      // Move PDF
      if (targetBook.pdfPath) {
        const oldPdfFullPath = path.join(musicPath, targetBook.pdfPath);
        const pdfFilename = path.basename(targetBook.pdfPath);
        const newPdfRelativePath = path.join(newAuthorDir, newBookDir, pdfFilename);
        const newPdfFullPath = path.join(musicPath, newPdfRelativePath);

        try {
          await fsp.access(oldPdfFullPath);
          if (oldPdfFullPath !== newPdfFullPath) {
            await fsp.rename(oldPdfFullPath, newPdfFullPath);
            await prisma.book.update({
              where: { id: targetBook.id },
              data: { pdfPath: newPdfRelativePath },
            });
          }
        } catch (err) {
          console.error(`Failed to move PDF ${targetBook.pdfPath}:`, err);
        }
      }

      // Clean up empty old directories (start from deepest: videos/, then book, then author)
      const dirsToClean = [
        path.join(oldDir, "videos"),
        oldDir,
        path.dirname(oldDir),
      ];
      for (const dir of dirsToClean) {
        try {
          if (dir.startsWith(musicPath) && dir !== musicPath) {
            const files = await fsp.readdir(dir);
            if (files.length === 0) {
              await fsp.rmdir(dir);
            }
          }
        } catch {
          // Ignore cleanup errors (dir may not exist)
        }
      }
    }

    // Clean up empty books (no tracks AND no videos) and authors
    await prisma.book.deleteMany({
      where: { tracks: { none: {} }, videos: { none: {} } },
    });
    await prisma.author.deleteMany({
      where: { books: { none: {} } },
    });

    // Return the updated book with all relations
    const updatedBook = await prisma.book.findUnique({
      where: { id: targetBook.id },
      include: {
        author: true,
        tracks: {
          orderBy: { trackNumber: "asc" },
          include: {
            markers: {
              orderBy: { timestamp: "asc" },
            },
          },
        },
      },
    });

    return NextResponse.json({
      book: updatedBook,
      author: targetAuthor,
    });
  } catch (error) {
    console.error("Error updating book metadata:", error);
    return NextResponse.json(
      { error: "Failed to update book metadata" },
      { status: 500 }
    );
  }
}
