/**
 * Script to check student room assignments
 */

require('dotenv').config();
const { StudentCollection } = require('../src/config/config');

async function checkAssignments() {
    try {
        console.log('🔍 Checking student room assignments...\n');

        // Count students with rooms
        const withRooms = await StudentCollection.countDocuments({
            roomNumber: { $exists: true }
        });

        // Count students without rooms
        const withoutRooms = await StudentCollection.countDocuments({
            roomNumber: { $exists: false }
        });

        console.log('📊 STATISTICS:');
        console.log(`   Students with rooms: ${withRooms}`);
        console.log(`   Students without rooms: ${withoutRooms}`);
        console.log(`   Total: ${withRooms + withoutRooms}\n`);

        // Get sample students with room assignments
        const samples = await StudentCollection.find({
            roomNumber: { $exists: true }
        })
        .limit(10)
        .select('studentId name dormitoryId roomNumber academicYear')
        .lean();

        console.log('📋 SAMPLE ASSIGNMENTS (First 10):');
        samples.forEach((s, i) => {
            console.log(`   ${i + 1}. [${s.academicYear}] ${s.studentId} - ${s.name}`);
            console.log(`      → Room ${s.roomNumber}`);
        });

        // Count by academic year
        const byYear = await StudentCollection.aggregate([
            {
                $match: { roomNumber: { $exists: true } }
            },
            {
                $group: {
                    _id: '$academicYear',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        console.log('\n📈 ASSIGNMENTS BY ACADEMIC YEAR:');
        byYear.forEach(y => {
            console.log(`   ${y._id}: ${y.count} students`);
        });

        console.log('\n✅ Check completed!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkAssignments();
