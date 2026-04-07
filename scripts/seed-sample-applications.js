/**
 * Generate Sample Applications with Priority Calculation
 * Tạo 20-30 đơn đăng ký mẫu từ sinh viên có sẵn trong database
 * Đa dạng: nhà xa, chính sách ưu tiên, nghèo, khuyết tật, năm 1-4+
 */

const mongoose = require('mongoose');
const { calculatePriorityScore } = require('../src/utils/priorityCalculator');

// Connect to MongoDB
mongoose.connect('mongodb://0.0.0.0:27017/Dormitory', {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
});

// Schema definitions
const StudentSchema = new mongoose.Schema({
    name: String,
    studentId: String,
    email: String,
    phone: String,
    faculty: String,
    academicYear: String,
    gpa: Number,
    distanceFromHome: Number,
    familyWealth: String,
    gender: String
});

const DormitorySchema = new mongoose.Schema({
    name: String,
    floors: [{
        floorNumber: Number,
        rooms: [{
            roomNumber: String,
            roomType: String,
            maxCapacity: Number,
            genderPolicy: String,
            status: String
        }]
    }]
});

const PendingApplicationSchema = new mongoose.Schema({
    studentId: String,
    fullName: String,
    email: String,
    phone: String,
    faculty: String,
    class: String,
    academicYear: String,
    dormitoryId: mongoose.Schema.Types.ObjectId,
    dormitoryName: String,
    roomNumber: String,
    priorityPolicies: mongoose.Schema.Types.Mixed,
    priorityScore: Number,
    priorityBreakdown: mongoose.Schema.Types.Mixed,
    status: String,
    createdAt: Date,
    updatedAt: Date
});

const StudentCollection = mongoose.model('students', StudentSchema);
const DormitoryCollection = mongoose.model('dormitories', DormitorySchema);
const PendingApplicationCollection = mongoose.model('pendingApplications', PendingApplicationSchema);

// Helper functions
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomBoolean(probability = 0.5) {
    return Math.random() < probability;
}

function getYearGroup(studentId) {
    const currentYear = new Date().getFullYear();
    const enrollmentYear = parseInt(studentId.substring(0, 4)) || currentYear;
    const yearsSince = currentYear - enrollmentYear;
    
    if (yearsSince >= 4) return 'year4_plus';
    if (yearsSince >= 2) return 'year2_3';
    return 'year1';
}

function generatePriorityPolicies() {
    const policies = [];
    const types = ['ethnic', 'poor', 'disability', 'orphan'];
    
    // Random 0-3 priority policies
    const numPolicies = randomInt(0, 3);
    const selectedTypes = [];
    
    for (let i = 0; i < numPolicies; i++) {
        const availableTypes = types.filter(t => !selectedTypes.includes(t));
        if (availableTypes.length === 0) break;
        
        const type = randomChoice(availableTypes);
        selectedTypes.push(type);
        
        const policy = { type, proofDocument: `mock-${type}-${Date.now()}.pdf` };
        
        if (type === 'ethnic') {
            const ethnicities = ['Tày', 'Thái', 'Mường', 'Khmer', 'Hoa', 'Nùng', 'H\'Mông'];
            policy.ethnicity = randomChoice(ethnicities);
        }
        
        policies.push(policy);
    }
    
    return policies;
}

function generateDistance() {
    const ranges = [
        { weight: 0.15, min: 0, max: 50 },      // 15% gần nhà
        { weight: 0.20, min: 50, max: 100 },    // 20% 50-100km
        { weight: 0.25, min: 100, max: 200 },   // 25% 100-200km
        { weight: 0.25, min: 200, max: 500 },   // 25% 200-500km
        { weight: 0.15, min: 500, max: 1000 }   // 15% trên 500km
    ];
    
    const rand = Math.random();
    let cumulative = 0;
    
    for (const range of ranges) {
        cumulative += range.weight;
        if (rand <= cumulative) {
            return randomInt(range.min, range.max);
        }
    }
    
    return randomInt(100, 300);
}

