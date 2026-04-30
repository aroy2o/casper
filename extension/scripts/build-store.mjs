#!/usr/bin/env node
// Builds the extension and creates a Chrome Web Store-ready ZIP.
// Output: dist-store/casper-extension-v<version>.zip
//
// Run: npm run build:store

import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const outDir = path.join(root, "dist-store");

// Read version from manifest
const manifest = JSON.parse(readFileSync(path.join(root, "manifest.json"), "utf8"));
const version = manifest.version;
const zipName = `casper-extension-v${version}.zip`;
const zipPath = path.join(outDir, zipName);

console.log(`\n🔨  Building CASPER extension v${version}...\n`);

// 1. Generate icons if any PNG is missing
const iconsMissing = [16, 32, 48, 128].some(
  (s) => !existsSync(path.join(root, `public/icons/icon${s}.png`))
);
if (iconsMissing) {
  console.log("🖼   Generating icons...");
  execSync(`node ${path.join(root, "scripts/generate-icons.mjs")}`, { stdio: "inherit" });
}

// 2. Vite build
execSync("npm run build", { cwd: root, stdio: "inherit" });

if (!existsSync(distDir)) {
  console.error("\n❌  dist/ not found after build.");
  process.exit(1);
}

// 3. Create dist-store/ and zip
mkdirSync(outDir, { recursive: true });
execSync(`zip -r "${zipPath}" . -x "*.DS_Store" -x "__MACOSX/*"`, {
  cwd: distDir,
  stdio: "inherit"
});

console.log(`\n✅  Store package ready: dist-store/${zipName}`);
console.log("    Upload this ZIP at: https://chrome.google.com/webstore/devconsole\n");
