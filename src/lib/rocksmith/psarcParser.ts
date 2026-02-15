/**
 * Minimal PSARC (PlayStation Archive) parser for Rocksmith files.
 * Based on the PSARC format spec and psarcjs by Sandi Chakravarty (MIT license).
 *
 * Only implements reading/extraction - no packing/writing needed.
 */
import { promises as fs } from "fs";
import * as crypto from "crypto";
import * as zlib from "zlib";

// AES keys for Rocksmith encryption
const ARC_KEY = "C53DB23870A1A2F71CAE64061FDD0E1157309DC85204D4C5BFDF25090DF2572C";
const ARC_IV = "E915AA018FEF71FC508132E4BB4CEB42";
const WIN_KEY =
  "CB648DF3D12A16BF71701414E69619EC171CCA5D2A142E3E59DE7ADDA18A3A30";
const MAC_KEY =
  "9821330E34B91F70D0A48CBD625993126970CEA09192C0E6CDA676CC9838289D";

const BLOCK_SIZE = 65536; // 2^16

interface BOMEntry {
  md5: string;
  zindex: number;
  length: number; // original file length (5 bytes big-endian, we read last 4)
  offset: number; // offset in archive (5 bytes big-endian, we read last 4)
  name: string;
}

interface PSARCHeader {
  magic: string;
  version: number;
  compression: string;
  headerSize: number;
  entrySize: number;
  numEntries: number;
  blockSize: number;
  archiveFlags: number;
}

export interface ArrangementAttributes {
  arrangementName: string;
  songName: string;
  artistName: string;
  albumName: string;
  songYear: number;
  songLength: number;
  songAverageTempo: number;
  tuning: { string0: number; string1: number; string2: number; string3: number; string4: number; string5: number };
  sections: Array<{ name: string; startTime: number; endTime: number }>;
  // The source JSON file path within the archive
  srcJson: string;
  // The persistent ID key
  persistentID: string;
  // Raw attributes for anything we didn't explicitly extract
  raw: Record<string, unknown>;
}

function hexToBytes(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}

function unzipAsync(data: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zlib.unzip(data, (err, buf) => {
      if (err) reject(err);
      else resolve(buf);
    });
  });
}

function pad(buffer: Buffer, blockSize = 16): Buffer {
  const size = ((blockSize - (buffer.length % blockSize)) % blockSize);
  return Buffer.concat([buffer, Buffer.alloc(size)]);
}

function bomDecrypt(buffer: Buffer): Buffer {
  const key = hexToBytes(ARC_KEY);
  const iv = hexToBytes(ARC_IV);
  const decipher = crypto.createDecipheriv("aes-256-cfb", key, iv);
  decipher.setAutoPadding(false);
  return Buffer.concat([decipher.update(pad(buffer)), decipher.final()]);
}

async function entryDecrypt(data: Buffer, key: string): Promise<Buffer> {
  // SNG entry format: magic(4) + platformHeader(4) + iv(16) + encrypted(N) + signature(56)
  const iv = data.subarray(8, 24);
  const encrypted = data.subarray(24, data.length - 56);

  const keyBytes = hexToBytes(key);

  // Use AES-CTR decryption with full 16-byte IV as counter
  const decipher = crypto.createDecipheriv("aes-256-ctr", keyBytes, Buffer.from(iv));
  decipher.setAutoPadding(false);
  const decrypted = Buffer.concat([
    decipher.update(pad(encrypted)),
    decipher.final(),
  ]);

  // First 4 bytes = uncompressed length (LE), rest = zlib data
  const payload = decrypted.subarray(4);
  return unzipAsync(payload);
}

function parseHeader(data: Buffer): PSARCHeader {
  const magic = data.subarray(0, 4).toString("ascii");
  if (magic !== "PSAR") {
    throw new Error(`Not a PSARC file (magic: ${magic})`);
  }
  return {
    magic,
    version: data.readUInt32BE(4),
    compression: data.subarray(8, 12).toString("ascii"),
    headerSize: data.readUInt32BE(12),
    entrySize: data.readUInt32BE(16),
    numEntries: data.readUInt32BE(20),
    blockSize: data.readUInt32BE(24),
    archiveFlags: data.readUInt32BE(28),
  };
}

function parseBOM(
  data: Buffer,
  numEntries: number,
  headerSize: number
): { entries: BOMEntry[]; zLengths: number[] } {
  const entries: BOMEntry[] = [];
  let offset = 0;

  for (let i = 0; i < numEntries; i++) {
    const md5 = data.subarray(offset, offset + 16).toString("hex");
    const zindex = data.readUInt32BE(offset + 16);
    // 5-byte big-endian length and offset (read last 4 bytes as uint32)
    const length = data.readUInt32BE(offset + 21);
    const entryOffset = data.readUInt32BE(offset + 26);
    entries.push({ md5, zindex, length, offset: entryOffset, name: "" });
    offset += 30;
  }

  // Remaining data = zLengths (uint16 big-endian)
  const zLengths: number[] = [];
  while (offset + 1 < data.length) {
    zLengths.push(data.readUInt16BE(offset));
    offset += 2;
  }

  return { entries, zLengths };
}

