/**
 * Create 100 Fresh Students (without room assignments)
 * Tạo 100 sinh viên mới KHÔNG có phòng
 * Đa dạng: năm 1-4+, GPA, khoảng cách, tài chính
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

// Simple password hash function
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

mongoose.connect('mongodb://0.0.0.0:27017/Dormitory', {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
});

const StudentSchema = new mongoose.Schema({
    name: String,
    username: String,
    studentId: String,
    email: String,
    phone: String,
    password: String,
    faculty: String,
    academicYear: String,
    gender: String,
    role: { type: String, default: 'user' },
    gpa: Number,
    distanceFromHome: Number,
    familyWealth: String,
    dormitoryId: mongoose.Schema.Types.ObjectId,
    roomNumber: String,
    createdAt: Date,
    updatedAt: Date
});

const StudentCollection = mongoose.model('students', StudentSchema);

// Helper functions
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateGPA() {
    const rand = Math.random();
    if (rand < 0.1) return (3.6 + Math.random() * 0.4).toFixed(2); // 10% xuất sắc
    if (rand < 0.4) return (3.2 + Math.random() * 0.4).toFixed(2); // 30% giỏi
    if (rand < 0.8) return (2.5 + Math.random() * 0.7).toFixed(2); // 40% khá
    return (2.0 + Math.random() * 0.5).toFixed(2); // 20% TB
}

function generateDistance() {
    const ranges = [
        { weight: 0.15, min: 0, max: 50 },
        { weight: 0.20, min: 50, max: 100 },
        { weight: 0.25, min: 100, max: 200 },
        { weight: 0.25, min: 200, max: 500 },
        { weight: 0.15, min: 500, max: 1000 }
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

function generateFamilyWealth() {
    const rand = Math.random();
    if (rand < 0.30) return 'poor';
    if (rand < 0.85) return 'average';
    return 'wealthy';
}

const firstNames = ['An', 'Bình', 'Cường', 'Dũng', 'Đức', 'Hải', 'Hoàng', 'Hùng', 'Khoa', 'Kiên', 
                     'Linh', 'Long', 'Minh', 'Nam', 'Phong', 'Quân', 'Quang', 'Thành', 'Trung', 'Tùng'];
const middleNames = ['Văn', 'Thị', 'Đức', 'Ngọc', 'Anh', 'Hồng', 'Thanh', 'Quốc'];
const lastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng'];
const faculties = ['Công nghệ thông tin', 'Điện tử viễn thông', 'Cơ khí', 'Xây dựng', 'Kinh tế', 'Ngoại ngữ'];

async function createFreshStudents() {
    try {
        console.log('🚀 Starting fresh students creation...\n');
        
        // Clear old students without rooms (for testing)
        console.log('🗑️  Clearing old test students (without rooms)...');
        await StudentCollection.deleteMany({ 
            role: 'user',
            dormitoryId: { $exists: false }
        });
        console.log('✅ Cleared\n');
        
        console.log('👥 Creating 100 fresh students...\n');
        
        const students = [];
        const currentYear = new Date().getFullYear();
        const enrollmentYears = [
            { year: currentYear, count: 25 },      // Năm 1: 25%
            { year: currentYear - 1, count: 20 },  // Năm 2: 20%
            { year: currentYear - 2, count: 25 },  // Năm 3: 25%
            { year: currentYear - 3, count: 20 },  // Năm 4: 20%
            { year: currentYear - 4, count: 10 }   // Năm 5+: 10%
        ];
        
        const hashedPassword = hashPassword('123456');
        let studentNumber = 1;
        
        for (const { year, count } of enrollmentYears) {
            for (let i = 0; i < count; i++) {
                const lastName = randomChoice(lastNames);
                const middleName = randomChoice(middleNames);
                const firstName = randomChoice(firstNames);
                const name = `${lastName} ${middleName} ${firstName}`;
                
                const studentId = `${year}${String(studentNumber).padStart(4, '0')}`;
                const username = studentId;
                const email = `${studentId}@student.hust.edu.vn`;
                const phone = `09${randomInt(10000000, 99999999)}`;
                
                const student = {
                    name,
                    username,
                    studentId,
                    email,
                    phone,
                    password: hashedPassword,
                    faculty: randomChoice(faculties),
                    academicYear: `${year}`,
                    gender: randomChoice(['male', 'female']),
                    role: 'user',
                    gpa: parseFloat(generateGPA()),
                    distanceFromHome: generateDistance(),
                    familyWealth: generateFamilyWealth(),
                    // NO dormitoryId - không gán phòng
                    // NO roomNumber
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                
                students.push(student);
                studentNumber++;
                
                if (studentNumber % 20 === 0) {
                    console.log(`✅ Created ${studentNumber}/100 students...`);
                }
            }
        }
        
        console.log('\n💾 Saving to database...');
        await StudentCollection.insertMany(students);
        console.log('✅ Saved\n');
        
        // Statistics
        const stats = {
            year1: students.filter(s => s.academicYear == currentYear).length,
            year2: students.filter(s => s.academicYear == currentYear - 1).length,
            year3: students.filter(s => s.academicYear == currentYear - 2).length,
            year4: students.filter(s => s.academicYear == currentYear - 3).length,
            year5plus: students.filter(s => s.academicYear <= currentYear - 4).length,
            avgGPA: (students.reduce((sum, s) => sum + s.gpa, 0) / students.length).toFixed(2),
            avgDistance: Math.round(students.reduce((sum, s) => sum + s.distanceFromHome, 0) / students.length),
            poor: students.filter(s => s.familyWealth === 'poor').length,
            average: students.filter(s => s.familyWealth === 'average').length,
            wealthy: students.filter(s => s.familyWealth === 'wealthy').length,
            highGPA: students.filter(s => s.gpa >= 3.6).length,
            farFromHome: students.filter(s => s.distanceFromHome >= 500).length
        };
        
        console.log('═══════════════════════════════════════════════════');
        console.log('📊 SUMMARY');
        console.log('═══════════════════════════════════════════════════');
        console.log(`Total students: ${students.length}`);
        console.log('');
        console.log('By Year:');
        console.log(`  - Year 1 (${currentYear}): ${stats.year1}`);
        console.log(`  - Year 2 (${currentYear - 1}): ${stats.year2}`);
        console.log(`  - Year 3 (${currentYear - 2}): ${stats.year3}`);
        console.log(`  - Year 4 (${currentYear - 3}): ${stats.year4}`);
        console.log(`  - Year 5+ (≤${currentYear - 4}): ${stats.year5plus}`);
        console.log('');
        console.log('Academic Stats:');
        console.log(`  - Average GPA: ${stats.avgGPA}`);
        console.log(`  - High GPA (≥3.6): ${stats.highGPA}`);
        console.log('');
        console.log('Family Wealth:');
        console.log(`  - Poor: ${stats.poor}`);
        console.log(`  - Average: ${stats.average}`);
        console.log(`  - Wealthy: ${stats.wealthy}`);
        console.log('');
        console.log('Distance:');
        console.log(`  - Average distance: ${stats.avgDistance}km`);
        console.log(`  - Far from home (>500km): ${stats.farFromHome}`);
        console.log('');
        console.log('✨ Done! Login credentials:');
        console.log('   Username: [studentId] (e.g., 20260001)');
        console.log('   Password: 123456');
        console.log('═══════════════════════════════════════════════════\n');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

createFreshStudents();
