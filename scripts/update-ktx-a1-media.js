/**
 * update-ktx-a1-media.js
 * Updates KTX A1 dormitory with correct thumbnail, video, and gallery.
 *
 * Thumbnail : 01-front_unhrum.png (mặt tiền A1)
 * Video     : gvssl6arhxtdt4s6vv2v.mp4
 * Gallery   : 3 ảnh (front, corner, door)
 *
 * Usage: node scripts/update-ktx-a1-media.js
 */

'use strict';
require('dotenv').config();
const { DormitoryCollection } = require('../src/config/config');

// ─── A1 Media ──────────────────────────────────────────────────────────────
const A1_THUMBNAIL = 'https://res.cloudinary.com/dysgt8t4d/image/upload/v1781175726/01-front_unhrum.png';
const A1_VIDEO     = 'https://res.cloudinary.com/dysgt8t4d/video/upload/v1780934048/ktx-hust/dormitory-videos/gvssl6arhxtdt4s6vv2v.mp4';
const A1_GALLERY   = [
    'https://res.cloudinary.com/dysgt8t4d/image/upload/v1781175726/01-front_unhrum.png',
    'https://res.cloudinary.com/dysgt8t4d/image/upload/v1781175793/07-corner_uj6gfa.png',
    'https://res.cloudinary.com/dysgt8t4d/image/upload/v1781175796/06-door_f8hxgg.png',
];

async function run() {
    try {
        const all = await DormitoryCollection.find({
            $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
        }).lean();

        const a1 = all.find(d =>
            d.name && (d.name.includes('A1') || d.name.toLowerCase() === 'a1')
        );

        if (!a1) {
            console.error('[ERROR] KTX A1 not found. Available dormitories:');
            all.forEach(d => console.log(`  - "${d.name}" (${d._id})`));
            process.exit(1);
        }

        console.log(`[FOUND] ${a1.name} (${a1._id})`);

        await DormitoryCollection.findByIdAndUpdate(
            a1._id,
            {
                $set: {
                    imageUrl:   A1_THUMBNAIL,
                    coverImage: A1_THUMBNAIL,
                    images:     A1_GALLERY,
                    videos:     [A1_VIDEO],
                    media: [
                        { type: 'image', url: A1_GALLERY[0], thumbnail: A1_THUMBNAIL,  title: 'KTX A1 - Mặt tiền' },
                        { type: 'image', url: A1_GALLERY[1], thumbnail: A1_GALLERY[1], title: 'KTX A1 - Góc nhìn' },
                        { type: 'image', url: A1_GALLERY[2], thumbnail: A1_GALLERY[2], title: 'KTX A1 - Cửa vào' },
                        { type: 'video', url: A1_VIDEO,      thumbnail: A1_THUMBNAIL,  title: 'Video giới thiệu KTX A1' },
                    ],
                    virtualTour: '/vr-tour',
                    updatedAt:  new Date(),
                },
            },
            { new: true }
        );

        console.log('\n[OK] KTX A1 updated:');
        console.log(`  thumbnail : ${A1_THUMBNAIL}`);
        console.log(`  video     : ${A1_VIDEO}`);
        console.log(`  gallery   : ${A1_GALLERY.length} ảnh`);
        A1_GALLERY.forEach((u, i) => console.log(`    [${i + 1}] ${u}`));
        process.exit(0);
    } catch (err) {
        console.error('[ERROR]', err.message);
        process.exit(1);
    }
}

run();
