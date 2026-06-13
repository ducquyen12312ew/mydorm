/**
 * Seed 20 sample notifications for testing the notification bell.
 * Usage: node scripts/seed-sample-notifications.js [studentEmail]
 * Default targets all users (isGlobal: true)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { NotificationCollection, StudentCollection } = require('../src/config/config');

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/Dormitory';

const NOTIFICATIONS = [
    {
        title: 'Chào mừng đến KTX HUST!',
        message: 'Hệ thống EDorm đã sẵn sàng phục vụ bạn. Hãy kiểm tra trạng thái đăng ký phòng của bạn.',
        type: 'info', priority: 'normal', isGlobal: true, targetRole: 'user',
        daysAgo: 0
    },
    {
        title: 'Mở đăng ký KTX năm học 2025-2026',
        message: 'Hệ thống đăng ký KTX cho năm học 2025-2026 đã mở. Sinh viên có thể nộp đơn đăng ký từ ngày 01/06/2025 đến 30/06/2025.',
        type: 'info', priority: 'high', isGlobal: true, targetRole: 'user',
        daysAgo: 1
    },
    {
        title: 'Nhắc nhở nộp học phí KTX tháng 6',
        message: 'Học phí KTX tháng 6/2025 sẽ đến hạn vào ngày 15/06. Vui lòng nộp đúng hạn để tránh bị trừ điểm ưu tiên.',
        type: 'warning', priority: 'high', isGlobal: true, targetRole: 'user',
        daysAgo: 2
    },
    {
        title: 'Lịch kiểm tra phòng định kỳ tháng 6',
        message: 'Ban quản lý KTX sẽ tiến hành kiểm tra phòng định kỳ vào ngày 20/06/2025. Đề nghị sinh viên giữ phòng sạch sẽ.',
        type: 'info', priority: 'normal', isGlobal: true, targetRole: 'user',
        daysAgo: 3
    },
    {
        title: 'Cúp điện kế hoạch tòa C3',
        message: 'Tòa C3 sẽ bị cúp điện từ 8:00-12:00 ngày 12/06/2025 để bảo trì hệ thống điện. Sinh viên chú ý lưu dữ liệu.',
        type: 'warning', priority: 'normal', isGlobal: true, targetRole: 'user',
        daysAgo: 4
    },
    {
        title: 'Kết quả phân bổ phòng đợt 1',
        message: 'Kết quả phân bổ phòng đợt 1 năm học 2025-2026 đã được công bố. Đăng nhập để xem kết quả của bạn.',
        type: 'success', priority: 'high', isGlobal: true, targetRole: 'user',
        daysAgo: 5
    },
    {
        title: 'Cập nhật nội quy KTX 2025',
        message: 'Nội quy KTX đã được cập nhật cho năm học 2025-2026. Sinh viên vui lòng đọc và tuân thủ nội quy mới.',
        type: 'info', priority: 'normal', isGlobal: true, targetRole: 'user',
        daysAgo: 7
    },
    {
        title: 'Hệ thống WiFi được nâng cấp',
        message: 'Hệ thống WiFi tại tất cả các tòa KTX đã được nâng cấp lên 1Gbps. Tốc độ kết nối sẽ được cải thiện đáng kể.',
        type: 'success', priority: 'normal', isGlobal: true, targetRole: 'user',
        daysAgo: 8
    },
    {
        title: 'Yêu cầu bảo trì đã được tiếp nhận',
        message: 'Yêu cầu sửa chữa điều hòa phòng bạn đã được tiếp nhận và sẽ được xử lý trong 2-3 ngày làm việc.',
        type: 'info', priority: 'normal', isGlobal: true, targetRole: 'user',
        daysAgo: 9
    },
    {
        title: 'Nhắc nhở: Không để xe trong hành lang',
        message: 'Ban quản lý nhắc nhở sinh viên không để xe đạp/xe máy trong hành lang. Vi phạm sẽ bị xử lý theo nội quy.',
        type: 'warning', priority: 'normal', isGlobal: true, targetRole: 'user',
        daysAgo: 10
    },
    {
        title: 'Chương trình khuyến mãi thuê phòng',
        message: 'Sinh viên đăng ký sớm trước 30/06 sẽ được giảm 10% học phí KTX trong tháng đầu tiên. Cơ hội có hạn!',
        type: 'success', priority: 'normal', isGlobal: true, targetRole: 'user',
        daysAgo: 12
    },
    {
        title: 'Lịch dọn vệ sinh định kỳ',
        message: 'Lịch dọn vệ sinh định kỳ khu vực chung tháng 6: mỗi thứ Hai, Tư, Sáu từ 7:00-9:00 sáng.',
        type: 'info', priority: 'low', isGlobal: true, targetRole: 'user',
        daysAgo: 14
    },
    {
        title: 'Thông báo nộp phiếu đánh giá',
        message: 'Sinh viên vui lòng điền phiếu đánh giá chất lượng dịch vụ KTX học kỳ II. Hạn chót: 20/06/2025.',
        type: 'info', priority: 'normal', isGlobal: true, targetRole: 'user',
        daysAgo: 15
    },
    {
        title: 'Cảnh báo an toàn phòng cháy chữa cháy',
        message: 'Nhắc nhở sinh viên tuyệt đối không sử dụng bếp điện trong phòng. Vi phạm sẽ bị xử lý nghiêm theo nội quy.',
        type: 'error', priority: 'high', isGlobal: true, targetRole: 'user',
        daysAgo: 17
    },
    {
        title: 'Đơn đăng ký phòng đã được duyệt',
        message: 'Đơn đăng ký phòng của bạn đã được ban quản lý xét duyệt. Vui lòng đến văn phòng KTX để hoàn thành thủ tục nhận phòng.',
        type: 'success', priority: 'high', isGlobal: true, targetRole: 'user',
        daysAgo: 18
    },
    {
        title: 'Hội thảo hướng dẫn sử dụng hệ thống EDorm',
        message: 'Ban quản lý tổ chức buổi hướng dẫn sử dụng hệ thống EDorm ngày 25/06/2025 lúc 14:00 tại hội trường KTX.',
        type: 'info', priority: 'normal', isGlobal: true, targetRole: 'user',
        daysAgo: 20
    },
    {
        title: 'Kết quả xếp hạng ưu tiên đăng ký phòng',
        message: 'Điểm ưu tiên của bạn đã được tính toán cho kỳ đăng ký mới. Kiểm tra hồ sơ để xem thứ hạng của bạn.',
        type: 'info', priority: 'normal', isGlobal: true, targetRole: 'user',
        daysAgo: 22
    },
    {
        title: 'Bảo trì hệ thống nước nóng tòa A1',
        message: 'Hệ thống nước nóng tòa A1 sẽ tạm ngừng hoạt động từ 6:00-10:00 ngày 08/06/2025 để bảo trì định kỳ.',
        type: 'warning', priority: 'normal', isGlobal: true, targetRole: 'user',
        daysAgo: 23
    },
    {
        title: 'Sinh viên xuất sắc - Học bổng KTX',
        message: '5 suất học bổng miễn phí ở KTX dành cho sinh viên xuất sắc năm học 2024-2025 đang được xét duyệt. Đăng ký trước 10/06.',
        type: 'success', priority: 'normal', isGlobal: true, targetRole: 'user',
        daysAgo: 25
    },
    {
        title: 'Nâng cấp hệ thống EDorm v2.0',
        message: 'Hệ thống EDorm đã được nâng cấp lên phiên bản 2.0 với nhiều tính năng mới: theo dõi phòng realtime, QR check-in, thông báo đẩy.',
        type: 'info', priority: 'normal', isGlobal: true, targetRole: 'user',
        daysAgo: 30
    }
];

async function seed() {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log('Connected to MongoDB');

    // Find a system admin to use as createdBy
    let adminUser = await StudentCollection.findOne({ role: 'admin' });
    if (!adminUser) {
        console.error('No admin user found — cannot seed notifications (createdBy is required)');
        process.exit(1);
    }
    const adminId = adminUser._id;
    console.log(`Using admin: ${adminUser.name} (${adminUser._id})`);

    // Remove old global notifications to avoid duplicates
    const deleted = await NotificationCollection.deleteMany({ isGlobal: true, createdBy: adminId });
    console.log(`Removed ${deleted.deletedCount} old global notifications`);

    let inserted = 0;
    const now = new Date();

    for (const n of NOTIFICATIONS) {
        const createdAt = new Date(now.getTime() - n.daysAgo * 24 * 60 * 60 * 1000);
        await NotificationCollection.create({
            title: n.title,
            message: n.message,
            type: n.type || 'info',
            priority: n.priority || 'normal',
            isGlobal: true,
            targetRole: n.targetRole || 'user',
            createdBy: adminId,
            readBy: [],
            deletedBy: [],
            createdAt
        });
        inserted++;
    }

    console.log(`\nSeeded ${inserted} notifications successfully.`);
    console.log('Students can now see these by logging in and clicking the bell icon.');

    await mongoose.disconnect();
}

seed().catch(e => { console.error('Error:', e.message); process.exit(1); });
