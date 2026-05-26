/**
 * Get Active Cycle ID
 * Hiển thị danh sách cycles để lấy ID cho script khác
 */

const mongoose = require('mongoose');
const AllocationCycle = require('../src/schemas/AllocationCycleSchema');

mongoose.connect('mongodb://0.0.0.0:27017/Dormitory', {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
});

async function getActiveCycles() {
  try {
    console.log('\n📋 Danh sách Allocation Cycles:\n');
    
    const cycles = await AllocationCycle.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('policyId'); 
    if (cycles.length === 0) {
      console.log('❌ Không tìm thấy cycle nào. Vui lòng tạo cycle trước!');
      console.log('\nHướng dẫn tạo cycle:');
      console.log('1. Truy cập: http://localhost:3000/admin/allocation/policies');
      console.log('2. Tạo policy mới cho năm học hiện tại');
      console.log('3. Tạo cycle từ policy đó');
      mongoose.connection.close();
      return;
    }

    cycles.forEach((cycle, index) => {
      console.log(`${index + 1}. ${cycle.name}`);
      console.log(`   ID: ${cycle._id}`);
      console.log(`   Năm học: ${cycle.academicYear}`);
      console.log(`   Trạng thái: ${cycle.status}`);
      console.log(`   Đăng ký: ${cycle.registrationStart?.toLocaleDateString('vi-VN')} - ${cycle.registrationEnd?.toLocaleDateString('vi-VN')}`);
      if (cycle.policyId) {
        console.log(`   Policy: ${cycle.policyId.name || cycle.policyId.academicYear}`);
      }
      console.log('');
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 Để tạo đăng ký test, copy ID của cycle và chạy:');
    console.log(`   node scripts/generate-mass-registrations.js "${cycles[0]._id}" 100\n`);

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  } finally {
    mongoose.connection.close();
  }
}

mongoose.connection.once('open', getActiveCycles);
