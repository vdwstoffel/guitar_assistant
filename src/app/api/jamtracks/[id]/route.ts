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
  inProgress?: boolean;
  favorite?: boolean;
  tempo?: number | null;
  timeSignature?: string;
  playbackSpeed?: number | null;
  volume?: number | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const jamTrack = await prisma.jamTrack.findUnique({
      where: { id },
      include: { markers: { orderBy: { timestamp: "asc" } } },
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
    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.completed !== undefined) {
      updateData.completed = body.completed;
      if (body.completed) updateData.inProgress = false;
    }
    if (body.inProgress !== undefined) {
      updateData.inProgress = body.inProgress;
      if (body.inProgress) updateData.completed = false;
    }
    if (body.favorite !== undefined) updateData.favorite = body.favorite;
    if (body.tempo !== undefined) updateData.tempo = body.tempo;
    if (body.timeSignature !== undefined) updateData.timeSignature = body.timeSignature;
    if (body.playbackSpeed !== undefined) updateData.playbackSpeed = body.playbackSpeed;
    if (body.volume !== undefined) updateData.volume = body.volume;

    if (body.title !== undefined) {
      const jamTrack = await prisma.jamTrack.findUnique({ where: { id } });
      if (jamTrack) {
        const musicPath = path.resolve(MUSIC_DIR);
        const filePath = path.join(musicPath, jamTrack.filePath);
        const ext = path.extname(filePath).toLowerCase();
        if (ext === ".mp3") {
          try {
            NodeID3.update({ title: body.title.trim() }, filePath);
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
      include: { markers: { orderBy: { timestamp: "asc" } } },
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const jamTrack = await prisma.jamTrack.findUnique({ where: { id } });
    if (!jamTrack) {
      return NextResponse.json({ error: "Jam track not found" }, { status: 404 });
    }

    const musicPath = path.resolve(MUSIC_DIR);
    const audioPath = path.join(musicPath, jamTrack.filePath);
    try {
      await fs.unlink(audioPath);
    } catch {
      console.warn(`Could not delete audio file: ${audioPath}`);
    }

    if (jamTrack.gpFilePath) {
      const gpAbsPath = path.join(musicPath, jamTrack.gpFilePath);
      try {
        await fs.unlink(gpAbsPath);
      } catch {
        console.warn(`Could not delete GP file: ${gpAbsPath}`);
      }
    }

    const trackFolder = path.dirname(audioPath);
    try {
      const files = await fs.readdir(trackFolder);
      if (files.length === 0) {
        await fs.rmdir(trackFolder);
      }
    } catch {
      // ignore
    }

    await prisma.jamTrack.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting jam track:", error);
    return NextResponse.json(
      { error: "Failed to delete jam track" },
      { status: 500 }
    );
  }
}
