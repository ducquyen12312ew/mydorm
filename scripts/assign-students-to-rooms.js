/**
 * Script to randomly assign students to available dormitory rooms
 * Ensures room capacity limits are respected
 */

require('dotenv').config();
const { StudentCollection, DormitoryCollection } = require('../src/config/config');

// Utility: Shuffle array (Fisher-Yates algorithm)
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Utility: Get gender from student name or random
function getGenderPreference(student) {
    // If student has gender field, use it
    if (student.gender) {
        return student.gender.toLowerCase();
    }
    // Otherwise random (50/50)
    return Math.random() > 0.5 ? 'male' : 'female';
}

async function assignStudentsToRooms() {
    try {
        console.log('✅ Using existing MongoDB connection');

        // 1. Get all students without room assignment
        const students = await StudentCollection.find({
            roomNumber: { $exists: false }
        }).lean();

        console.log(`\n📊 Found ${students.length} students without room assignments`);

        if (students.length === 0) {
            console.log('✅ All students already have room assignments!');
            return;
        }

        // 2. Get all dormitories with rooms
        const dormitories = await DormitoryCollection.find({
            deleted: { $ne: true }
        });

        if (dormitories.length === 0) {
            console.error('❌ No dormitories found! Please create dormitories first.');
            return;
        }

        console.log(`📋 Found ${dormitories.length} dormitories`);

        // 3. Build available rooms list
        const availableRooms = [];
        let totalCapacity = 0;

        dormitories.forEach(dorm => {
            dorm.floors.forEach(floor => {
                floor.rooms.forEach(room => {
                    const currentOccupants = room.occupants?.filter(o => o.active).length || 0;
                    const availableSpots = room.maxCapacity - currentOccupants;
                    
                    if (availableSpots > 0) {
                        availableRooms.push({
                            dormitoryId: dorm._id,
                            dormitoryName: dorm.name,
                            dormitoryGender: dorm.gender || 'mixed',
                            roomId: room._id,
                            roomNumber: room.roomNumber,
                            roomType: room.roomType,
                            maxCapacity: room.maxCapacity,
                            currentOccupants,
                            availableSpots,
                            floor: floor.floorNumber
                        });
                        totalCapacity += availableSpots;
                    }
                });
            });
        });

        console.log(`\n🏠 Available rooms: ${availableRooms.length}`);
        console.log(`💺 Total available spots: ${totalCapacity}`);

        if (availableRooms.length === 0) {
            console.error('❌ No available rooms! All rooms are full.');
            return;
        }

        if (totalCapacity < students.length) {
            console.warn(`⚠️  Warning: Not enough capacity for all students!`);
            console.warn(`   Students: ${students.length}, Available spots: ${totalCapacity}`);
            console.warn(`   Will assign as many as possible...`);
        }

        // 4. Shuffle students and rooms for randomness
        const shuffledStudents = shuffleArray(students);
        const shuffledRooms = shuffleArray(availableRooms);

        // 5. Assign students to rooms
        let assignedCount = 0;
        let roomIndex = 0;
        const assignments = [];
        const roomOccupantUpdates = {}; // Track occupants to add per room

        for (const student of shuffledStudents) {
            // Find next available room
            let assigned = false;
            let attempts = 0;
            const maxAttempts = availableRooms.length;

            while (!assigned && attempts < maxAttempts) {
                const room = shuffledRooms[roomIndex % shuffledRooms.length];
                
                // Check if room still has spots
                if (room.availableSpots > 0) {
                    // Check gender compatibility (if dorm has gender restriction)
                    const studentGender = getGenderPreference(student);
                    const isCompatible = room.dormitoryGender === 'mixed' || 
                                       room.dormitoryGender === studentGender;

                    if (isCompatible) {
                        // Assign student to room
                        assignments.push({
                            studentId: student.studentId,
                            dormitoryId: room.dormitoryId,
                            dormitoryName: room.dormitoryName,
                            roomNumber: room.roomNumber,
                            roomType: room.roomType
                        });

                        // Track occupant to add
                        const roomKey = `${room.dormitoryId}_${room.roomId}`;
                        if (!roomOccupantUpdates[roomKey]) {
                            roomOccupantUpdates[roomKey] = {
                                dormitoryId: room.dormitoryId,
                                roomId: room.roomId,
                                occupants: []
                            };
                        }
                        roomOccupantUpdates[roomKey].occupants.push({
                            studentId: student.studentId,
                            name: student.name,
                            phone: student.phone || 'N/A',
                            email: student.email || 'N/A',
                            checkInDate: new Date(),
                            active: true
                        });

                        room.availableSpots--;
                        assignedCount++;
                        assigned = true;
                    }
                }

                roomIndex++;
                attempts++;
            }

            if (!assigned) {
                console.log(`⚠️  Could not assign student: ${student.studentId} (${student.name})`);
            }
        }

        console.log(`\n📝 Prepared ${assignedCount} assignments`);

        // 6. Batch update students
        console.log('\n💾 Updating student records...');
        const studentBulkOps = assignments.map(a => ({
            updateOne: {
                filter: { studentId: a.studentId },
                update: {
                    $set: {
                        dormitoryId: a.dormitoryId,
                        roomNumber: a.roomNumber
                    }
                }
            }
        }));

        if (studentBulkOps.length > 0) {
            const studentResult = await StudentCollection.bulkWrite(studentBulkOps);
            console.log(`   ✅ Updated ${studentResult.modifiedCount} student records`);
        }

        // 7. Update dormitory rooms with occupants
        console.log('\n🏠 Updating dormitory rooms...');
        let roomsUpdated = 0;

        for (const [roomKey, update] of Object.entries(roomOccupantUpdates)) {
            const { dormitoryId, roomId, occupants } = update;

            await DormitoryCollection.updateOne(
                {
                    _id: dormitoryId,
                    'floors.rooms._id': roomId
                },
                {
                    $push: {
                        'floors.$[].rooms.$[room].occupants': {
                            $each: occupants
                        }
                    }
                },
                {
                    arrayFilters: [{ 'room._id': roomId }]
                }
            );

            roomsUpdated++;
        }

        console.log(`   ✅ Updated ${roomsUpdated} rooms with occupants`);

        // 8. Print summary
        console.log('\n' + '='.repeat(50));
        console.log('📊 ASSIGNMENT SUMMARY');
        console.log('='.repeat(50));
        console.log(`Total students:          ${students.length}`);
        console.log(`Successfully assigned:   ${assignedCount}`);
        console.log(`Not assigned:            ${students.length - assignedCount}`);
        console.log(`Rooms used:              ${Object.keys(roomOccupantUpdates).length}`);
        console.log('='.repeat(50));

        // 9. Show sample assignments
        console.log('\n📋 Sample assignments (first 10):');
        assignments.slice(0, 10).forEach((a, i) => {
            console.log(`   ${i + 1}. ${a.studentId} → ${a.dormitoryName} - Room ${a.roomNumber} (${a.roomType})`);
        });

        if (assignments.length > 10) {
            console.log(`   ... and ${assignments.length - 10} more`);
        }

        // 10. Show room utilization stats
        console.log('\n📈 Room utilization by type:');
        const roomTypeStats = {};
        Object.values(roomOccupantUpdates).forEach(update => {
            const assignment = assignments.find(a => 
                a.dormitoryId.toString() === update.dormitoryId.toString()
            );
            if (assignment) {
                const type = assignment.roomType;
                if (!roomTypeStats[type]) {
                    roomTypeStats[type] = { count: 0, students: 0 };
                }
                roomTypeStats[type].count++;
                roomTypeStats[type].students += update.occupants.length;
            }
        });

        Object.entries(roomTypeStats).forEach(([type, stats]) => {
            console.log(`   ${type}: ${stats.count} rooms, ${stats.students} students`);
        });

        console.log('\n✅ Room assignment completed!');

    } catch (error) {
        console.error('❌ Error assigning students:', error);
        throw error;
    }
}

// Run the script
if (require.main === module) {
    assignStudentsToRooms()
        .then(() => {
            console.log('\n✨ Script completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Script failed:', error);
            process.exit(1);
        });
}

module.exports = { assignStudentsToRooms };
