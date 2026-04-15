// Rasterize build/icon.svg into all required PNG sizes + Windows ICO.
// Run with: node scripts/build-icons.js
//
// Outputs:
//   build/icon.png    — 512x512 (electron-builder master)
//   build/icon.ico    — multi-resolution (16/24/32/48/64/128/256) for Windows
//   build/icons/*.png — individual sizes (useful for favicons, splash, etc.)

const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico').default || require('png-to-ico');

const SRC = path.join(__dirname, '..', 'build', 'icon.svg');
const OUT_DIR = path.join(__dirname, '..', 'build');
const SIZES_DIR = path.join(OUT_DIR, 'icons');

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const EXTRA_SIZES = [512, 1024]; // for splash / high-DPI displays

(async () => {
  if (!fs.existsSync(SRC)) {
    console.error('❌ Source SVG missing:', SRC);
    process.exit(1);
  }
  if (!fs.existsSync(SIZES_DIR)) fs.mkdirSync(SIZES_DIR, { recursive: true });

  const svg = fs.readFileSync(SRC);
  const allSizes = [...new Set([...ICO_SIZES, ...EXTRA_SIZES])].sort((a, b) => a - b);

  console.log('🎨 Rasterizing icon.svg →', allSizes.join(', '), 'px');

  const bufs = {};
  for (const size of allSizes) {
    // Cap density to keep rasterization under sharp's pixel limit at large sizes.
    const density = Math.min(600, Math.max(72, Math.round(size * 1.5)));
    const png = await sharp(svg, { density })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    bufs[size] = png;
    fs.writeFileSync(path.join(SIZES_DIR, `icon-${size}.png`), png);
  }

  // Master PNG that electron-builder auto-detects
  fs.writeFileSync(path.join(OUT_DIR, 'icon.png'), bufs[512]);
  console.log('✔  build/icon.png (512×512)');

  // Build Windows .ico (multi-resolution)
  const icoBuffers = ICO_SIZES.map(s => bufs[s]);
  const icoBuf = await pngToIco(icoBuffers);
  fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), icoBuf);
  console.log('✔  build/icon.ico (' + ICO_SIZES.join('/') + ')');

  console.log('✅ Done. Sizes:', allSizes.join(', '));
})().catch(err => {
  console.error('💥', err);
  process.exit(1);
});
