#!/usr/bin/env node
// Regenerates PNG icons from public/icons/icon.svg using ImageMagick (magick).
// Run: node scripts/generate-icons.mjs

import { execSync } from "child_process";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const svg = path.join(root, "public/icons/icon.svg");

if (!existsSync(svg)) {
  console.error("❌  public/icons/icon.svg not found");
  process.exit(1);
}

const hasMagick = (() => {
  try { execSync("magick --version", { stdio: "ignore" }); return true; } catch { return false; }
})();
const cmd = hasMagick ? "magick" : "convert"; // fallback to legacy convert

const sizes = [16, 32, 48, 128];
for (const size of sizes) {
  const out = path.join(root, `public/icons/icon${size}.png`);
  execSync(`${cmd} "${svg}" -resize ${size}x${size} "${out}"`);
  console.log(`✓  icon${size}.png`);
}
console.log("Icons generated.");
