const Notification = require('../schemas/NotificationSchema');
const { ActivityLogCollection } = require('../config/config');
const { logger } = require('../config/logger');

async function createNotification(userId, type, title, message, options = {}) {
    try {
        const notification = new Notification({
            userId,
            type,
            title,
            message,
            priority: options.priority || 'normal',
            actionUrl: options.actionUrl || null,
            data: options.data || null,
            channels: {
                inApp: { sent: true, sentAt: new Date() }
            }
        });
        await notification.save();
        return notification;
    } catch (error) {
        logger.error('Error creating notification', { error: error.message, userId, type, title });
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

// Map event type → { notifType, title, message(details) }
async function sendNotificationOnEvent(eventType, userId, details = {}) {
    try {
        let type = 'system';
        let title = '';
        let message = '';
        let priority = 'normal';

        switch (eventType) {
            case 'welcome':
                type = 'system';
                title = 'Chào mừng đến với hệ thống KTX HUST!';
                message = `Xin chào ${details.name || ''}! Tài khoản của bạn đã được tạo thành công.`;
                priority = 'normal';
                await createActivityLog(userId, 'register_success', 'Tạo tài khoản thành công', details);
                break;

            case 'registration_approved':
                type = 'application';
                title = 'Đơn đăng ký KTX đã được phê duyệt';
                message = details.dormitoryName
                    ? `Đơn đăng ký phòng ${details.roomNumber || ''} tại ${details.dormitoryName} của bạn đã được ban quản lý phê duyệt.`
                    : `Đơn đăng ký KTX của bạn đã được phê duyệt. Kiểm tra thông tin phòng tại trang Trạng thái phòng.`;
                priority = 'high';
                await createActivityLog(userId, 'registration_approved', 'Đơn đăng ký được duyệt', details);
                break;

            case 'registration_rejected':
                type = 'application';
                title = 'Đơn đăng ký KTX bị từ chối';
                message = `Đơn đăng ký của bạn đã bị từ chối. Lý do: ${details.reason || 'Không đáp ứng điều kiện'}. Bạn có thể đăng ký lại trong đợt tiếp theo.`;
                priority = 'high';
                await createActivityLog(userId, 'registration_rejected', 'Đơn đăng ký bị từ chối', details);
                break;

            case 'registration_success':
                type = 'application';
                title = 'Đăng ký KTX thành công';
                message = `Đơn đăng ký của bạn đã được ghi nhận. Kết quả sẽ được thông báo sau khi ban quản lý xét duyệt.`;
                priority = 'normal';
                await createActivityLog(userId, 'register_success', 'Đăng ký KTX thành công', details);
                break;

            case 'registration_failed':
                type = 'alert';
                title = 'Đăng ký KTX thất bại';
                message = `Đăng ký không thành công. Lý do: ${details.reason || 'Không xác định'}.`;
                priority = 'high';
                await createActivityLog(userId, 'register_failed', 'Đăng ký KTX thất bại', details);
                break;

            case 'room_assigned':
                type = 'room_assigned';
                title = 'Bạn đã được phân phòng';
                message = `Bạn đã được phân vào phòng ${details.roomNumber || ''}${details.dormitoryName ? ' - ' + details.dormitoryName : ''}. Xem chi tiết tại trang Trạng thái phòng.`;
                priority = 'high';
                await createActivityLog(userId, 'room_assigned', 'Được phân phòng', details);
                break;

            case 'room_changed':
                type = 'room_assigned';
                title = 'Bạn đã được chuyển phòng';
                message = `Bạn đã được chuyển từ phòng ${details.oldRoom || ''} sang phòng ${details.newRoom || ''}. Xem chi tiết tại trang Trạng thái phòng.`;
                priority = 'high';
                await createActivityLog(userId, 'room_changed', 'Chuyển phòng', details);
                break;

            case 'allocation_result':
                type = 'allocation';
                title = 'Kết quả phân bổ phòng';
                message = details.message || `Kết quả phân bổ phòng chu kỳ ${details.academicYear || ''} đã được công bố. Kiểm tra tại trang Trạng thái phòng.`;
                priority = 'high';
                break;

            case 'waitlist_promoted':
                type = 'allocation';
                title = 'Bạn đã được phân phòng từ danh sách chờ';
                message = `Bạn đã được phân vào phòng ${details.roomNumber || ''}${details.dormitoryName ? ' - ' + details.dormitoryName : ''} từ danh sách chờ.`;
                priority = 'high';
                break;

            case 'profile_updated':
                type = 'system';
                title = 'Cập nhật thông tin thành công';
                message = 'Thông tin cá nhân của bạn đã được cập nhật thành công.';
                priority = 'low';
                await createActivityLog(userId, 'profile_updated', 'Cập nhật thông tin cá nhân', details);
                break;

            case 'password_changed':
                type = 'system';
                title = 'Thay đổi mật khẩu thành công';
                message = `Mật khẩu tài khoản của bạn đã được thay đổi thành công.`;
                priority = 'normal';
                await createActivityLog(userId, 'password_changed', 'Thay đổi mật khẩu', details);
                break;

            case 'maintenance_notice':
                type = 'maintenance';
                title = details.title || 'Thông báo bảo trì';
                message = details.message || 'Hệ thống sẽ tiến hành bảo trì. Vui lòng theo dõi thông báo.';
                priority = 'normal';
                break;

            case 'announcement':
                type = 'announcement';
                title = details.title || 'Thông báo từ Ban Quản lý';
                message = details.message || '';
                priority = details.priority || 'normal';
                break;

            case 'reminder':
                type = 'system';
                title = details.title || 'Nhắc nhở';
                message = details.message || '';
                priority = 'normal';
                break;

            default:
                logger.warn(`Unknown notification event type: ${eventType}`);
                return null;
        }

        return await createNotification(userId, type, title, message, { priority, data: details });
    } catch (error) {
        logger.error('Error sending notification', { error: error.message, eventType, userId });
        return null;
    }
}

// Send broadcast notification to multiple users
async function sendBroadcastNotification(userIds, type, title, message, options = {}) {
    try {
        const notifications = userIds.map(uid => ({
            userId: uid,
            type,
            title,
            message,
            priority: options.priority || 'normal',
            actionUrl: options.actionUrl || null,
            data: options.data || null,
            channels: { inApp: { sent: true, sentAt: new Date() } }
        }));
        const result = await Notification.insertMany(notifications, { ordered: false });
        return result;
    } catch (error) {
        logger.error('Error sending broadcast notification', { error: error.message });
        return null;
    }
}

module.exports = { sendNotificationOnEvent, createActivityLog, createNotification, sendBroadcastNotification };
