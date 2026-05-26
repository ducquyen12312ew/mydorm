const mongoose = require('mongoose');
require('dotenv').config();
const { PendingApplicationCollection } = require('./src/config/config');

async function checkDatabase() {
    try {
        console.log('Connecting to MongoDB...');
        
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected successfully');
        
        // Count all applications
        const totalCount = await PendingApplicationCollection.countDocuments();
        console.log(`\nTotal pending applications: ${totalCount}`);
        
        // Get first few applications
        const apps = await PendingApplicationCollection.find({}).limit(5);
        console.log(`\nFirst 5 applications:`);
        apps.forEach((app, idx) => {
            console.log(`${idx + 1}. ID: ${app._id}, Student: ${app.fullName || 'N/A'}, Status: ${app.status}`);
        });
        
        // Count by status
        const stats = await PendingApplicationCollection.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);
        
        console.log(`\nApplications by status:`);
        stats.forEach(stat => {
            console.log(`  ${stat._id || 'unknown'}: ${stat.count}`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

checkDatabase();
