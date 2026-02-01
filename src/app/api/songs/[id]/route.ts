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
  artist: string;
  album: string;
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

    const updatedSong = await prisma.song.update({
      where: { id },
      data: { completed },
    });

    return NextResponse.json(updatedSong);
  } catch (error) {
    console.error("Error toggling song completed status:", error);
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
    const { title, artist, album, trackNumber, pdfPage } = body;

    if (!title?.trim() || !artist?.trim() || !album?.trim()) {
      return NextResponse.json(
        { error: "Title, artist, and album are required" },
        { status: 400 }
      );
    }

    // Get existing song
    const existingSong = await prisma.song.findUnique({
      where: { id },
      include: { album: { include: { artist: true } } },
    });

    if (!existingSong) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    // Write metadata to file
    const filePath = path.resolve(MUSIC_DIR, existingSong.filePath);
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".mp3") {
      const tags: NodeID3.Tags = {
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim(),
        trackNumber: trackNumber > 0 ? String(trackNumber) : undefined,
      };

      const success = NodeID3.update(tags, filePath);
      if (!success) {
        console.error("Failed to write ID3 tags to file");
      }
    } else if (ext === ".wav") {
      writeWavMetadata(filePath, {
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim(),
        trackNumber,
      });
    } else {
      // For other file types, we can only update the database
      console.warn(`Cannot write metadata to ${ext} files, only updating database`);
    }

    // Get or create artist
    const artistRecord = await prisma.artist.upsert({
      where: { name: artist.trim() },
      update: {},
      create: { name: artist.trim() },
    });

    // Get or create album under this artist
    const albumRecord = await prisma.album.upsert({
      where: {
        name_artistId: {
          name: album.trim(),
          artistId: artistRecord.id,
        },
      },
      update: {},
      create: {
        name: album.trim(),
        artistId: artistRecord.id,
      },
    });

    // Update song
    const updatedSong = await prisma.song.update({
      where: { id },
      data: {
        title: title.trim(),
        trackNumber: trackNumber >= 0 ? trackNumber : 0,
        albumId: albumRecord.id,
        pdfPage: pdfPage !== undefined ? pdfPage : undefined,
      },
      include: {
        album: {
          include: {
            artist: true,
          },
        },
        markers: {
          orderBy: { timestamp: "asc" },
        },
      },
    });

    // Clean up empty albums and artists
    await prisma.album.deleteMany({
      where: { songs: { none: {} } },
    });
    await prisma.artist.deleteMany({
      where: { albums: { none: {} } },
    });

    return NextResponse.json({
      song: updatedSong,
      artist: artistRecord,
      album: albumRecord,
    });
  } catch (error) {
    console.error("Error updating song metadata:", error);
    return NextResponse.json(
      { error: "Failed to update metadata" },
      { status: 500 }
    );
  }
}
