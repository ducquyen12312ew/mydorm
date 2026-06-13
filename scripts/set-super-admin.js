/**
 * One-time migration: set isSuperAdmin=true for the admin/admin123 account.
 * Run: node scripts/set-super-admin.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { StudentCollection } = require('../src/config/config');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DB_URI);
    console.log('Connected to MongoDB');

    const result = await StudentCollection.updateOne(
        { username: 'admin' },
        { $set: { isSuperAdmin: true } }
    );

    if (result.matchedCount === 0) {
        console.log('No user with username "admin" found. Run create-admin.js first.');
    } else {
        console.log(`Updated: matchedCount=${result.matchedCount}, modifiedCount=${result.modifiedCount}`);
        console.log('admin/admin123 is now Super Admin.');
    }

    await mongoose.disconnect();
    process.exit(0);
}

run().catch(err => {
    console.error(err.message);
    process.exit(1);
});