function generateGPA() {
    // 10% xuất sắc, 30% giỏi, 40% khá, 20% trung bình
    const rand = Math.random();
    
    if (rand < 0.1) return (3.6 + Math.random() * 0.4).toFixed(2); // 3.6-4.0
    if (rand < 0.4) return (3.2 + Math.random() * 0.4).toFixed(2); // 3.2-3.6
    if (rand < 0.8) return (2.5 + Math.random() * 0.7).toFixed(2); // 2.5-3.2
    return (2.0 + Math.random() * 0.5).toFixed(2); // 2.0-2.5
}

function generateFamilyWealth() {
    const rand = Math.random();
    
    if (rand < 0.30) return 'poor';      // 30% nghèo
    if (rand < 0.85) return 'average';   // 55% trung bình
    return 'wealthy';                     // 15% giàu
}

async function generateSampleApplications() {
    try {
        console.log('🚀 Starting sample applications generation...\n');
        
        // 1. Get students WITHOUT rooms (fresh students only)
        console.log('📚 Fetching students WITHOUT room assignments...');
        const students = await StudentCollection.find({ 
            role: 'user',
            dormitoryId: { $exists: false }  // Only students without rooms
        }).limit(100).lean();
        
        if (students.length === 0) {
            console.log('❌ No students without rooms found!');
            console.log('Please run: node scripts/create-fresh-students.js first');
            process.exit(1);
        }
        
        console.log(`✅ Found ${students.length} students without rooms\n`);
        
        // 2. Get dormitories and rooms
        console.log('🏠 Fetching dormitories...');
        const dormitories = await DormitoryCollection.find().lean();
        
        if (dormitories.length === 0) {
            console.log('❌ No dormitories found!');
            process.exit(1);
        }
        
        console.log(`✅ Found ${dormitories.length} dormitories\n`);
        
        // 3. Clear existing pending applications
        console.log('🗑️  Clearing existing pending applications...');
        await PendingApplicationCollection.deleteMany({});
        console.log('✅ Cleared\n');
        
        // 4. Generate 30 applications
        const numApplications = 30;
        console.log(`📝 Generating ${numApplications} sample applications...\n`);
        
        const selectedStudents = students
            .sort(() => Math.random() - 0.5)
            .slice(0, numApplications);
        
        const applications = [];
        const stats = {
            year1: 0,
            year2_3: 0,
            year4_plus: 0,
            withPriority: 0,
            ethnic: 0,
            poor: 0,
            disability: 0,
            orphan: 0,
            farFromHome: 0,
            highGPA: 0
        };
        
        for (const student of selectedStudents) {
            // Update student info with random data
            const gpa = parseFloat(generateGPA());
            const distanceFromHome = generateDistance();
            const familyWealth = generateFamilyWealth();
            
            await StudentCollection.updateOne(
                { _id: student._id },
                { 
                    $set: { 
                        gpa, 
                        distanceFromHome, 
                        familyWealth 
                    }
                }
            );
            
            // Select random dormitory and room
            const dormitory = randomChoice(dormitories);
            const floor = randomChoice(dormitory.floors);
            
            // Get all rooms, prioritize available ones
            let room = randomChoice(floor.rooms.filter(r => r.status === 'available'));
            if (!room && floor.rooms.length > 0) {
                room = randomChoice(floor.rooms);
            }
            
            if (!room) {
                console.log(`⚠️  No room found for ${student.name}, skipping...`);
                continue;
            }
            
            // Generate priority policies
            const priorityPolicies = generatePriorityPolicies();
            
            // Calculate year group
            const yearGroup = getYearGroup(student.studentId);
            
            // Calculate priority score
            const studentData = {
                priorityPolicies,
                yearGroup,
                gpa,
                violations: [],
                distanceFromHome,
                familyWealth
            };
            
            const priorityResult = calculatePriorityScore(studentData);
            
            // Create application
            const application = {
                studentId: student.studentId,
                fullName: student.name,
                email: student.email,
                phone: student.phone || `09${randomInt(10000000, 99999999)}`,
                faculty: student.faculty || 'Khoa Công nghệ thông tin',
                class: `${yearGroup === 'year1' ? 'K' : 'K'}${new Date().getFullYear() - (yearGroup === 'year1' ? 0 : yearGroup === 'year2_3' ? 2 : 4)}${randomChoice(['A', 'B', 'C'])}`,
                academicYear: student.academicYear || `${new Date().getFullYear()}`,
                dormitoryId: dormitory._id,
                dormitoryName: dormitory.name,
                roomNumber: room.roomNumber,
                priorityPolicies,
                priorityScore: priorityResult.totalScore,
                priorityBreakdown: priorityResult.breakdown,
                status: 'pending',
                createdAt: new Date(Date.now() - randomInt(0, 30) * 24 * 60 * 60 * 1000), // Random date within 30 days
                updatedAt: new Date()
            };
            
            applications.push(application);
            
            // Update stats
            if (yearGroup === 'year1') stats.year1++;
            else if (yearGroup === 'year2_3') stats.year2_3++;
            else stats.year4_plus++;
            
            if (priorityPolicies.length > 0) stats.withPriority++;
            priorityPolicies.forEach(p => {
                if (p.type === 'ethnic') stats.ethnic++;
                if (p.type === 'poor') stats.poor++;
                if (p.type === 'disability') stats.disability++;
                if (p.type === 'orphan') stats.orphan++;
            });
            
            if (distanceFromHome >= 500) stats.farFromHome++;
            if (gpa >= 3.6) stats.highGPA++;
            
            console.log(`✅ ${student.name} (${student.studentId})`);
            console.log(`   📍 ${dormitory.name} - ${room.roomNumber}`);
            console.log(`   🎯 Điểm: ${priorityResult.totalScore}% (${priorityResult.percentage})`);
            console.log(`   📊 Năm: ${yearGroup}, GPA: ${gpa}, Khoảng cách: ${distanceFromHome}km`);
            if (priorityPolicies.length > 0) {
                console.log(`   🏷️  Ưu tiên: ${priorityPolicies.map(p => p.type).join(', ')}`);
            }
            console.log('');
        }
        
        // 5. Insert applications
        console.log('💾 Saving applications to database...');
        await PendingApplicationCollection.insertMany(applications);
        console.log('✅ Saved\n');
        
        // 6. Print summary
        console.log('═══════════════════════════════════════════════════');
        console.log('📊 SUMMARY');
        console.log('═══════════════════════════════════════════════════');
        console.log(`Total applications: ${applications.length}`);
        console.log('');
        console.log('By Year Group:');
        console.log(`  - Year 1: ${stats.year1}`);
        console.log(`  - Year 2-3: ${stats.year2_3}`);
        console.log(`  - Year 4+: ${stats.year4_plus}`);
        console.log('');
        console.log('Priority Policies:');
        console.log(`  - With priority: ${stats.withPriority}`);
        console.log(`  - Ethnic minority: ${stats.ethnic}`);
        console.log(`  - Poor household: ${stats.poor}`);
        console.log(`  - Disability: ${stats.disability}`);
        console.log(`  - Orphan: ${stats.orphan}`);
        console.log('');
        console.log('Other Stats:');
        console.log(`  - Far from home (>500km): ${stats.farFromHome}`);
        console.log(`  - High GPA (≥3.6): ${stats.highGPA}`);
        console.log('');
        console.log('✨ Done! You can now view applications at:');
        console.log('   http://localhost:3000/admin/application');
        console.log('═══════════════════════════════════════════════════\n');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Run
generateSampleApplications();
