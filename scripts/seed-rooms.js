/**
 * Seed real room data for all dormitories
 * Usage: node scripts/seed-rooms.js
 *
 * This script:
 * 1. Finds all dormitories in the database
 * 2. Creates 10-20 rooms per dormitory across 4 floors
 * 3. Links rooms to dormitories via floors array
 * 4. Updates dormitory metadata (totalFloors, available, priceRange)
 * 5. Ensures mobile API returns populated room data
 */

const { DormitoryCollection } = require('../src/config/config');
require('dotenv').config();

const ROOM_TYPES = ['4-person-service', '8-person', '5-person', '10-person'];
const AMENITIES_OPTIONS = [
  ['WiFi', 'Air Conditioning'],
  ['WiFi', 'Desk', 'Wardrobe'],
  ['WiFi', 'Air Conditioning', 'Balcony'],
  ['WiFi', 'Hot Water', 'Common Kitchen'],
  ['WiFi', 'Desk', 'Shelves'],
];

const ROOM_PRICE_MAP = {
  '4-person-service': 500000,
  '8-person': 350000,
  '5-person': 450000,
  '10-person': 400000
};

const ROOM_CAPACITY_MAP = {
  '4-person-service': 4,
  '8-person': 8,
  '5-person': 5,
  '10-person': 10
};

/**
 * Generate rooms for a specific floor
 */
function generateRoomsForFloor(floorNumber, roomsPerFloor = 5) {
  const rooms = [];
  
  for (let i = 0; i < roomsPerFloor; i++) {
    const roomNumber = `${floorNumber}0${i + 1}`;
    const roomType = ROOM_TYPES[Math.floor(Math.random() * ROOM_TYPES.length)];
    const maxCapacity = ROOM_CAPACITY_MAP[roomType];
    const amenities = AMENITIES_OPTIONS[Math.floor(Math.random() * AMENITIES_OPTIONS.length)];
    
    // Random availability: 60% available, 40% full
    const isAvailable = Math.random() < 0.6;
    const availableBeds = isAvailable ? Math.floor(Math.random() * (maxCapacity - 1)) + 1 : 0;
    
    rooms.push({
      roomNumber,
      roomType,
      maxCapacity,
      floor: floorNumber,
      pricePerMonth: ROOM_PRICE_MAP[roomType],
      amenities,
      description: `${roomType} dormitory room on floor ${floorNumber}`,
      imageUrl: '',
      occupants: [],
      // Virtual fields will be computed by schema
    });
  }
  
  return rooms;
}

/**
 * Generate a complete floors structure for a dormitory
 */
function generateFloorsWithRooms(totalFloors = 4, roomsPerFloor = 5) {
  const floors = [];
  
  for (let floorNum = 1; floorNum <= totalFloors; floorNum++) {
    floors.push({
      floorNumber: floorNum,
      rooms: generateRoomsForFloor(floorNum, roomsPerFloor)
    });
  }
  
  return floors;
}

/**
 * Calculate dormitory metadata from floors
 */
function calculateDormitoryMetadata(floors) {
  let totalRooms = 0;
  let minPrice = Infinity;
  let maxPrice = 0;
  
  (floors || []).forEach(floor => {
    (floor.rooms || []).forEach(room => {
      totalRooms += 1;
      minPrice = Math.min(minPrice, room.pricePerMonth);
      maxPrice = Math.max(maxPrice, room.pricePerMonth);
    });
  });
  
  return {
    totalRooms,
    totalFloors: floors.length,
    priceRange: {
      min: minPrice === Infinity ? 0 : minPrice,
      max: maxPrice === 0 ? 1000000 : maxPrice
    },
    available: totalRooms > 0
  };
}

/**
 * Main seed function
 */
async function seedRooms() {
  try {
    console.log('🌱 Starting room seeding...\n');
    
    // Find all dormitories
    const dormitories = await DormitoryCollection.find({
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
    });
    
    console.log(`📍 Found ${dormitories.length} dormitories\n`);
    
    if (dormitories.length === 0) {
      console.warn('⚠️  No dormitories found. Create dormitories first.');
      process.exit(1);
    }
    
    let totalRoomsCreated = 0;
    let successCount = 0;
    
    // Process each dormitory
    for (const dorm of dormitories) {
      try {
        // Generate rooms: 5 rooms per floor × 4 floors = 20 rooms per dormitory
        const floorsWithRooms = generateFloorsWithRooms(4, 5);
        
        // Calculate metadata
        const metadata = calculateDormitoryMetadata(floorsWithRooms);
        
        // Update dormitory
        const updated = await DormitoryCollection.findByIdAndUpdate(
          dorm._id,
          {
            floors: floorsWithRooms,
            'details.totalFloors': metadata.totalFloors,
            'details.available': metadata.available,
            'details.priceRange': metadata.priceRange,
            updatedAt: new Date()
          },
          { new: true }
        );
        
        const roomCount = metadata.totalRooms;
        totalRoomsCreated += roomCount;
        successCount += 1;
        
        console.log(`✅ ${dorm.name}`);
        console.log(`   📊 Created ${roomCount} rooms across ${metadata.totalFloors} floors`);
        console.log(`   💰 Price range: ${metadata.priceRange.min.toLocaleString()} - ${metadata.priceRange.max.toLocaleString()} VND\n`);
        
      } catch (error) {
        console.error(`❌ Error seeding ${dorm.name}:`, error.message);
      }
    }
    
    console.log('═'.repeat(60));
    console.log(`\n🎉 Seeding complete!\n`);
    console.log(`✅ Successfully updated: ${successCount} dormitories`);
    console.log(`🏠 Total rooms created: ${totalRoomsCreated}`);
    console.log(`📊 Average rooms per dorm: ${Math.round(totalRoomsCreated / successCount)}\n`);
    
    // Verify by fetching one dormitory
    const verifyDorm = await DormitoryCollection.findOne({}).lean();
    if (verifyDorm) {
      console.log('📋 Verification Sample:');
      console.log(`   Dormitory: ${verifyDorm.name}`);
      console.log(`   Total rooms: ${verifyDorm.floors?.reduce((sum, f) => sum + (f.rooms?.length || 0), 0) || 0}`);
      console.log(`   Floors: ${verifyDorm.floors?.length || 0}`);
      
      if (verifyDorm.floors?.[0]?.rooms?.[0]) {
        const sampleRoom = verifyDorm.floors[0].rooms[0];
        console.log(`   Sample room: ${sampleRoom.roomNumber} (${sampleRoom.roomType}, ${sampleRoom.maxCapacity} capacity)\n`);
      }
    }
    
    console.log('✨ API endpoint /api/student-app/public/rooms/explore is now ready!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the seeder
seedRooms();
