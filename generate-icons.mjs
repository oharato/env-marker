import sharp from 'sharp';
import { readFileSync } from 'fs';
import { mkdir } from 'fs/promises';

const sizes = [16, 48, 128];
const svgContent = readFileSync('public/icon.svg');

// Ensure public directory exists
await mkdir('public', { recursive: true });

for (const size of sizes) {
  await sharp(svgContent)
    .resize(size, size)
    .png()
    .toFile(`public/icon${size}.png`);
  
  console.log(`Created public/icon${size}.png`);
}

console.log('\nAll PNG icons created successfully!');
console.log('Update wxt.config.ts to use PNG icons:');
console.log(`
    icons: {
      '16': 'icon16.png',
      '48': 'icon48.png',
      '128': 'icon128.png',
    },
`);
