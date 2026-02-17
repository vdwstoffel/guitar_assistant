#!/usr/bin/env tsx
/**
 * Check JSON manifests for audio file references
 */
import * as path from "path";
import { PSARC } from "../src/lib/rocksmith/psarcParser";

const PSARC_FILE = path.join(__dirname, "..", "rs1compatibilitydisc_p.psarc");

async function main() {
  const psarc = new PSARC(PSARC_FILE);
  await psarc.parse();

  const files = psarc.getFiles();

  // Read the first JSON manifest
  const jsonFiles = files.filter(f => f.endsWith(".json") && f.includes("6amsalvation"));
  console.log("JSON files for '6amsalvation':", jsonFiles);

  for (const jsonFile of jsonFiles.slice(0, 1)) {
    const idx = files.indexOf(jsonFile);
    const data = await psarc.readFile(idx);
    if (!data) continue;

    const json = JSON.parse(data.toString("utf-8"));
    console.log("\nFull JSON structure:");
    console.log(JSON.stringify(json, null, 2));
  }
}

main().catch(console.error);
