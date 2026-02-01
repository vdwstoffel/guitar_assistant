import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as path from "path";
import * as fs from "fs/promises";
import NodeID3 from "node-id3";
import { File as TagFile } from "node-taglib-sharp";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

interface UpdateJamTrackBody {
  title?: string;
  completed?: boolean;
  tempo?: number | null;
  timeSignature?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const jamTrack = await prisma.jamTrack.findUnique({
      where: { id },
      include: {
        markers: {
          orderBy: { timestamp: "asc" },
        },
      },
    });

    if (!jamTrack) {
      return NextResponse.json({ error: "Jam track not found" }, { status: 404 });
    }

    return NextResponse.json(jamTrack);
  } catch (error) {
    console.error("Error fetching jam track:", error);
    return NextResponse.json(
      { error: "Failed to fetch jam track" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateJamTrackBody = await request.json();

    const updateData: Partial<UpdateJamTrackBody> = {};

    if (body.title !== undefined) {
      updateData.title = body.title.trim();
    }
    if (body.completed !== undefined) {
      updateData.completed = body.completed;
    }
    if (body.tempo !== undefined) {
      updateData.tempo = body.tempo;
    }
    if (body.timeSignature !== undefined) {
      updateData.timeSignature = body.timeSignature;
    }

    // If title is being updated, write to audio file metadata
    if (body.title !== undefined) {
      const jamTrack = await prisma.jamTrack.findUnique({
        where: { id },
      });

      if (jamTrack) {
        const musicPath = path.resolve(MUSIC_DIR);
        const filePath = path.join(musicPath, jamTrack.filePath);
        const ext = path.extname(filePath).toLowerCase();

        if (ext === ".mp3") {
          try {
            const tags: NodeID3.Tags = {
              title: body.title.trim(),
            };
            NodeID3.update(tags, filePath);
          } catch (err) {
            console.error(`Failed to update mp3 metadata for ${filePath}:`, err);
          }
        } else if (ext === ".m4a") {
          try {
            const tagFile = TagFile.createFromPath(filePath);
            tagFile.tag.title = body.title.trim();
            tagFile.save();
            tagFile.dispose();
          } catch (err) {
            console.error(`Failed to update m4a metadata for ${filePath}:`, err);
          }
        }
      }
    }

    const updatedJamTrack = await prisma.jamTrack.update({
      where: { id },
      data: updateData,
      include: {
        markers: {
          orderBy: { timestamp: "asc" },
        },
      },
    });

    return NextResponse.json(updatedJamTrack);
  } catch (error) {
    console.error("Error updating jam track:", error);
    return NextResponse.json(
      { error: "Failed to update jam track" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const jamTrack = await prisma.jamTrack.findUnique({
      where: { id },
    });

    if (!jamTrack) {
      return NextResponse.json({ error: "Jam track not found" }, { status: 404 });
    }

    // Delete the files from disk
    const musicPath = path.resolve(MUSIC_DIR);
    const audioPath = path.join(musicPath, jamTrack.filePath);

    try {
      await fs.unlink(audioPath);
    } catch {
      console.warn(`Could not delete audio file: ${audioPath}`);
    }

    if (jamTrack.pdfPath) {
      const pdfPath = path.join(musicPath, jamTrack.pdfPath);
      try {
        await fs.unlink(pdfPath);
      } catch {
        console.warn(`Could not delete PDF file: ${pdfPath}`);
      }
    }

    // Try to remove the folder if empty
    const trackFolder = path.dirname(audioPath);
    try {
      const files = await fs.readdir(trackFolder);
      if (files.length === 0) {
        await fs.rmdir(trackFolder);
      }
    } catch {
      // Ignore folder cleanup errors
    }

    // Delete from database
    await prisma.jamTrack.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting jam track:", error);
    return NextResponse.json(
      { error: "Failed to delete jam track" },
      { status: 500 }
    );
  }
}
