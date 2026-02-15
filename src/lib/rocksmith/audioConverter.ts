/**
 * Converts Wwise .wem audio files to .ogg using vgmstream-cli + ffmpeg.
 *
 * Pipeline: .wem → vgmstream-cli → .wav → ffmpeg → .ogg
 *
 * Requirements:
 * - vgmstream-cli (in tools/ or on PATH)
 * - ffmpeg (system install)
 */
import { execFile } from "child_process";
import { promises as fs } from "fs";
import * as path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

function findVgmstream(): string {
  // Check local tools/ directory first, then system PATH
  const localPath = path.join(
    process.cwd(),
    "tools",
    "vgmstream-cli"
  );
  // We'll try local first, fall back to system
  return localPath;
}

/**
 * Convert a .wem buffer to .ogg buffer.
 * Uses temp files since vgmstream-cli and ffmpeg work with files.
 */
export async function convertWemToOgg(
  wemData: Buffer,
  tempDir?: string
): Promise<Buffer> {
  const dir = tempDir || (await fs.mkdtemp("/tmp/wem-convert-"));
  const wemPath = path.join(dir, "input.wem");
  const wavPath = path.join(dir, "output.wav");
  const oggPath = path.join(dir, "output.ogg");

  try {
    await fs.writeFile(wemPath, wemData);

    // Step 1: vgmstream-cli .wem → .wav
    const vgmPath = findVgmstream();
    try {
      await execFileAsync(vgmPath, ["-o", wavPath, wemPath], {
        timeout: 120000,
      });
    } catch {
      // Try system PATH as fallback
      await execFileAsync("vgmstream-cli", ["-o", wavPath, wemPath], {
        timeout: 120000,
      });
    }

    // Step 2: ffmpeg .wav → .ogg (quality 6 ≈ ~192kbps)
    await execFileAsync(
      "ffmpeg",
      ["-y", "-i", wavPath, "-c:a", "libvorbis", "-q:a", "6", oggPath],
      { timeout: 120000 }
    );

    const oggData = await fs.readFile(oggPath);
    return oggData;
  } finally {
    // Clean up temp files
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Determine which .wem file in a PSARC is the full song (not preview).
 * The full song is always the larger .wem file.
 */
export function findFullSongWem(
  wemFiles: { index: number; name: string; size: number }[]
): { index: number; name: string } | null {
  if (wemFiles.length === 0) return null;
  if (wemFiles.length === 1) return wemFiles[0];
  // Largest file is the full song
  return wemFiles.reduce((largest, current) =>
    current.size > largest.size ? current : largest
  );
}
