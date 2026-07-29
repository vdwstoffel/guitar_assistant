import * as fs from "fs/promises";
import * as path from "path";
import * as mm from "music-metadata";
import { execFile } from "child_process";

const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
export const BACKING_TRACKS_FOLDER = "BackingTracks";
const DOWNLOAD_TIMEOUT_MS = 120_000;

export function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}

export interface DownloadedAudio {
  audioPath: string;
  duration: number;
}

function execFilePromise(
  command: string,
  args: string[],
  options: { timeout?: number } = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: options.timeout, maxBuffer: 10 * 1024 * 1024 },
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

/** Extract a human-readable yt-dlp error line from stderr, else fall back. */
function extractYtDlpError(stderr: string, fallback: string): string {
  const lines = stderr.split("\n").filter((l) => l.startsWith("ERROR:"));
  if (lines.length > 0) return lines[lines.length - 1].replace("ERROR: ", "");
  return stderr.trim().split("\n").filter(Boolean).pop() || fallback;
}

/**
 * Download a YouTube URL's audio as mp3 into music/BackingTracks/<title>/,
 * returning the relative path and parsed duration. Cleans up the folder and
 * re-throws on failure.
 */
export async function downloadBackingTrackAudio(
  youtubeUrl: string,
  title: string,
): Promise<DownloadedAudio> {
  const musicPath = path.resolve(MUSIC_DIR);
  const folderName = sanitizeName(title);
  const trackFolder = path.join(musicPath, BACKING_TRACKS_FOLDER, folderName);
  await fs.mkdir(trackFolder, { recursive: true });

  const fileName = `${sanitizeName(title)}.mp3`;
  const outputPath = path.join(trackFolder, fileName);
  const audioPath = path.join(BACKING_TRACKS_FOLDER, folderName, fileName);

  try {
    await execFilePromise(
      "yt-dlp",
      [
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "-o", outputPath,
        "--no-playlist",
        youtubeUrl,
      ],
      { timeout: DOWNLOAD_TIMEOUT_MS },
    );
    await fs.access(outputPath);
  } catch (err) {
    try {
      await fs.rm(trackFolder, { recursive: true });
    } catch {
      // ignore cleanup errors
    }
    const e = err as Error & { stderr?: string };
    const detail = extractYtDlpError(e.stderr || "", e.message || "download failed");
    const wrapped = new Error(`yt-dlp failed: ${detail}`) as Error & { stderr?: string };
    wrapped.stderr = e.stderr;
    throw wrapped;
  }

  let duration = 0;
  try {
    const metadata = await mm.parseFile(outputPath);
    duration = metadata.format.duration || 0;
  } catch (err) {
    console.error("Error parsing backing-track audio metadata:", err);
  }

  return { audioPath, duration };
}

/** Absolute directory containing a stored audioPath (for deletion). */
export function backingTrackAudioDir(audioPath: string): string {
  return path.dirname(path.resolve(MUSIC_DIR, audioPath));
}
