require('dotenv').config();
const mongoose = require('mongoose');
const AcademicPolicyModel = require('../src/schemas/AcademicPolicySchema');

async function seedPolicies() {
  console.log('Starting policy seeding...');
  const currentYear = new Date().getFullYear();
  const academicYear = `${currentYear}-${currentYear + 1}`;

  const existingPolicy = await AcademicPolicyModel.findOne({ academicYear });
  if (existingPolicy) {
    console.log(`Policy for ${academicYear} already exists. Skipping...`);
    return existingPolicy;
  }

  const defaultPolicy = {
    academicYear,
    active: true,
    policies: {
      year1: {
        canChooseRoom: false,
        autoAssign: true,
        allowedBuildings: [],
        priority: 'default',
        description: 'Sinh viên năm 1 được phân phòng tự động theo giới tính và khoa'
      },
      year2_3: {
        canChooseRoom: true,
        autoAssign: false,
        selectionWindow: {
          start: new Date(currentYear, 7, 1),
          end: new Date(currentYear, 8, 15)
        },
        allowedBuildings: [],
        priority: 'medium',
        description: 'Sinh viên năm 2-3 được tự chọn phòng trong khoảng thời gian quy định'
      },
      year4_plus: {
        canChooseRoom: true,
        autoAssign: false,
        allowRoomChange: true,
        selectionWindow: {
          start: new Date(currentYear, 6, 15),
          end: new Date(currentYear, 8, 15)
        },
        allowedBuildings: [],
        priority: 'high',
        description: 'Sinh viên năm cuối có quyền ưu tiên cao nhất, được chọn phòng sớm và có thể đổi phòng'
      }
    },
    notes: 'Chính sách mặc định cho năm học ' + academicYear
  };

  const newPolicy = await AcademicPolicyModel.create(defaultPolicy);
  console.log(`Created policy for ${academicYear}`);

  const lastYear = `${currentYear - 1}-${currentYear}`;
  const lastYearPolicy = await AcademicPolicyModel.findOne({ academicYear: lastYear });

  if (!lastYearPolicy) {
    const lastYearPolicyData = {
      academicYear: lastYear,
      active: false,
      policies: {
        year1: {
          canChooseRoom: false,
          autoAssign: true,
          allowedBuildings: [],
          priority: 'default',
          description: 'Sinh viên năm 1 được phân phòng tự động'
        },
        year2_3: {
          canChooseRoom: true,
          autoAssign: false,
          selectionWindow: {
            start: new Date(currentYear - 1, 7, 1),
            end: new Date(currentYear - 1, 8, 15)
          },
          allowedBuildings: [],
          priority: 'medium',
          description: 'Sinh viên năm 2-3 được tự chọn phòng'
        },
        year4_plus: {
          canChooseRoom: true,
          autoAssign: false,
          allowRoomChange: true,
          selectionWindow: {
            start: new Date(currentYear - 1, 6, 15),
            end: new Date(currentYear - 1, 8, 15)
          },
          allowedBuildings: [],
          priority: 'high',
          description: 'Sinh viên năm cuối có ưu tiên cao'
        }
      },
      notes: 'Chính sách năm học trước (không còn kích hoạt)'
    };

    await AcademicPolicyModel.create(lastYearPolicyData);
    console.log(`Created historical policy for ${lastYear}`);
  }

  console.log('Policy seeding completed successfully!');
  const allPolicies = await AcademicPolicyModel.find({}).sort({ academicYear: -1 });
  console.log(`Total policies in database: ${allPolicies.length}`);

  return newPolicy;
}

async function updatePolicy(academicYear, updates) {
  console.log(`Updating policy for ${academicYear}...`);
  const policy = await AcademicPolicyModel.findOne({ academicYear });
  if (!policy) throw new Error(`Policy for ${academicYear} not found`);

  if (updates.policies) {
    if (updates.policies.year1) Object.assign(policy.policies.year1, updates.policies.year1);
    if (updates.policies.year2_3) Object.assign(policy.policies.year2_3, updates.policies.year2_3);
    if (updates.policies.year4_plus) Object.assign(policy.policies.year4_plus, updates.policies.year4_plus);
  }
  if (typeof updates.active === 'boolean') policy.active = updates.active;
  if (typeof updates.notes === 'string') policy.notes = updates.notes;

  await policy.save();
  console.log('Policy updated successfully');
  return policy;
}

if (require.main === module) {
  const defaultUri = 'mongodb://127.0.0.1:27017/domisys';
  const dbUrl = process.env.MONGODB_URI || defaultUri;

  mongoose.connect(dbUrl, { serverSelectionTimeoutMS: 10000 })
    .then(async () => {
      console.log('Connected to MongoDB:', dbUrl);
      const policy = await seedPolicies();
      console.log('Seeding finished successfully');
      if (policy) console.log('Created policy:', policy.academicYear);
    })
    .catch((error) => {
      console.error('Seeding error:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      try { await mongoose.disconnect(); } catch (_) {}
    });
} else {
  module.exports = { seedPolicies, updatePolicy };
}
