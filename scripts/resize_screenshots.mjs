#!/usr/bin/env node
import sharp from 'sharp';
import { readdirSync, mkdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';

const args = process.argv.slice(2);
const inputDir = args[0] || 'screenshots';
const outDir = args[1] || 'screenshots/1280x800';
const mode = (args[2] || 'cover').toLowerCase(); // 'cover' or 'contain'

const WIDTH = 1280;
const HEIGHT = 800;

try {
  mkdirSync(outDir, { recursive: true });
} catch (e) {
  // ignore
}

let files = [];
try {
  // Only process files that start with 'screenshot' (case-insensitive)
  // e.g. screenshot.png, screenshot-1.jpg, screenshot_homepage.webp
  files = readdirSync(inputDir).filter(f => /^screenshot.*\.(png|jpe?g|webp)$/i.test(f));
} catch (e) {
  console.error(`Input directory not found: ${inputDir}`);
  process.exit(1);
}

if (files.length === 0) {
  console.log('No image files found in', inputDir);
  process.exit(0);
}

console.log(`Resizing ${files.length} files from ${inputDir} -> ${outDir} as ${WIDTH}x${HEIGHT} (${mode})`);

for (const file of files) {
  const srcPath = join(inputDir, file);
  const base = basename(file, extname(file));
  const outPath = join(outDir, `${base}.png`);

  try {
    const transformer = sharp(srcPath).resize(WIDTH, HEIGHT, {
      fit: mode === 'contain' ? 'contain' : 'cover',
      position: 'centre',
      background: { r: 0, g: 0, b: 0, alpha: 1 }
    }).png();

    await transformer.toFile(outPath);
    const { size } = statSync(outPath);
    console.log(`Created ${outPath} (${Math.round(size/1024)} KB)`);
  } catch (err) {
    console.error(`Failed to process ${file}:`, err.message || err);
  }
}

console.log('Done.');
