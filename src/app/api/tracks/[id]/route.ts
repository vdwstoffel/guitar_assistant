import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as path from "path";
import * as fs from "fs";
import NodeID3 from "node-id3";
import { WaveFile } from "wavefile";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

function writeWavMetadata(
  filePath: string,
  metadata: { title?: string; artist?: string; album?: string; trackNumber?: number }
) {
  try {
    const buffer = fs.readFileSync(filePath);
    const wav = new WaveFile(buffer);

    // WAV LIST INFO tags
    if (metadata.title) {
      wav.setTag("INAM", metadata.title); // Title/Name
    }
    if (metadata.artist) {
      wav.setTag("IART", metadata.artist); // Artist
    }
    if (metadata.album) {
      wav.setTag("IPRD", metadata.album); // Product/Album
    }
    if (metadata.trackNumber && metadata.trackNumber > 0) {
      wav.setTag("ITRK", String(metadata.trackNumber)); // Track number
    }

    fs.writeFileSync(filePath, wav.toBuffer());
    return true;
  } catch (err) {
    console.error("Failed to write WAV metadata:", err);
    return false;
  }
}

interface UpdateMetadataBody {
  title: string;
  author: string;
  book: string;
  trackNumber: number;
  pdfPage?: number | null;
}

interface ToggleCompletedBody {
  completed: boolean;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: ToggleCompletedBody = await request.json();
    const { completed } = body;

    const updatedTrack = await prisma.track.update({
      where: { id },
      data: { completed },
    });

    return NextResponse.json(updatedTrack);
  } catch (error) {
    console.error("Error toggling track completed status:", error);
    return NextResponse.json(
      { error: "Failed to update completed status" },
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
    const body: UpdateMetadataBody = await request.json();
    const { title, author: authorName, book: bookName, trackNumber, pdfPage } = body;

    if (!title?.trim() || !authorName?.trim() || !bookName?.trim()) {
      return NextResponse.json(
        { error: "Title, author, and book are required" },
        { status: 400 }
      );
    }

    // Get existing track
    const existingTrack = await prisma.track.findUnique({
      where: { id },
      include: { book: { include: { author: true } } },
    });

    if (!existingTrack) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    // Write metadata to file
    const filePath = path.resolve(MUSIC_DIR, existingTrack.filePath);
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".mp3") {
      const tags: NodeID3.Tags = {
        title: title.trim(),
        artist: authorName.trim(),
        album: bookName.trim(),
        trackNumber: trackNumber > 0 ? String(trackNumber) : undefined,
      };

      const success = NodeID3.update(tags, filePath);
      if (!success) {
        console.error("Failed to write ID3 tags to file");
      }
    } else if (ext === ".wav") {
      writeWavMetadata(filePath, {
        title: title.trim(),
        artist: authorName.trim(),
        album: bookName.trim(),
        trackNumber,
      });
    } else {
      // For other file types, we can only update the database
      console.warn(`Cannot write metadata to ${ext} files, only updating database`);
    }

    // Get or create author
    const authorRecord = await prisma.author.upsert({
      where: { name: authorName.trim() },
      update: {},
      create: { name: authorName.trim() },
    });

    // Get or create book under this author
    const bookRecord = await prisma.book.upsert({
      where: {
        name_authorId: {
          name: bookName.trim(),
          authorId: authorRecord.id,
        },
      },
      update: {},
      create: {
        name: bookName.trim(),
        authorId: authorRecord.id,
      },
    });

    // Update track
    const updatedTrack = await prisma.track.update({
      where: { id },
      data: {
        title: title.trim(),
        trackNumber: trackNumber >= 0 ? trackNumber : 0,
        bookId: bookRecord.id,
        pdfPage: pdfPage !== undefined ? pdfPage : undefined,
      },
      include: {
        book: {
          include: {
            author: true,
          },
        },
        markers: {
          orderBy: { timestamp: "asc" },
        },
      },
    });

    // Clean up empty books and authors
    await prisma.book.deleteMany({
      where: { tracks: { none: {} } },
    });
    await prisma.author.deleteMany({
      where: { books: { none: {} } },
    });

    return NextResponse.json({
      track: updatedTrack,
      author: authorRecord,
      book: bookRecord,
    });
  } catch (error) {
    console.error("Error updating track metadata:", error);
    return NextResponse.json(
      { error: "Failed to update metadata" },
      { status: 500 }
    );
  }
}
