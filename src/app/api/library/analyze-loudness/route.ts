import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { execFile } from "child_process";
import * as path from "path";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";

function getLufs(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    execFile(
      "ffmpeg",
      ["-i", filePath, "-af", "loudnorm=print_format=json", "-f", "null", "-"],
      { timeout: 60000, maxBuffer: 10 * 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (error) {
          resolve(null);
          return;
        }
        const match = stderr.match(/"input_i"\s*:\s*"([-\d.]+)"/);
        if (match) {
          const lufs = parseFloat(match[1]);
          resolve(isFinite(lufs) ? lufs : null);
        } else {
          resolve(null);
        }
      }
    );
  });
}

// Stream progress as Server-Sent Events so the UI stays responsive
export async function POST() {
  const musicPath = path.resolve(MUSIC_DIR);

  // Find all tracks and jam tracks missing LUFS data
  const [tracks, jamTracks] = await Promise.all([
    prisma.track.findMany({
      where: { lufs: null },
      select: { id: true, filePath: true, title: true },
    }),
    prisma.jamTrack.findMany({
      where: { lufs: null },
      select: { id: true, filePath: true, title: true },
    }),
  ]);

  const total = tracks.length + jamTracks.length;

  if (total === 0) {
    return NextResponse.json({ message: "All tracks already analyzed", processed: 0, total: 0 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: "start", total });

      let processed = 0;

      // Process regular tracks
      for (const track of tracks) {
        const fullPath = path.join(musicPath, track.filePath);
        const lufs = await getLufs(fullPath);
        if (lufs !== null) {
          await prisma.track.update({
            where: { id: track.id },
            data: { lufs },
          });
        }
        processed++;
        send({ type: "progress", processed, total, title: track.title, lufs });
      }

      // Process jam tracks
      for (const jt of jamTracks) {
        const fullPath = path.join(musicPath, jt.filePath);
        const lufs = await getLufs(fullPath);
        if (lufs !== null) {
          await prisma.jamTrack.update({
            where: { id: jt.id },
            data: { lufs },
          });
        }
        processed++;
        send({ type: "progress", processed, total, title: jt.title, lufs });
      }

      send({ type: "done", processed, total });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
