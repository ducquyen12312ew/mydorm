const { NotificationCollection, ActivityLogCollection } = require('../config/config');
const { logger } = require('../config/logger');

async function createNotification(data) {
    try {
        const notification = new NotificationCollection(data);
        await notification.save();
        return notification;
    } catch (error) {
        logger.error('Error creating notification', { error: error.message });
        return null;
    }
}

async function createActivityLog(userId, action, description, details = {}) {
    try {
        const log = new ActivityLogCollection({ userId, action, description, details });
        await log.save();
        return log;
    } catch (error) {
        logger.error('Error creating activity log', { error: error.message });
        return null;
    }
}

async function sendNotificationOnEvent(eventType, userId, details = {}) {
    try {
        let notificationData = { createdBy: userId };

        switch (eventType) {
            case 'welcome':
                notificationData = {
                    ...notificationData,
                    title: 'Chào mừng đến với hệ thống KTX HUST!',
                    message: `Xin chào ${details.name}! Tài khoản của bạn đã được tạo thành công. Hãy khám phá các tính năng của hệ thống.`,
                    type: 'success',
                    targetUsers: [userId],
                    priority: 'normal'
                };
                await createActivityLog(userId, 'register_success', 'Tạo tài khoản thành công', details);
                break;

            case 'registration_approved':
                notificationData = {
                    ...notificationData,
                    title: 'Đơn đăng ký ký túc xá đã được duyệt!',
                    message: `Đơn đăng ký phòng ${details.roomNumber} tại ${details.dormitoryName} của bạn đã được admin phê duyệt. Vui lòng kiểm tra thông tin chi tiết trong hồ sơ cá nhân.`,
                    type: 'success',
                    targetUsers: [userId],
                    priority: 'high'
                };
                await createActivityLog(userId, 'registration_approved', 'Đơn đăng ký được duyệt', details);
                break;

            case 'registration_rejected':
                notificationData = {
                    ...notificationData,
                    title: 'Đơn đăng ký ký túc xá bị từ chối',
                    message: `Đơn đăng ký phòng ${details.roomNumber} của bạn đã bị từ chối. Lý do: ${details.reason}. Bạn có thể đăng ký lại phòng khác hoặc liên hệ ban quản lý để biết thêm chi tiết.`,
                    type: 'error',
                    targetUsers: [userId],
                    priority: 'high'
                };
                await createActivityLog(userId, 'registration_rejected', 'Đơn đăng ký bị từ chối', details);
                break;

            case 'registration_success':
                notificationData = {
                    ...notificationData,
                    title: 'Đăng ký ký túc xá thành công',
                    message: `Bạn đã đăng ký ký túc xá thành công. Phòng: ${details.roomNumber || 'Chưa xác định'}, ${details.dormitoryName || ''}`,
                    type: 'success',
                    targetUsers: [userId],
                    priority: 'high'
                };
                await createActivityLog(userId, 'register_success', 'Đăng ký ký túc xá thành công', details);
                break;

            case 'registration_failed':
                notificationData = {
                    ...notificationData,
                    title: 'Đăng ký ký túc xá thất bại',
                    message: `Đăng ký không thành công. Lý do: ${details.reason || 'Không xác định'}${details.roomNumber ? `. Phòng: ${details.roomNumber}` : ''}`,
                    type: 'error',
                    targetUsers: [userId],
                    priority: 'high'
                };
                await createActivityLog(userId, 'register_failed', 'Đăng ký ký túc xá thất bại', details);
                break;

            case 'payment_success':
                notificationData = {
                    ...notificationData,
                    title: 'Thanh toán thành công',
                    message: `Thanh toán ${details.type || 'phí'} đã được xử lý thành công. Số tiền: ${details.amount || '0'} VND${details.transactionId ? `. Mã GD: ${details.transactionId}` : ''}`,
                    type: 'success',
                    targetUsers: [userId],
                    priority: 'normal'
                };
                await createActivityLog(userId, 'payment_success', 'Thanh toán thành công', details);
                break;

            case 'payment_failed':
                notificationData = {
                    ...notificationData,
                    title: 'Thanh toán thất bại',
                    message: `Giao dịch thanh toán không thành công${details.reason ? `. Lý do: ${details.reason}` : ''}. Vui lòng thử lại sau.`,
                    type: 'error',
                    targetUsers: [userId],
                    priority: 'high'
                };
                await createActivityLog(userId, 'payment_failed', 'Thanh toán thất bại', details);
                break;

            case 'room_assigned':
                notificationData = {
                    ...notificationData,
                    title: 'Phân phòng thành công',
                    message: `Bạn đã được phân phòng ${details.roomNumber}${details.dormitoryName ? ` tại ${details.dormitoryName}` : ''}. Vui lòng xem thông tin chi tiết.`,
                    type: 'info',
                    targetUsers: [userId],
                    priority: 'high'
                };
                await createActivityLog(userId, 'room_assigned', 'Được phân phòng', details);
                break;

            case 'room_changed':
                notificationData = {
                    ...notificationData,
                    title: 'Chuyển phòng thành công',
                    message: `Bạn đã được chuyển từ phòng ${details.oldRoom} sang phòng ${details.newRoom}. Vui lòng cập nhật thông tin cá nhân.`,
                    type: 'info',
                    targetUsers: [userId],
                    priority: 'high'
                };
                await createActivityLog(userId, 'room_changed', 'Chuyển phòng', details);
                break;

            case 'profile_updated':
                notificationData = {
                    ...notificationData,
                    title: 'Cập nhật thông tin thành công',
                    message: 'Thông tin cá nhân của bạn đã được cập nhật thành công.',
                    type: 'success',
                    targetUsers: [userId],
                    priority: 'low'
                };
                await createActivityLog(userId, 'profile_updated', 'Cập nhật thông tin cá nhân', details);
                break;

            case 'password_changed':
                notificationData = {
                    ...notificationData,
                    title: 'Thay đổi mật khẩu thành công',
                    message: `Mật khẩu của bạn đã được thay đổi thành công vào lúc ${new Date().toLocaleString('vi-VN')}.`,
                    type: 'info',
                    targetUsers: [userId],
                    priority: 'normal'
                };
                await createActivityLog(userId, 'password_changed', 'Thay đổi mật khẩu', details);
                break;

            case 'maintenance_notice':
                notificationData = {
                    ...notificationData,
                    title: 'Thông báo bảo trì hệ thống',
                    message: details.message || 'Hệ thống sẽ được bảo trì trong thời gian tới. Vui lòng theo dõi thông báo.',
                    type: 'warning',
                    isGlobal: true,
                    targetRole: 'all',
                    priority: 'normal'
                };
                break;

            case 'announcement':
                notificationData = {
                    ...notificationData,
                    title: details.title || 'Thông báo từ Ban Quản lý',
                    message: details.message,
                    type: details.type || 'info',
                    isGlobal: true,
                    targetRole: details.targetRole || 'all',
                    priority: details.priority || 'normal'
                };
                break;

            case 'reminder':
                notificationData = {
                    ...notificationData,
                    title: details.title || 'Nhắc nhở',
                    message: details.message,
                    type: 'warning',
                    targetUsers: [userId],
                    priority: 'normal'
                };
                break;

            default:
                logger.warn(`Unknown notification event type: ${eventType}`);
                return null;
        }

        return await createNotification(notificationData);
    } catch (error) {
        logger.error('Error sending notification', { error: error.message });
        return null;
    }
}

module.exports = { sendNotificationOnEvent, createActivityLog, createNotification };
