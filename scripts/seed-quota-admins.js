const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { StudentCollection } = require('../src/config/config');

const DEFAULT_PASSWORD = 'admin123';

const QUOTA_ADMINS = [
  {
    name: 'Quota Admin 1',
    username: 'admin1',
    studentId: 'ADMIN001',
    email: 'admin1@gmail.com',
    phone: '0900000001'
  },
  {
    name: 'Quota Admin 2',
    username: 'admin2',
    studentId: 'ADMIN002',
    email: 'admin2@gmail.com',
    phone: '0900000002'
  },
  {
    name: 'Quota Admin 3',
    username: 'admin3',
    studentId: 'ADMIN003',
    email: 'admin3@gmail.com',
    phone: '0900000003'
  }
];

async function seedQuotaAdmins() {
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const admin of QUOTA_ADMINS) {
    const payload = {
      ...admin,
      password: hashedPassword,
      role: 'admin',
      gender: 'other',
      academicYear: '2024',
      updatedAt: new Date()
    };

    await StudentCollection.updateOne(
      { username: admin.username },
      {
        $set: payload,
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    console.log(`Upserted ${admin.username}`);
  }

  console.log('\nSeeded quota admin accounts:');
  console.log('admin1 / admin123');
  console.log('admin2 / admin123');
  console.log('admin3 / admin123');
}

seedQuotaAdmins()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Failed to seed quota admin accounts:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  });
