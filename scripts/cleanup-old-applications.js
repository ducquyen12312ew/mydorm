const mongoose = require('mongoose');

async function cleanup() {
  try {
    await mongoose.connect('mongodb://0.0.0.0:27017/Dormitory', {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000
    });
    
    const result = await mongoose.connection.collection('pendingapplications').deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} old applications`);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

cleanup();
