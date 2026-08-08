import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { watchUrl } from "./youtube";
import { createConcurrencyQueue } from "./queue";
import { retryAsync } from "./retry";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
const VIDEOS_FOLDER = "Videos";
const METADATA_TIMEOUT_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 600_000;
// YouTube intermittently returns HTTP 403 mid-download; a fresh attempt
// usually succeeds, so retry the whole yt-dlp invocation a few times.
const DOWNLOAD_ATTEMPTS = 3;
const RETRY_DELAY_MS = 3_000;

const queue = createConcurrencyQueue(2);

function videosDir(): string {
  return path.join(path.resolve(MUSIC_DIR), VIDEOS_FOLDER);
}

function execFileP(
  command: string,
  args: string[],
  options: { timeout?: number } = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: options.timeout, maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const enriched = error as Error & { stderr?: string };
          enriched.stderr = stderr;
          reject(enriched);
        } else {
          resolve({ stdout, stderr });
        }
      },
    );
  });
}

function extractYtDlpError(err: Error & { stderr?: string }): string {
  const stderrMsg = err.stderr || "";
  const errorLines = stderrMsg.split("\n").filter((l) => l.startsWith("ERROR:"));
  if (errorLines.length > 0) return errorLines[errorLines.length - 1].replace("ERROR: ", "");
  return stderrMsg.trim().split("\n").filter(Boolean).pop() || err.message || "Download failed";
}

async function fetchMetadata(youtubeId: string): Promise<{ title: string; duration: number | null }> {
  const { stdout } = await retryAsync(
    () => execFileP(
      "yt-dlp",
      ["--dump-single-json", "--no-playlist", watchUrl(youtubeId)],
      { timeout: METADATA_TIMEOUT_MS },
    ),
    DOWNLOAD_ATTEMPTS,
    {
      delayMs: RETRY_DELAY_MS,
      onRetry: (err, attempt) =>
        console.warn(`yt-dlp metadata attempt ${attempt} failed for ${youtubeId}, retrying:`, (err as Error).message),
    },
  );
  const json = JSON.parse(stdout) as { title?: string; duration?: number };
  return {
    title: json.title?.trim() || youtubeId,
    duration: typeof json.duration === "number" ? json.duration : null,
  };
}

async function runDownload(videoId: string): Promise<void> {
  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) return;

  await prisma.video.update({
    where: { id: videoId },
    data: { status: "downloading", errorMessage: null },
  });

  const dir = videosDir();
  await fs.mkdir(dir, { recursive: true });

  try {
    const meta = await fetchMetadata(video.youtubeId);
    const outputTemplate = path.join(dir, `${videoId}.%(ext)s`);
    await retryAsync(
      () => execFileP(
        "yt-dlp",
        [
          "-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
          "--merge-output-format", "mp4",
          "--write-thumbnail", "--convert-thumbnails", "jpg",
          // Survive transient network/HTTP errors within a single attempt...
          "--retries", "10",
          "--fragment-retries", "10",
          "--extractor-retries", "3",
          "-o", outputTemplate,
          "--no-playlist",
          watchUrl(video.youtubeId),
        ],
        { timeout: DOWNLOAD_TIMEOUT_MS },
      ),
      // ...and re-run the whole invocation if it still fails (e.g. a hard 403
      // that needs fresh extraction). yt-dlp resumes .part files by default.
      DOWNLOAD_ATTEMPTS,
      {
        delayMs: RETRY_DELAY_MS,
        onRetry: (err, attempt) =>
          console.warn(`yt-dlp download attempt ${attempt} failed for ${videoId}, retrying:`, (err as Error).message),
      },
    );

    const entries = await fs.readdir(dir);
    const mp4 = entries.find((name) => name === `${videoId}.mp4`);
    if (!mp4) throw new Error("Download completed but the MP4 file was not found.");

    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "ready",
        localPath: path.join(VIDEOS_FOLDER, mp4),
        title: meta.title,
        duration: meta.duration,
      },
    });
  } catch (err) {
    const e = err as Error & { stderr?: string };
    console.error(`Download failed for video ${videoId}:`, e.message, e.stderr);
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "failed", errorMessage: extractYtDlpError(e) },
    });
  }
}

// Fire-and-forget: schedule a background download. Never throws to the caller.
export function enqueueDownload(videoId: string): void {
  void queue.add(() => runDownload(videoId)).catch((err) => {
    console.error(`Download job crashed for video ${videoId}:`, err);
  });
}
