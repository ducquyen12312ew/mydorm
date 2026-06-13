/**
 * update-ktx-b2-media.js
 * Updates KTX B2 dormitory with correct thumbnail, video, and full gallery.
 *
 * Thumbnail : e22ca35b-...m4tu8o.png
 * Video     : Ultra_realistic_university_dor_d7emty.mp4
 * Gallery   : 3 ảnh
 *
 * Usage: node scripts/update-ktx-b2-media.js
 */

'use strict';
require('dotenv').config();
const { DormitoryCollection } = require('../src/config/config');

// ─── B2 Media ──────────────────────────────────────────────────────────────
const B2_THUMBNAIL = 'https://res.cloudinary.com/dysgt8t4d/image/upload/v1781103106/e22ca35b-a539-47d5-9d2d-bb51945ba345_m4tu8o.png';
const B2_VIDEO     = 'https://res.cloudinary.com/dysgt8t4d/video/upload/v1781051760/Ultra_realistic_university_dor_d7emty.mp4';
const B2_GALLERY   = [
    'https://res.cloudinary.com/dysgt8t4d/image/upload/v1781103106/e22ca35b-a539-47d5-9d2d-bb51945ba345_m4tu8o.png',
    'https://res.cloudinary.com/dysgt8t4d/image/upload/v1781103106/951abc95-b43e-4ff6-a6f3-7b07786e7bc4_yhvim3.png',
    'https://res.cloudinary.com/dysgt8t4d/image/upload/v1781176046/4a928e90-4fb8-4b4c-be9b-b91d454d2467_yibfor.jpg',
];

async function run() {
    try {
        const all = await DormitoryCollection.find({
            $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
        }).lean();

        const b2 = all.find(d =>
            d.name && (d.name.includes('B2') || d.name.toLowerCase() === 'b2')
        );

        if (!b2) {
            console.error('[ERROR] KTX B2 not found. Available dormitories:');
            all.forEach(d => console.log(`  - "${d.name}" (${d._id})`));
            process.exit(1);
        }

        console.log(`[FOUND] ${b2.name} (${b2._id})`);

        await DormitoryCollection.findByIdAndUpdate(
            b2._id,
            {
                $set: {
                    imageUrl:   B2_THUMBNAIL,
                    coverImage: B2_THUMBNAIL,
                    images:     B2_GALLERY,
                    videos:     [B2_VIDEO],
                    media: [
                        { type: 'image', url: B2_GALLERY[0], thumbnail: B2_THUMBNAIL,  title: 'KTX B2 - Tổng quan' },
                        { type: 'image', url: B2_GALLERY[1], thumbnail: B2_GALLERY[1], title: 'KTX B2 - Khu vực chung' },
                        { type: 'image', url: B2_GALLERY[2], thumbnail: B2_GALLERY[2], title: 'KTX B2 - Không gian ở' },
                        { type: 'video', url: B2_VIDEO,      thumbnail: B2_THUMBNAIL,  title: 'Video giới thiệu KTX B2' },
                    ],
                    virtualTour: '/vr-tour2',
                    updatedAt:  new Date(),
                },
            },
            { new: true }
        );

        console.log('\n[OK] KTX B2 updated:');
        console.log(`  thumbnail : ${B2_THUMBNAIL}`);
        console.log(`  video     : ${B2_VIDEO}`);
        console.log(`  gallery   : ${B2_GALLERY.length} ảnh`);
        B2_GALLERY.forEach((u, i) => console.log(`    [${i + 1}] ${u}`));
        process.exit(0);
    } catch (err) {
        console.error('[ERROR]', err.message);
        process.exit(1);
    }
}

run();
