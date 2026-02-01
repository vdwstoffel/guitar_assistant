import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as path from "path";
import * as fs from "fs";
import NodeID3 from "node-id3";
import { WaveFile } from "wavefile";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

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

interface UpdateAlbumBody {
  albumName: string;
  artistName: string;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateAlbumBody = await request.json();
    const { albumName, artistName } = body;

    if (!albumName?.trim() || !artistName?.trim()) {
      return NextResponse.json(
        { error: "Album name and artist name are required" },
        { status: 400 }
      );
    }

    // Get existing album with songs
    const existingAlbum = await prisma.album.findUnique({
      where: { id },
      include: {
        artist: true,
        songs: true,
      },
    });

    if (!existingAlbum) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    // Get or create the target artist
    const targetArtist = await prisma.artist.upsert({
      where: { name: artistName.trim() },
      update: {},
      create: { name: artistName.trim() },
    });

    // Check if target album already exists under the target artist
    let targetAlbum = await prisma.album.findUnique({
      where: {
        name_artistId: {
          name: albumName.trim(),
          artistId: targetArtist.id,
        },
      },
    });

    // If target album doesn't exist, update the current album
    // If it does exist and is different from current, we need to merge
    if (!targetAlbum) {
      // Update the existing album's name and artist
      targetAlbum = await prisma.album.update({
        where: { id },
        data: {
          name: albumName.trim(),
          artistId: targetArtist.id,
        },
      });
    } else if (targetAlbum.id !== id) {
      // Target album exists and is different - move songs to target album
      await prisma.song.updateMany({
        where: { albumId: id },
        data: { albumId: targetAlbum.id },
      });

      // Delete the now-empty original album
      await prisma.album.delete({
        where: { id },
      });
    }

    // Update metadata in audio files
    const songs = await prisma.song.findMany({
      where: { albumId: targetAlbum.id },
    });

    for (const song of songs) {
      const filePath = path.resolve(MUSIC_DIR, song.filePath);
      const ext = path.extname(filePath).toLowerCase();

      if (ext === ".mp3") {
        try {
          const tags: NodeID3.Tags = {
            album: albumName.trim(),
            artist: artistName.trim(),
          };

          NodeID3.update(tags, filePath);
        } catch (err) {
          console.error(`Failed to update tags for ${song.filePath}:`, err);
        }
      } else if (ext === ".wav") {
        writeWavMetadata(filePath, {
          album: albumName.trim(),
          artist: artistName.trim(),
        });
      }
    }

    // Clean up empty albums and artists
    await prisma.album.deleteMany({
      where: { songs: { none: {} } },
    });
    await prisma.artist.deleteMany({
      where: { albums: { none: {} } },
    });

    // Return the updated album with all relations
    const updatedAlbum = await prisma.album.findUnique({
      where: { id: targetAlbum.id },
      include: {
        artist: true,
        songs: {
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
      album: updatedAlbum,
      artist: targetArtist,
    });
  } catch (error) {
    console.error("Error updating album metadata:", error);
    return NextResponse.json(
      { error: "Failed to update album metadata" },
      { status: 500 }
    );
  }
}
