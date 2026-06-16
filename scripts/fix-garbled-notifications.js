/**
 * Fix garbled Vietnamese encoding in Notification documents.
 * Deletes test/seed notifications with corrupted UTF-8 strings.
 * Run: node scripts/fix-garbled-notifications.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const mongoUri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb://0.0.0.0:27017/Dormitory';

const NotificationSchema = new mongoose.Schema({}, { strict: false });
const Notification = mongoose.model('Notification', NotificationSchema, 'notifications');

// Matches strings with ? replacing Vietnamese diacritics, or UTF-8 mojibake
const GARBLED_PATTERN = /[?]{1,}|[�Ãáàâ]/;

async function run() {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
    console.log('Connected to MongoDB');

    // Find all notifications where title or message looks garbled
    const all = await Notification.find({
        $or: [
            { title: { $regex: '\\?' } },
            { message: { $regex: '\\?' } }
        ]
    }).lean();

    if (all.length === 0) {
        console.log('No garbled notifications found — database looks clean.');
        await mongoose.disconnect();
        return;
    }

    console.log(`Found ${all.length} potentially garbled notifications:`);
    all.forEach(n => console.log(`  [${n._id}] "${n.title}" / "${(n.message||'').slice(0, 60)}"`));

    const ids = all.map(n => n._id);
    const result = await Notification.deleteMany({ _id: { $in: ids } });
    console.log(`Deleted ${result.deletedCount} garbled notification(s).`);

    await mongoose.disconnect();
    console.log('Done.');
}

run().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
