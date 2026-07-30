import * as fs from "fs/promises";
import * as path from "path";
import * as mm from "music-metadata";
import { spawn } from "child_process";
import { extractVideoId } from "@/lib/youtube";

export const MUSIC_DIR = process.env.MUSIC_DIR || "./music";
export const BACKING_TRACKS_FOLDER = "BackingTracks";
const DOWNLOAD_TIMEOUT_MS = 180_000;

export function sanitizeName(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*]/g, "_").trim().replace(/^\.+$/, "_");
  return cleaned || "_";
}

export interface DownloadedAudio {
  audioPath: string;
  duration: number;
}

/** Which stage of the download the progress event describes. */
export type DownloadPhase = "downloading" | "converting";

export interface DownloadProgress {
  /** 0–100 while downloading; null once the download hands off to ffmpeg conversion. */
  percent: number | null;
  phase: DownloadPhase;
}

export type OnDownloadProgress = (progress: DownloadProgress) => void;

/** Extract a human-readable yt-dlp error line from stderr, else fall back. */
function extractYtDlpError(stderr: string, fallback: string): string {
  const lines = stderr.split("\n").filter((l) => l.startsWith("ERROR:"));
  if (lines.length > 0) return lines[lines.length - 1].replace("ERROR: ", "");
  return stderr.trim().split("\n").filter(Boolean).pop() || fallback;
}

/**
 * Spawn yt-dlp and stream its progress. Resolves on exit code 0, rejects
 * (with `.stderr`) otherwise. Emits `downloading` percent updates parsed from
 * the progress template, then a `converting` event when ffmpeg extraction begins.
 */
function spawnDownload(
  args: string[],
  onProgress?: OnDownloadProgress,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("yt-dlp", args);
    let stderr = "";
    let stdoutBuf = "";
    let timedOut = false;
    let sawConverting = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, DOWNLOAD_TIMEOUT_MS);

    const handleLine = (line: string) => {
      if (line.startsWith("PROGRESS:")) {
        const raw = line.slice("PROGRESS:".length).replace("%", "").trim();
        const pct = parseFloat(raw);
        if (!Number.isNaN(pct)) {
          onProgress?.({ percent: Math.min(100, Math.max(0, pct)), phase: "downloading" });
        }
      } else if (!sawConverting && (line.includes("[ExtractAudio]") || line.includes("[ffmpeg]"))) {
        sawConverting = true;
        onProgress?.({ percent: null, phase: "converting" });
      }
    };

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      let idx: number;
      while ((idx = stdoutBuf.indexOf("\n")) >= 0) {
        handleLine(stdoutBuf.slice(0, idx).trim());
        stdoutBuf = stdoutBuf.slice(idx + 1);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    child.on("error", (err) => {
      clearTimeout(timer);
      const e = err as Error & { stderr?: string };
      e.stderr = stderr;
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error("Download timed out"));
      } else if (code === 0) {
        resolve();
      } else {
        const e = new Error(`yt-dlp exited with code ${code}`) as Error & { stderr?: string };
        e.stderr = stderr;
        reject(e);
      }
    });
  });
}

/**
 * Download a YouTube URL's audio as mp3 into music/BackingTracks/<title>-<videoId>/,
 * returning the relative path and parsed duration. Cleans up the folder and
 * re-throws on failure. Pass `onProgress` to receive live download/convert progress.
 */
export async function downloadBackingTrackAudio(
  youtubeUrl: string,
  title: string,
  onProgress?: OnDownloadProgress,
): Promise<DownloadedAudio> {
  const musicPath = path.resolve(MUSIC_DIR);
  const videoId = extractVideoId(youtubeUrl);
  const folderName = `${sanitizeName(title)}-${videoId ?? "track"}`;
  const trackFolder = path.join(musicPath, BACKING_TRACKS_FOLDER, folderName);
  await fs.mkdir(trackFolder, { recursive: true });

  const fileName = `${folderName}.mp3`;
  const outputPath = path.join(trackFolder, fileName);
  const audioPath = path.join(BACKING_TRACKS_FOLDER, folderName, fileName);

  try {
    await spawnDownload(
      [
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "-o", outputPath,
        "--no-playlist",
        "--newline",
        "--progress-template", "PROGRESS:%(progress._percent_str)s",
        youtubeUrl,
      ],
      onProgress,
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
  const resolvedDir = path.dirname(path.resolve(MUSIC_DIR, audioPath));
  const backingTracksRoot = path.resolve(MUSIC_DIR, BACKING_TRACKS_FOLDER);
  const musicRoot = path.resolve(MUSIC_DIR);
  // Containment check: dir must be inside the BackingTracks subtree, not the music root itself
  if (resolvedDir !== backingTracksRoot && !resolvedDir.startsWith(backingTracksRoot + path.sep)) {
    throw new Error(`Refusing to delete outside music tree: ${resolvedDir}`);
  }
  if (!resolvedDir.startsWith(musicRoot + path.sep) && resolvedDir !== musicRoot) {
    throw new Error(`Refusing to delete outside music dir: ${resolvedDir}`);
  }
  return resolvedDir;
}
