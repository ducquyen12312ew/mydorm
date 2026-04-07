/**
 * MOCK DATA GENERATOR
 * Creates realistic test data for allocation system testing
 * 
 * Usage: node scripts/generate-mock-allocation-data.js [count] [cycleId]
 * Example: node scripts/generate-mock-allocation-data.js 500
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

// Models
const Student = require('../src/schemas/StudentSchema');
const AllocationRegistration = require('../src/schemas/AllocationRegistrationSchema');
const AllocationCycle = require('../src/schemas/AllocationCycleSchema');
const { logger } = require('../src/config/logger');

// Configuration
const YEAR_GROUPS = ['year1', 'year2', 'year3', 'year4_plus'];
const PRIORITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'SPECIAL'];
const LOCATIONS = [
  'TPHCM', 'Ha Noi', 'Da Nang', 'Can Tho', 'Hai Phong',
  'Vinh', 'Thai Nguyen', 'Thanh Hoa', 'Bac Giang', 'Nam Dinh'
];

const FINANCIAL_TIERS = [
  { tier: 1, probability: 0.10, multiplier: 3.0 }, // Very difficult
  { tier: 2, probability: 0.20, multiplier: 2.0 }, // Difficult
  { tier: 3, probability: 0.40, multiplier: 1.0 }, // Normal
  { tier: 4, probability: 0.30, multiplier: 0.5 }  // Good situation
];

class MockDataGenerator {
  constructor(count = 500) {
    this.count = parseInt(count);
    this.cycleId = null;
    this.generatedData = {
      students: 0,
      registrations: 0,
      errors: 0
    };
  }

  /**
   * Main generation flow
   */
  async generate() {
    try {
      await this.connect();
      console.log(`\n📊 Generating ${this.count} mock allocations...\n`);

      // Ensure cycle exists
      await this.ensureCycle();

      // Generate student data
      const students = await this.generateStudents();
      console.log(`✓ Generated ${students.length} students`);

      // Generate registration data
      const registrations = await this.generateRegistrations(students);
      console.log(`✓ Generated ${registrations.length} registrations`);

      // Summary
      this.printSummary();

      await this.disconnect();
      console.log('\n✅ Mock data generation complete!\n');
    } catch (error) {
      logger.error('Mock data generation failed', { error: error.message });
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }

  async connect() {
    if (mongoose.connection.readyState === 1) {
      return; // Already connected
    }

    const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/dormitory';
    await mongoose.connect(mongoUrl);
    console.log('✓ Connected to MongoDB');
  }

  async disconnect() {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('✓ Disconnected from MongoDB');
    }
  }

  /**
   * Ensure allocation cycle exists
   */
  async ensureCycle() {
    const currentYear = new Date().getFullYear();
    const academicYear = `${currentYear}-${currentYear + 1}`;

    let cycle = await AllocationCycle.findOne({ academicYear }).lean();

    if (!cycle) {
      cycle = await AllocationCycle.create({
        name: `Mock Allocation Cycle ${academicYear}`,
        academicYear,
        status: 'ACTIVE',
        capacitySnapshot: {
          totalRooms: 200,
          totalBeds: 600,
          availableBeds: 500
        }
      });

      console.log(`✓ Created allocation cycle: ${cycle._id}`);
    }

    this.cycleId = cycle._id;
  }

  /**
   * Generate realistic student data
   */
  async generateStudents() {
    const students = [];

    for (let i = 0; i < this.count; i++) {
      const yearGroup = this._randomChoice(YEAR_GROUPS);
      const location = this._randomChoice(LOCATIONS);
      const hasViolations = Math.random() < 0.05; // 5% have violations

      const student = {
        studentId: `K${Math.floor(2024 - Math.random() * 10)}-${String(i + 1).padStart(6, '0')}`,
        name: this._generateName(),
        email: `student${i + 1}@university.edu.vn`,
        phone: this._generatePhone(),
        yearGroup,
        location,
        distance: this._generateDistance(location),
        financialDifficulty: this._generateFinancialDifficulty(),
        priorityLevel: this._generatePriorityLevel(),
        violations: hasViolations ? Math.floor(Math.random() * 3) + 1 : 0,
        registrationDate: this._generateRegistrationDate()
      };

      students.push(student);
    }

    // Batch insert
    try {
      const inserted = await Student.insertMany(students, { ordered: false });
      this.generatedData.students = inserted.length;
      return inserted;
    } catch (error) {
      // Some duplicates might exist - try individual inserts
      let count = 0;
      for (const student of students) {
        try {
          await Student.create(student);
          count++;
        } catch (e) {
          this.generatedData.errors++;
        }
      }
      this.generatedData.students = count;
      return students;
    }
  }

  /**
   * Generate registration records
   */
  async generateRegistrations(students) {
    const registrations = [];

    for (const student of students) {
      // Calculate priority components
      const distanceScore = this._calculateDistanceScore(student.distance);
      const financialScore = this._calculateFinancialScore(student.financialDifficulty);
      const priorityScore = this._calculatePriorityScore(student.priorityLevel);

      // Overall score (0-100)
      const overallScore = (
        distanceScore * 0.35 +
        financialScore * 0.35 +
        priorityScore * 0.30
      );

      const registration = {
        studentId: student._id,
        studentName: student.name,
        studentEmail: student.email,
        allocationCycleId: this.cycleId,
        academicYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
        yearGroup: student.yearGroup,
        registrationTimestamp: student.registrationDate,
        status: 'PENDING', // Will be updated after allocation
        priorityScore: {
          distance: distanceScore,
          financialDifficulty: financialScore,
          priorityLevel: priorityScore,
          totalScore: overallScore
        },
        studentDetails: {
          location: student.location,
          violations: student.violations,
          financialDifficulty: student.financialDifficulty
        }
      };

      registrations.push(registration);
    }

    // Sort by registration time (FIFO is important)
    registrations.sort((a, b) => new Date(a.registrationTimestamp) - new Date(b.registrationTimestamp));

    // Batch insert
    try {
      const inserted = await AllocationRegistration.insertMany(registrations, { ordered: false });
      this.generatedData.registrations = inserted.length;
      return inserted;
    } catch (error) {
      let count = 0;
      for (const registration of registrations) {
        try {
          await AllocationRegistration.create(registration);
          count++;
        } catch (e) {
          this.generatedData.errors++;
        }
      }
      this.generatedData.registrations = count;
      return registrations;
    }
  }

  /**
   * Helper methods for data generation
   */

  _randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  _generateName() {
    const firstNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Dương', 'Bùi'];
    const lastNames = ['Minh', 'Hương', 'Long', 'Linh', 'Tuấn', 'Huệ', 'Đức', 'Khoa'];
    return `${this._randomChoice(firstNames)} ${this._randomChoice(lastNames)}`;
  }

  _generatePhone() {
    return '0' + Math.floor(Math.random() * 900000000 + 100000000);
  }

  _generateDistance(location) {
    // Distance from university in km
    const distances = {
      'TPHCM': () => Math.random() * 50,
      'Ha Noi': () => Math.random() * 40,
      'Da Nang': () => 800 + Math.random() * 200,
      'Can Tho': () => 150 + Math.random() * 100,
      'Hai Phong': () => 100 + Math.random() * 50,
      'Vinh': () => 400 + Math.random() * 100,
      'Thai Nguyen': () => 150 + Math.random() * 50,
      'Thanh Hoa': () => 200 + Math.random() * 50,
      'Bac Giang': () => 80 + Math.random() * 30,
      'Nam Dinh': () => 120 + Math.random() * 40
    };

    const distanceFn = distances[location] || (() => Math.random() * 100);
    return Math.round(distanceFn());
  }

  _generateFinancialDifficulty() {
    const rand = Math.random();
    for (const tier of FINANCIAL_TIERS) {
      if (rand < tier.probability) {
        return tier.tier;
      }
    }
    return 3;
  }

  _generatePriorityLevel() {
    if (Math.random() < 0.05) return 'SPECIAL';
    if (Math.random() < 0.15) return 'HIGH';
    if (Math.random() < 0.35) return 'MEDIUM';
    return 'LOW';
  }

  _generateRegistrationDate() {
    // Registrations spread over 30 days
    const days = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }

  _calculateDistanceScore(distance) {
    // Closer = higher score
    if (distance < 10) return 100;
    if (distance < 50) return 80;
    if (distance < 100) return 60;
    if (distance < 300) return 40;
    if (distance < 600) return 20;
    return 10;
  }

  _calculateFinancialScore(tier) {
    // Higher difficulty = higher score
    const scores = { 1: 100, 2: 75, 3: 50, 4: 25 };
    return scores[tier] || 50;
  }

  _calculatePriorityScore(level) {
    const scores = {
      'SPECIAL': 100,
      'HIGH': 75,
      'MEDIUM': 50,
      'LOW': 25
    };
    return scores[level] || 25;
  }

  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('📈 GENERATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`✓ Students created: ${this.generatedData.students}`);
    console.log(`✓ Registrations created: ${this.generatedData.registrations}`);
    console.log(`⚠️  Errors: ${this.generatedData.errors}`);
    console.log(`📅 Academic Year: ${new Date().getFullYear()}-${new Date().getFullYear() + 1}`);
    console.log(`🔄 Cycle ID: ${this.cycleId}`);
    console.log('\n📊 Allocation Statistics:');
    console.log(`  - Year 1 (50%): ~${Math.round(this.count * 0.50)}`);
    console.log(`  - Year 2 (25%): ~${Math.round(this.count * 0.25)}`);
    console.log(`  - Year 3 (15%): ~${Math.round(this.count * 0.15)}`);
    console.log(`  - Year 4+ (10%): ~${Math.round(this.count * 0.10)}`);
    console.log('='.repeat(50));
  }
}

// Entry point
if (require.main === module) {
  const count = process.argv[2] || 500;
  const generator = new MockDataGenerator(count);
  generator.generate();
}

module.exports = MockDataGenerator;
