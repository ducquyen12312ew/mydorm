// scripts/process-icons.js — resize downloaded brand assets to required sizes
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ASSETS = path.join(__dirname, '..', 'assets');
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

async function run() {
  // 1. icon.png — 1024x1024, có nền (launcher icon chính)
  await sharp(`${ASSETS}/icon.png`)
    .resize(1024, 1024, { fit: 'contain', background: '#d63031' })
    .png()
    .toFile(`${ASSETS}/icon_out.png`);
  fs.renameSync(`${ASSETS}/icon_out.png`, `${ASSETS}/icon.png`);
  console.log('✓ icon.png 1024x1024');

  // 2. adaptive-icon.png — foreground 1024x1024 KHÔNG NỀN
  await sharp(`${ASSETS}/logo-transparent.png`)
    .resize(1024, 1024, { fit: 'contain', background: transparent })
    .png()
    .toFile(`${ASSETS}/adaptive-icon_out.png`);
  fs.renameSync(`${ASSETS}/adaptive-icon_out.png`, `${ASSETS}/adaptive-icon.png`);
  console.log('✓ adaptive-icon.png 1024x1024 transparent');

  // 3. favicon.png — 48x48 logo transparent
  await sharp(`${ASSETS}/logo-transparent.png`)
    .resize(48, 48, { fit: 'contain', background: transparent })
    .png()
    .toFile(`${ASSETS}/favicon_out.png`);
  fs.renameSync(`${ASSETS}/favicon_out.png`, `${ASSETS}/favicon.png`);
  console.log('✓ favicon.png 48x48');

  // 4. notification-icon.png — 96x96 logo transparent
  await sharp(`${ASSETS}/logo-transparent.png`)
    .resize(96, 96, { fit: 'contain', background: transparent })
    .png()
    .toFile(`${ASSETS}/notification-icon_out.png`);
  fs.renameSync(`${ASSETS}/notification-icon_out.png`, `${ASSETS}/notification-icon.png`);
  console.log('✓ notification-icon.png 96x96');

  // 5. splash.png — 1284x2778 (màn hình chờ)
  await sharp(`${ASSETS}/icon.png`)
    .resize(1284, 2778, { fit: 'contain', background: '#d63031' })
    .png()
    .toFile(`${ASSETS}/splash_out.png`);
  fs.renameSync(`${ASSETS}/splash_out.png`, `${ASSETS}/splash.png`);
  console.log('✓ splash.png 1284x2778');

  console.log('\n✅ Tất cả icon đã xử lý xong!');
}

run().catch((e) => { console.error(e); process.exit(1); });
