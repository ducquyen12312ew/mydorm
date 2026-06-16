/**
 * generate-pwa-icons.js
 *
 * Tạo các icon PNG cần thiết cho PWA từ file SVG nguồn.
 *
 * Yêu cầu: npm install sharp --save-dev
 * Chạy:    node scripts/generate-pwa-icons.js
 *
 * Output:
 *   public/icons/icon-192.png          — Android / Chrome install
 *   public/icons/icon-512.png          — Android / Chrome splashscreen
 *   public/icons/icon-maskable-512.png — Android adaptive icon
 *   public/icons/apple-touch-icon.png  — iOS home screen (180x180)
 */

'use strict';

const path = require('path');
const fs   = require('fs');

const ROOT     = path.join(__dirname, '..');
const SVG_SRC  = path.join(ROOT, 'public', 'icons', 'icon.svg');
const OUT_DIR  = path.join(ROOT, 'public', 'icons');

async function run() {
    let sharp;
    try {
        sharp = require('sharp');
    } catch {
        console.error('[ERROR] sharp não está instalado.');
        console.error('        Rode: npm install sharp --save-dev');
        process.exit(1);
    }

    if (!fs.existsSync(SVG_SRC)) {
        console.error('[ERROR] SVG source not found:', SVG_SRC);
        process.exit(1);
    }

    const icons = [
        { name: 'icon-192.png',          size: 192, purpose: 'any' },
        { name: 'icon-512.png',          size: 512, purpose: 'any' },
        { name: 'icon-maskable-512.png', size: 512, purpose: 'maskable' },
        { name: 'apple-touch-icon.png',  size: 180, purpose: 'apple' },
    ];

    for (const icon of icons) {
        const dest = path.join(OUT_DIR, icon.name);
        await sharp(SVG_SRC)
            .resize(icon.size, icon.size)
            .png()
            .toFile(dest);
        console.log(`[OK] ${icon.name} (${icon.size}x${icon.size})`);
    }

    console.log('\n[DONE] Tất cả icons đã được tạo tại public/icons/');
    console.log('       Tiếp theo: kiểm tra Lighthouse PWA audit');
}

run().catch(err => {
    console.error('[ERROR]', err.message);
    process.exit(1);
});