async function readEntry(
  archiveData: Buffer,
  entry: BOMEntry,
  zLengths: number[]
): Promise<Buffer> {
  let entryOffset = entry.offset;
  const entryLength = entry.length;
  const zl = zLengths.slice(entry.zindex);

  let result = Buffer.alloc(0);
  let totalRead = 0;

  for (let i = 0; i < zl.length; i++) {
    if (totalRead >= entryLength) break;

    const z = zl[i];
    const chunkSize = z === 0 ? BLOCK_SIZE : z;
    const chunk = archiveData.subarray(entryOffset, entryOffset + chunkSize);
    entryOffset += chunkSize;

    let decompressed: Buffer;
    try {
      decompressed = await unzipAsync(chunk);
    } catch {
      // If decompression fails, data is already uncompressed
      decompressed = chunk;
    }

    result = Buffer.concat([result, decompressed]);
    totalRead += decompressed.length;
  }

  return result;
}

export class PSARC {
  private data: Buffer | null = null;
  private header: PSARCHeader | null = null;
  private bomEntries: BOMEntry[] = [];
  private zLengths: number[] = [];
  private listing: string[] = [];

  constructor(private filePath?: string) {}

  /** Parse a PSARC file from path or buffer */
  async parse(buffer?: Buffer): Promise<void> {
    this.data = buffer ?? (await fs.readFile(this.filePath!));

    this.header = parseHeader(this.data);
    const bomRaw = this.data.subarray(32, this.header.headerSize);
    const bomDecrypted = bomDecrypt(pad(bomRaw));
    const bomSliced = bomDecrypted.subarray(0, bomRaw.length);

    const { entries, zLengths } = parseBOM(
      bomSliced,
      this.header.numEntries,
      this.header.headerSize
    );
    this.bomEntries = entries;
    this.zLengths = zLengths;

    // Entry 0 is always the file listing
    const listingData = await readEntry(this.data, this.bomEntries[0], this.zLengths);
    this.listing = decodeURIComponent(listingData.toString()).split("\n").filter(Boolean);

    // Assign names to BOM entries
    this.bomEntries[0].name = "listing";
    for (let i = 0; i < this.listing.length; i++) {
      if (i + 1 < this.bomEntries.length) {
        this.bomEntries[i + 1].name = this.listing[i];
      }
    }
  }

  /** Get all file paths in the archive */
  getFiles(): string[] {
    return this.listing;
  }

  /** Read a file from the archive by its listing index */
  async readFile(listingIndex: number): Promise<Buffer | null> {
    if (!this.data || listingIndex < 0 || listingIndex >= this.listing.length) {
      return null;
    }

    const bomIndex = listingIndex + 1; // BOM entry 0 is the listing itself
    const entry = this.bomEntries[bomIndex];
    const rawData = await readEntry(this.data, entry, this.zLengths);

    // Decrypt SNG files
    const name = this.listing[listingIndex];
    if (name.includes("songs/bin/macos")) {
      return entryDecrypt(rawData, MAC_KEY);
    } else if (name.includes("songs/bin/generic")) {
      return entryDecrypt(rawData, WIN_KEY);
    }

    return rawData;
  }

  /** Extract a file to disk */
  async extractFile(listingIndex: number, outPath: string): Promise<boolean> {
    const data = await this.readFile(listingIndex);
    if (!data) return false;
    await fs.writeFile(outPath, data);
    return true;
  }

  /** Find file index by path pattern */
  findFile(pattern: string | RegExp): number {
    return this.listing.findIndex((f) =>
      typeof pattern === "string" ? f.includes(pattern) : pattern.test(f)
    );
  }

  /** Find all file indices matching a pattern */
  findFiles(pattern: string | RegExp): number[] {
    const indices: number[] = [];
    this.listing.forEach((f, i) => {
      if (typeof pattern === "string" ? f.includes(pattern) : pattern.test(f)) {
        indices.push(i);
      }
    });
    return indices;
  }

  /**
   * Get arrangement metadata from JSON manifest files.
   * Returns a map of persistentID -> arrangement attributes.
   */
  async getArrangements(): Promise<Record<string, ArrangementAttributes>> {
    const arrangements: Record<string, ArrangementAttributes> = {};

    for (let i = 0; i < this.listing.length; i++) {
      const name = this.listing[i];
      if (!name.endsWith(".json")) continue;

      const data = await this.readFile(i);
      if (!data) continue;

      const body = data.toString("utf-8");
      if (!body) continue;

      try {
        const json = JSON.parse(body);
        if (!json.Entries) continue;

        for (const [key, entry] of Object.entries(json.Entries)) {
          const attr = (entry as { Attributes: Record<string, unknown> }).Attributes;
          if (!attr) continue;

          arrangements[key] = {
            arrangementName: String(attr.ArrangementName || ""),
            songName: String(attr.SongName || ""),
            artistName: String(attr.ArtistName || ""),
            albumName: String(attr.AlbumName || ""),
            songYear: Number(attr.SongYear || 0),
            songLength: Number(attr.SongLength || 0),
            songAverageTempo: Number(attr.SongAverageTempo || 0),
            tuning: (attr.Tuning as ArrangementAttributes["tuning"]) || {
              string0: 0, string1: 0, string2: 0,
              string3: 0, string4: 0, string5: 0,
            },
            sections: Array.isArray(attr.Sections)
              ? (attr.Sections as Array<{ Name: string; StartTime: number; EndTime: number }>).map((s) => ({
                  name: s.Name,
                  startTime: s.StartTime,
                  endTime: s.EndTime,
                }))
              : [],
            srcJson: name,
            persistentID: key,
            raw: attr,
          };
        }
      } catch {
        // Skip malformed JSON
      }
    }

    return arrangements;
  }
}
