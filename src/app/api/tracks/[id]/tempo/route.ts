import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface UpdateTempoBody {
  tempo?: number | null;
  timeSignature?: string;
  playbackSpeed?: number | null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateTempoBody = await request.json();
    const { tempo, timeSignature, playbackSpeed } = body;

    // Validate tempo range if provided
    if (tempo !== null && tempo !== undefined && (tempo < 20 || tempo > 300)) {
      return NextResponse.json(
        { error: "Tempo must be between 20 and 300 BPM" },
        { status: 400 }
      );
    }

    // Validate time signature if provided
    const validTimeSignatures = ["4/4", "3/4", "2/4", "6/8"];
    if (timeSignature && !validTimeSignatures.includes(timeSignature)) {
      return NextResponse.json(
        { error: "Invalid time signature" },
        { status: 400 }
      );
    }

    // Validate playbackSpeed range if provided
    if (playbackSpeed !== null && playbackSpeed !== undefined && (playbackSpeed < 10 || playbackSpeed > 200)) {
      return NextResponse.json(
        { error: "Playback speed must be between 10 and 200%" },
        { status: 400 }
      );
    }

    const updateData: { tempo?: number | null; timeSignature?: string; playbackSpeed?: number | null } = {};
    if (tempo !== undefined) {
      updateData.tempo = tempo;
    }
    if (timeSignature !== undefined) {
      updateData.timeSignature = timeSignature;
    }
    if (playbackSpeed !== undefined) {
      updateData.playbackSpeed = playbackSpeed;
    }

    const updatedTrack = await prisma.track.update({
      where: { id },
      data: updateData,
      include: {
        markers: {
          orderBy: { timestamp: "asc" },
        },
      },
    });

    return NextResponse.json(updatedTrack);
  } catch (error) {
    console.error("Error updating track tempo:", error);
    return NextResponse.json(
      { error: "Failed to update tempo" },
      { status: 500 }
    );
  }
}
