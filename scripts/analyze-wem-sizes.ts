#!/usr/bin/env tsx
/**
 * Analyze WEM file sizes to see if we can match them to songs
 */
import * as path from "path";
import { PSARC } from "../src/lib/rocksmith/psarcParser";

const PSARC_FILE = path.join(__dirname, "..", "rs1compatibilitydisc_p.psarc");

async function main() {
  const psarc = new PSARC(PSARC_FILE);
  await psarc.parse();

  const files = psarc.getFiles();
  const wemFiles = files.filter(f => f.endsWith(".wem"));

  console.log(`Analyzing ${wemFiles.length} .wem files...`);

  // Get sizes of all WEM files
  const wemData: { name: string; size: number }[] = [];
  for (let i = 0; i < files.length; i++) {
    if (files[i].endsWith(".wem")) {
      const data = await psarc.readFile(i);
      wemData.push({ name: files[i], size: data?.length || 0 });
    }
  }

  // Sort by size
  wemData.sort((a, b) => b.size - a.size);

  console.log("\nTop 20 largest .wem files:");
  wemData.slice(0, 20).forEach((w, i) => {
    const sizeMB = (w.size / (1024 * 1024)).toFixed(2);
    console.log(`  ${i + 1}. ${w.name} - ${sizeMB} MB`);
  });

  console.log("\n20 smallest .wem files:");
  wemData.slice(-20).forEach((w, i) => {
    const sizeKB = (w.size / 1024).toFixed(2);
    console.log(`  ${i + 1}. ${w.name} - ${sizeKB} KB`);
  });

  // Check size distribution
  const largeSongs = wemData.filter(w => w.size > 10 * 1024 * 1024); // > 10MB
  const previews = wemData.filter(w => w.size > 1 * 1024 * 1024 && w.size < 10 * 1024 * 1024); // 1-10MB
  const small = wemData.filter(w => w.size < 1 * 1024 * 1024); // < 1MB

  console.log(`\nSize distribution:`);
  console.log(`  Large (>10MB, likely full songs): ${largeSongs.length}`);
  console.log(`  Medium (1-10MB, likely previews): ${previews.length}`);
  console.log(`  Small (<1MB): ${small.length}`);

  console.log(`\nWe have 53 unique songs`);
  console.log(`If each song has 1 full + 1 preview, we'd expect ~53 large and ~53 medium files`);
}

main().catch(console.error);
