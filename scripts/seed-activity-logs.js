/**
 * Seed 200+ realistic activity log entries.
 * Usage: node scripts/seed-activity-logs.js
 *
 * NOTE: The ActivityLog schema in config.js has a strict enum for action.
 * Valid values: 'register_success', 'register_failed', 'payment_success',
 *   'payment_failed', 'room_assigned', 'room_changed', 'profile_updated',
 *   'login', 'logout', 'application_approved', 'application_rejected',
 *   'password_changed', 'registration_approved', 'registration_rejected'
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { ActivityLogCollection, StudentCollection } = require('../src/config/config');

const FAMILY_NAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ'];
const GIVEN_NAMES  = ['Nam', 'Hưng', 'Linh', 'Anh', 'Thảo', 'Minh', 'Phương', 'Tuấn', 'Đức', 'Mai', 'Lan', 'Tùng'];

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomName() { return `${randomChoice(FAMILY_NAMES)} Văn ${randomChoice(GIVEN_NAMES)}`; }

function randomIP() {
    const pools = [
        `118.69.${randomInt(1, 254)}.${randomInt(1, 254)}`,
        `10.0.${randomInt(0, 5)}.${randomInt(1, 254)}`,
        `192.168.1.${randomInt(1, 254)}`,
        `171.244.${randomInt(1, 254)}.${randomInt(1, 254)}`,
    ];
    return randomChoice(pools);
}

function randomUA() {
    const uas = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Firefox/125.0',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile Safari/604.1',
    ];
    return randomChoice(uas);
}

function randomDateInLastDays(days) {
    const now = Date.now();
    const offset = randomInt(0, days * 24 * 60 * 60 * 1000);
    return new Date(now - offset);
}

const ACTION_CONFIGS = [
    {
        action: 'login',
        module: 'auth',
        descFn: (name) => `Sinh viên ${name} đăng nhập vào hệ thống`,
        detailsFn: (name, sid, ip) => ({ studentName: name, studentId: sid, ip, event: 'login' }),
    },
    {
        action: 'logout',
        module: 'auth',
        descFn: (name) => `Sinh viên ${name} đăng xuất khỏi hệ thống`,
        detailsFn: (name, sid) => ({ studentName: name, studentId: sid }),
    },
    {
        action: 'register_success',
        module: 'registration',
        descFn: (name) => `Sinh viên ${name} đăng ký phòng KTX thành công`,
        detailsFn: (name, sid) => ({ studentName: name, studentId: sid, dormitory: `KTX C${randomInt(1,7)}`, room: `P${randomInt(1,6)}${randomInt(1,9).toString().padStart(2,'0')}` }),
    },
    {
        action: 'register_failed',
        module: 'registration',
        descFn: (name) => `Sinh viên ${name} đăng ký phòng thất bại (phòng đã đầy)`,
        detailsFn: (name, sid) => ({ studentName: name, studentId: sid, reason: 'Phòng đã đủ người' }),
    },
    {
        action: 'room_assigned',
        module: 'allocation',
        descFn: (name) => `Phân phòng cho sinh viên ${name} qua hệ thống phân bổ tự động`,
        detailsFn: (name, sid) => ({ studentName: name, studentId: sid, dormitory: `KTX C${randomInt(1,7)}`, room: `P${randomInt(1,6)}${randomInt(1,9).toString().padStart(2,'0')}`, method: 'AUTO_ALLOCATION' }),
    },
    {
        action: 'room_changed',
        module: 'allocation',
        descFn: (name) => `Sinh viên ${name} yêu cầu đổi phòng`,
        detailsFn: (name, sid) => ({ studentName: name, studentId: sid, fromRoom: `P${randomInt(1,3)}0${randomInt(1,9)}`, toRoom: `P${randomInt(4,6)}0${randomInt(1,9)}` }),
    },
    {
        action: 'profile_updated',
        module: 'profile',
        descFn: (name) => `Sinh viên ${name} cập nhật thông tin cá nhân`,
        detailsFn: (name, sid) => ({ studentName: name, studentId: sid, fields: randomChoice(['email', 'phone', 'address', 'faculty']) }),
    },
    {
        action: 'application_approved',
        module: 'application',
        descFn: (name) => `Đơn đăng ký phòng của sinh viên ${name} được duyệt bởi quản trị viên`,
        detailsFn: (name, sid) => ({ studentName: name, studentId: sid, approvedBy: 'Admin', dormitory: `KTX C${randomInt(1,7)}` }),
    },
    {
        action: 'application_rejected',
        module: 'application',
        descFn: (name) => `Đơn đăng ký phòng của sinh viên ${name} bị từ chối`,
        detailsFn: (name, sid) => ({ studentName: name, studentId: sid, reason: randomChoice(['Không đủ điều kiện', 'Hết phòng', 'Hồ sơ không hợp lệ']) }),
    },
    {
        action: 'password_changed',
        module: 'auth',
        descFn: (name) => `Sinh viên ${name} đổi mật khẩu tài khoản`,
        detailsFn: (name, sid) => ({ studentName: name, studentId: sid }),
    },
    {
        action: 'registration_approved',
        module: 'registration',
        descFn: (name) => `Đăng ký KTX của sinh viên ${name} được xác nhận`,
        detailsFn: (name, sid) => ({ studentName: name, studentId: sid }),
    },
    {
        action: 'registration_rejected',
        module: 'registration',
        descFn: (name) => `Đăng ký KTX của sinh viên ${name} bị từ chối`,
        detailsFn: (name, sid) => ({ studentName: name, studentId: sid, reason: 'Không đáp ứng tiêu chí ưu tiên' }),
    },
    {
        action: 'payment_success',
        module: 'payment',
        descFn: (name) => `Sinh viên ${name} thanh toán tiền phòng thành công`,
        detailsFn: (name, sid) => ({ studentName: name, studentId: sid, amount: randomInt(500000, 2000000), month: `${randomInt(1,12)}/2026` }),
    },
    {
        action: 'payment_failed',
        module: 'payment',
        descFn: (name) => `Thanh toán tiền phòng của sinh viên ${name} thất bại`,
        detailsFn: (name, sid) => ({ studentName: name, studentId: sid, reason: 'Lỗi cổng thanh toán' }),
    },
];

// Weighted selection: login/logout more frequent
const ACTION_WEIGHTS = [20, 15, 15, 5, 10, 8, 10, 8, 6, 5, 5, 4, 6, 3];

function weightedRandomAction() {
    const total = ACTION_WEIGHTS.reduce((a,b) => a+b, 0);
    let r = randomInt(0, total - 1);
    for (let i = 0; i < ACTION_WEIGHTS.length; i++) {
        r -= ACTION_WEIGHTS[i];
        if (r < 0) return ACTION_CONFIGS[i];
    }
    return ACTION_CONFIGS[0];
}

async function seed() {
    try {
        console.log('Connecting to MongoDB...');

        // Wait for connection
        await new Promise((resolve, reject) => {
            if (mongoose.connection.readyState === 1) return resolve();
            mongoose.connection.once('connected', resolve);
            mongoose.connection.once('error', reject);
            setTimeout(resolve, 5000); // fallback
        });

        // Delete logs with empty/N/A data
        const deleteResult = await ActivityLogCollection.deleteMany({
            $or: [
                { description: { $in: ['N/A', '', null] } },
                { description: /^Không có chi tiết/i },
            ]
        });
        console.log(`Deleted ${deleteResult.deletedCount} stale/empty log entries`);

        // Fetch some real student IDs to use as userId
        const students = await StudentCollection.find({ role: 'user' }, '_id studentId').limit(50).lean();

        const TOTAL = 220;
        const logs = [];

        for (let i = 0; i < TOTAL; i++) {
            const name = randomName();
            const student = students.length ? randomChoice(students) : null;
            const userId = student ? student._id : new mongoose.Types.ObjectId();
            const sid = student ? (student.studentId || `2023${randomInt(10000,99999)}`) : `2023${randomInt(10000,99999)}`;
            const actionConfig = weightedRandomAction();
            const isError = Math.random() < 0.1;
            const timestamp = randomDateInLastDays(60);

            logs.push({
                userId,
                action: actionConfig.action,
                description: actionConfig.descFn(name),
                details: {
                    ...actionConfig.detailsFn(name, sid, randomIP()),
                    status: isError ? 'error' : 'success',
                    ip: randomIP(),
                    userAgent: randomUA(),
                    module: actionConfig.module,
                    timestamp: timestamp.toISOString(),
                },
                createdAt: timestamp,
            });
        }

        const result = await ActivityLogCollection.insertMany(logs, { ordered: false });
        console.log(`Inserted ${result.length} activity log entries.`);
        console.log('Done.');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding activity logs:', err);
        process.exit(1);
    }
}

seed();
