// scripts/seed-notifications.js
// Seed nice demo notifications into the shared `notifications` collection
// (broadcast schema). Cleans up prior test/demo notifications first.
// Run: node scripts/seed-notifications.js
require('dotenv').config();
const mongoose = require('mongoose');
const { NotificationCollection, StudentCollection } = require('../src/config/config');

// Titles this script manages — removed before re-seeding so it's idempotent.
const DEMO_TITLES = [
  '🏠 Thông báo xếp phòng đợt 1/2025',
  '💰 Nhắc nhở đóng phí ký túc xá',
  '🔧 Lịch bảo trì hệ thống nước',
  '📋 Kết quả xét duyệt đơn đăng ký',
  '📢 Thông báo nội quy ký túc xá 2025',
];

function mins(n) { return new Date(Date.now() - n * 60 * 1000); }

async function seed() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const admin = await StudentCollection.findOne({ role: 'admin' }).select('_id').lean();
  if (!admin) throw new Error('No admin found for createdBy');
  const demo = await StudentCollection.findOne({ studentId: '20256868' }).select('_id').lean();
  const readByDemo = demo ? [{ userId: demo._id, readAt: new Date() }] : [];

  // 1) Remove leftover test announcements + previous demo seeds
  const del = await NotificationCollection.deleteMany({
    $or: [
      { title: { $in: DEMO_TITLES } },
      { title: 'Test Production' },
      { message: /Render production server/i },
    ],
  });
  console.log(`Removed ${del.deletedCount} old test/demo notifications`);

  const docs = [
    {
      title: '🏠 Thông báo xếp phòng đợt 1/2025',
      message: 'Ban quản lý ký túc xá thông báo danh sách sinh viên được xếp phòng đợt 1 năm học 2025-2026 đã được công bố. Sinh viên vui lòng kiểm tra thông tin phòng ở trong hệ thống.',
      type: 'info', category: 'allocation', priority: 'high',
      targetRole: 'all', isGlobal: false, readBy: [], createdBy: admin._id, createdAt: mins(30),
    },
    {
      title: '💰 Nhắc nhở đóng phí ký túc xá',
      message: 'Học kỳ 1 năm 2025-2026: Hạn đóng phí ký túc xá là ngày 30/07/2025. Sinh viên chưa đóng phí sẽ mất suất ở. Vui lòng hoàn thành thanh toán đúng hạn.',
      type: 'warning', category: 'payment', priority: 'high',
      targetRole: 'all', isGlobal: false, readBy: [], createdBy: admin._id, createdAt: mins(120),
    },
    {
      title: '🔧 Lịch bảo trì hệ thống nước',
      message: 'Ký túc xá A1 sẽ tạm ngừng cấp nước để bảo trì đường ống từ 8:00 đến 12:00 ngày 20/06/2025. Sinh viên chủ động dự trữ nước sử dụng.',
      type: 'warning', category: 'maintenance', priority: 'normal',
      targetRole: 'all', isGlobal: true, readBy: [], createdBy: admin._id, createdAt: mins(300),
    },
    {
      title: '📋 Kết quả xét duyệt đơn đăng ký',
      message: 'Đơn đăng ký ký túc xá của bạn đã được Ban quản lý xem xét và phê duyệt. Chúc mừng bạn đã được nhận vào ký túc xá HUST. Thông tin chi tiết sẽ được cập nhật sớm.',
      type: 'success', category: 'registration', priority: 'high',
      targetRole: 'all', isGlobal: false, readBy: readByDemo, createdBy: admin._id, createdAt: mins(60 * 24),
    },
    {
      title: '📢 Thông báo nội quy ký túc xá 2025',
      message: 'Ban quản lý ký túc xá thông báo cập nhật nội quy mới áp dụng từ tháng 7/2025. Sinh viên vui lòng đọc kỹ và chấp hành đúng quy định. Tài liệu đầy đủ có tại phòng quản lý.',
      type: 'info', category: 'announcement', priority: 'normal',
      targetRole: 'all', isGlobal: true, readBy: readByDemo, createdBy: admin._id, createdAt: mins(60 * 48),
    },
  ];

  const inserted = await NotificationCollection.insertMany(docs);
  console.log(`\n✅ Seeded ${inserted.length} notifications (3 unread, 2 read for ${demo ? '20256868' : 'nobody'})`);
  await mongoose.disconnect();
}

seed().catch((e) => { console.error(e); process.exit(1); });
