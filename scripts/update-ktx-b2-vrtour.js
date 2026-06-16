/**
 * update-ktx-b2-vrtour.js
 * Sets virtualTour = '/vr-tour2' for KTX B2 dormitory.
 * Usage: node scripts/update-ktx-b2-vrtour.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { DormitoryCollection } = require('../src/config/config');

const B2_ID = '6a227b5f41f7bf9ff7935349';

async function run() {
    try {
        const result = await DormitoryCollection.findByIdAndUpdate(
            B2_ID,
            { $set: { virtualTour: '/vr-tour2', updatedAt: new Date() } },
            { new: true }
        );

        if (!result) {
            console.error('KTX B2 not found with id:', B2_ID);
            process.exit(1);
        }

        console.log(`Updated: ${result.name} (${result._id})`);
        console.log(`  virtualTour: ${result.virtualTour}`);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

run();
