const mongoose = require('mongoose');
const { StudentCollection, DormitoryCollection } = require('../src/config/config');

async function runMigration() {
    try {
        console.log('Starting database migration...');

        console.log('Adding academicYear field to students...');
        await StudentCollection.updateMany(
            { academicYear: { $exists: false } },
            { $set: { academicYear: 1 } }
        );

        console.log('Adding yearGroup field to students...');
        const students = await StudentCollection.find({});
        for (const student of students) {
            let yearGroup = 1;
            if (student.academicYear === 1) {
                yearGroup = 1;
            } else if (student.academicYear === 2 || student.academicYear === 3) {
                yearGroup = 2;
            } else if (student.academicYear >= 4) {
                yearGroup = 3;
            }
            
            await StudentCollection.updateOne(
                { _id: student._id },
                { $set: { yearGroup: yearGroup } }
            );
        }

        console.log('Adding registrationHistory field to students...');
        await StudentCollection.updateMany(
            { registrationHistory: { $exists: false } },
            { $set: { registrationHistory: [] } }
        );

        console.log('Adding priorityScore field to students...');
        await StudentCollection.updateMany(
            { priorityScore: { $exists: false } },
            { $set: { priorityScore: 0 } }
        );

        console.log('Ensuring roomPreferences structure...');
        await StudentCollection.updateMany(
            { roomPreferences: { $exists: false } },
            { 
                $set: { 
                    roomPreferences: {
                        preferredBuildings: [],
                        preferredFloor: null,
                        preferredRoommates: []
                    }
                }
            }
        );

        console.log('Updating dormitories with gender field...');
        await DormitoryCollection.updateMany(
            { gender: { $exists: false } },
            { $set: { gender: 'mixed' } }
        );

        console.log('Ensuring room capacity tracking...');
        const dormitories = await DormitoryCollection.find({});
        for (const dorm of dormitories) {
            if (dorm.rooms && dorm.rooms.length > 0) {
                const updatedRooms = dorm.rooms.map(room => {
                    if (room.currentOccupancy === undefined) {
                        room.currentOccupancy = 0;
                    }
                    if (room.status === undefined) {
                        room.status = room.currentOccupancy >= room.capacity ? 'full' : 'available';
                    }
                    return room;
                });

                await DormitoryCollection.updateOne(
                    { _id: dorm._id },
                    { $set: { rooms: updatedRooms } }
                );
            }
        }

        console.log('Migration completed successfully!');
        
        const stats = {
            studentsUpdated: await StudentCollection.countDocuments({}),
            dormitoriesUpdated: await DormitoryCollection.countDocuments({})
        };
        
        console.log('Migration statistics:', stats);
        
        return stats;
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
}

runMigration()
    .then((stats) => {
        console.log('Migration finished successfully');
        console.log('Stats:', stats);
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration error:', error);
        process.exit(1);
    });