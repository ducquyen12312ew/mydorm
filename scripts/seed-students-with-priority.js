/**
 * Seed students with priority scores for allocation testing
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const { StudentCollection } = require('../src/config/config');

const SALT_ROUNDS = 10;
const PASSWORD_PLAIN = 'Passw0rd!';

// Tiêu chí tính priority score
const PRIORITY_CRITERIA = {
    FINANCIAL_HARDSHIP: 30,           // Gia đình khó khăn
    DISTANCE_200KM: 20,               // Nhà xa >200km
    DISTANCE_500KM: 30,               // Nhà xa >500km
    SCHOLARSHIP: 10,                  // Có học bổng
    YEAR_1: 20,                       // Sinh viên năm 1
    NO_VIOLATIONS: 10,                // Không vi phạm
    
    // Negative (giảm điểm)
    HOME_NEAR_50KM: -15,              // Nhà gần <50km
    FAMILY_WEALTHY: -10,              // Gia đình khá giả
    YEAR_4_PLUS: -10,                 // Sinh viên năm 4+
    VIOLATION_HIGH: -20,              // Vi phạm mức cao
    VIOLATION_CRITICAL: -40           // Vi phạm nghiêm trọng
};

// Faculties
const FACULTIES = [
    'Công nghệ thông tin',
    'Cơ khí',
    'Điện - Điện tử',
    'Hóa và Môi trường',
    'Kinh tế và Quản lý',
    'Toán - Tin',
    'Vật lý kỹ thuật'
];

// Provinces with distances
const PROVINCES = [
    { name: 'Hà Nội', distance: 0 },
    { name: 'Hải Phòng', distance: 120 },
    { name: 'Hải Dương', distance: 60 },
    { name: 'Nam Định', distance: 90 },
    { name: 'Thái Bình', distance: 110 },
    { name: 'Nghệ An', distance: 300 },
    { name: 'Thanh Hóa', distance: 200 },
    { name: 'Quảng Ninh', distance: 150 },
    { name: 'Lạng Sơn', distance: 160 },
    { name: 'Hà Giang', distance: 320 },
    { name: 'Cao Bằng', distance: 280 },
    { name: 'Lào Cai', distance: 350 },
    { name: 'Điện Biên', distance: 470 },
    { name: 'Sơn La', distance: 380 },
    { name: 'Hòa Bình', distance: 80 },
    { name: 'Cần Thơ', distance: 1700 },
    { name: 'TP HCM', distance: 1700 },
    { name: 'Đà Nẵng', distance: 800 },
    { name: 'Huế', distance: 700 },
    { name: 'Nha Trang', distance: 1200 }
];

// Utility functions
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function calculatePriorityScore(data) {
    let score = 50; // Base score
    
    // Positive criteria
    if (data.financialHardship) score += PRIORITY_CRITERIA.FINANCIAL_HARDSHIP;
    if (data.distanceFromHome > 500) score += PRIORITY_CRITERIA.DISTANCE_500KM;
    else if (data.distanceFromHome > 200) score += PRIORITY_CRITERIA.DISTANCE_200KM;
    if (data.scholarship) score += PRIORITY_CRITERIA.SCHOLARSHIP;
    if (data.yearGroup === 'year1') score += PRIORITY_CRITERIA.YEAR_1;
    if (data.violationCount === 0) score += PRIORITY_CRITERIA.NO_VIOLATIONS;
    
    // Negative criteria
    if (data.distanceFromHome < 50) score += PRIORITY_CRITERIA.HOME_NEAR_50KM;
    if (data.familyWealth === 'wealthy') score += PRIORITY_CRITERIA.FAMILY_WEALTHY;
    if (data.yearGroup === 'year4_plus') score += PRIORITY_CRITERIA.YEAR_4_PLUS;
    if (data.violationCount > 0) {
        score += PRIORITY_CRITERIA.VIOLATION_HIGH * data.violationCount;
    }

    return Math.max(0, Math.min(100, score)); // Clamp 0-100
}

function determineYearGroup(academicYear) {
    const year = parseInt(academicYear);
    const currentYear = 2026;
    const yearsInSchool = currentYear - year;
    
    if (yearsInSchool <= 1) return 'year1';
    if (yearsInSchool <= 3) return 'year2_3';
    return 'year4_plus';
}

async function generateStudentsWithPriority() {
    try {
        const hashedPassword = await bcrypt.hash(PASSWORD_PLAIN, SALT_ROUNDS);
        const students = [];
        
        // Distribution: 260 students
        const YEAR_DISTRIBUTION = [
            { year: 2025, count: 100, suffixLength: 5 },  // Năm 1 (ưu tiên cao)
            { year: 2024, count: 70,  suffixLength: 5 },  // Năm 2
            { year: 2023, count: 50,  suffixLength: 4 },  // Năm 3
            { year: 2022, count: 25,  suffixLength: 4 },  // Năm 4
            { year: 2021, count: 15,  suffixLength: 4 }   // Năm 5+ (ưu tiên thấp)
        ];
        
        for (const yearConfig of YEAR_DISTRIBUTION) {
            const { year, count, suffixLength } = yearConfig;
            const yearGroup = determineYearGroup(year);
            
            for (let i = 0; i < count; i++) {
                // Generate random suffix
                const min = Math.pow(10, suffixLength - 1);
                const max = Math.pow(10, suffixLength) - 1;
                const suffix = randomInt(min, max);
                const studentId = `${year}${suffix}`;
                
                // Random province
                const province = randomChoice(PROVINCES);
                
                // Priority data based on year group
                const priorityData = {
                    yearGroup,
                    distanceFromHome: province.distance,
                    financialHardship: false,
                    familyWealth: 'average',
                    scholarship: false,
                    violationCount: 0
                };
                
                // Year 1: Higher priority
                if (yearGroup === 'year1') {
                    priorityData.financialHardship = Math.random() > 0.4; // 60% hardship
                    priorityData.scholarship = Math.random() > 0.7; // 30% scholarship
                    priorityData.violationCount = 0; // No violations yet
                }
                // Year 2-3: Medium priority
                else if (yearGroup === 'year2_3') {
                    priorityData.financialHardship = Math.random() > 0.6; // 40% hardship
                    priorityData.scholarship = Math.random() > 0.8; // 20% scholarship
                    priorityData.violationCount = Math.random() > 0.8 ? randomInt(0, 2) : 0;
                    priorityData.familyWealth = Math.random() > 0.85 ? 'wealthy' : 'average';
                }
                // Year 4+: Lower priority
                else {
                    priorityData.financialHardship = Math.random() > 0.7; // 30% hardship
                    priorityData.scholarship = Math.random() > 0.9; // 10% scholarship
                    priorityData.violationCount = Math.random() > 0.7 ? randomInt(0, 3) : 0;
                    priorityData.familyWealth = Math.random() > 0.8 ? 'wealthy' : 'average';
                }
                
                const priorityScore = calculatePriorityScore(priorityData);
                
                const student = {
                    name: `Student ${year}-${String(i + 1).padStart(3, '0')}`,
                    username: `sv${studentId}`,
                    studentId,
                    email: `${studentId}@sis.hust.edu.vn`,
                    phone: `09${randomInt(10000000, 99999999)}`,
                    password: hashedPassword,
                    faculty: randomChoice(FACULTIES),
                    academicYear: year.toString(),
                    gender: i % 2 === 0 ? 'male' : 'female',
                    role: 'user',
                    
                    // Priority-related fields
                    priorityScore,
                    priorityDetails: {
                        yearGroup,
                        distanceFromHome: priorityData.distanceFromHome,
                        province: province.name,
                        financialHardship: priorityData.financialHardship,
                        familyWealth: priorityData.familyWealth,
                        scholarship: priorityData.scholarship,
                        violationCount: priorityData.violationCount
                    },
                    
                    // Supporting documents (mock)
                    supportingDocuments: []
                };
                
                if (priorityData.financialHardship) {
                    student.supportingDocuments.push({
                        type: 'FINANCIAL_HARDSHIP',
                        fileName: `hardship_cert_${studentId}.pdf`,
                        uploadedAt: new Date()
                    });
                }
                
                if (priorityData.distanceFromHome > 200) {
                    student.supportingDocuments.push({
                        type: 'DISTANCE_PROOF',
                        fileName: `distance_proof_${studentId}.pdf`,
                        uploadedAt: new Date()
                    });
                }
                
                students.push(student);
            }
        }
        
        return students;
    } catch (error) {
        console.error('Error generating students:', error);
        throw error;
    }
}

async function seed() {
    try {
        console.log('🌱 Seeding students with priority scores...\n');
        
        const students = await generateStudentsWithPriority();
        
        console.log(`📝 Generated ${students.length} students with priority data`);
        console.log('\n📊 Priority Score Distribution:');
        
        // Stats
        const scoreRanges = {
            'Excellent (80-100)': 0,
            'High (60-79)': 0,
            'Medium (40-59)': 0,
            'Low (20-39)': 0,
            'Very Low (0-19)': 0
        };
        
        students.forEach(s => {
            const score = s.priorityScore;
            if (score >= 80) scoreRanges['Excellent (80-100)']++;
            else if (score >= 60) scoreRanges['High (60-79)']++;
            else if (score >= 40) scoreRanges['Medium (40-59)']++;
            else if (score >= 20) scoreRanges['Low (20-39)']++;
            else scoreRanges['Very Low (0-19)']++;
        });
        
        Object.entries(scoreRanges).forEach(([range, count]) => {
            console.log(`   ${range}: ${count} students`);
        });
        
        // Group by year
        console.log('\n📈 By Academic Year:');
        const byYear = {};
        students.forEach(s => {
            if (!byYear[s.academicYear]) byYear[s.academicYear] = [];
            byYear[s.academicYear].push(s.priorityScore);
        });
        
        Object.entries(byYear).sort().forEach(([year, scores]) => {
            const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
            const min = Math.min(...scores);
            const max = Math.max(...scores);
            console.log(`   ${year}: ${scores.length} students | Avg: ${avg} | Range: ${min}-${max}`);
        });
        
        // Insert to database
        console.log('\n💾 Inserting to database...');
        
        const bulkOps = students.map(student => ({
            updateOne: {
                filter: { studentId: student.studentId },
                update: { $set: student },
                upsert: true
            }
        }));
        
        const result = await StudentCollection.bulkWrite(bulkOps);
        
        console.log(`   ✅ Upserted: ${result.upsertedCount}`);
        console.log(`   ✅ Modified: ${result.modifiedCount}`);
        
        // Show samples
        console.log('\n📋 Sample Students:');
        const samples = students.slice(0, 5);
        samples.forEach(s => {
            console.log(`\n   ${s.studentId} - ${s.name}`);
            console.log(`   Priority: ${s.priorityScore}/100`);
            console.log(`   Year Group: ${s.priorityDetails.yearGroup}`);
            console.log(`   Distance: ${s.priorityDetails.distanceFromHome}km from Hanoi`);
            console.log(`   Financial Hardship: ${s.priorityDetails.financialHardship ? 'Yes' : 'No'}`);
            console.log(`   Scholarship: ${s.priorityDetails.scholarship ? 'Yes' : 'No'}`);
            console.log(`   Violations: ${s.priorityDetails.violationCount}`);
        });
        
        console.log('\n✅ Seeding completed successfully!');
        console.log('\n💡 Next steps:');
        console.log('   1. Create allocation policy');
        console.log('   2. Create registration cycle');
        console.log('   3. Students register with priority scores');
        console.log('   4. Execute allocation (priority-based)');
        console.log('   5. Check allocation dashboard and waitlist');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error seeding:', error);
        process.exit(1);
    }
}

// Run
if (require.main === module) {
    seed();
}

module.exports = { generateStudentsWithPriority, calculatePriorityScore };
