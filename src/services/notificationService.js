const nodemailer = require('nodemailer');
const twilio = require('twilio');
const { logger } = require('../config/logger');
const { sendEmail, sendOTPEmail, send2FAEnabledEmail } = require('../utils/sendEmail');

/**
 * Email/SMS Notification Service
 */
class NotificationService {
    constructor() {
        // Email configuration
        this.emailTransporter = nodemailer.createTransport({
            service: process.env.SMTP_SERVICE || 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            },
            from: process.env.SMTP_FROM_EMAIL || 'noreply@dormitory.edu.vn'
        });

        // SMS configuration (Twilio) - Lazy initialization
        this.twilioClient = null;
        this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
        this.twilioConfigured = false;

        // Test configurations
        if (process.env.NODE_ENV === 'development') {
            this.testMode = true;
        }
    }

    /**
     * Initialize Twilio (lazy loading)
     */
    initializeTwilio() {
        if (this.twilioClient || this.twilioConfigured) {
            return;
        }

        try {
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;

            // Validate Twilio credentials
            if (!accountSid || !authToken || 
                accountSid === 'your_account_sid' || 
                authToken === 'your_auth_token') {
                logger.warn('Twilio not configured - SMS disabled');
                this.twilioConfigured = false;
                return;
            }

            this.twilioClient = twilio(accountSid, authToken);
            this.twilioConfigured = true;
            logger.info('Twilio initialized successfully');
        } catch (error) {
            logger.error('Twilio initialization failed', { error: error.message });
            this.twilioConfigured = false;
        }
    }

    /**
     * Send email
     */
    async sendEmail(to, subject, htmlContent, textContent = '') {
        try {
            if (this.testMode) {
                logger.info('EMAIL (TEST MODE)', { to, subject });
                return { success: true, messageId: 'test-' + Date.now(), testMode: true };
            }

            const info = await this.emailTransporter.sendMail({
                to: to,
                subject: subject,
                html: htmlContent,
                text: textContent || subject,
                replyTo: process.env.SMTP_REPLY_TO || process.env.SMTP_FROM_EMAIL
            });

            logger.info('EMAIL_SENT', {
                to: to,
                subject: subject,
                messageId: info.messageId
            });

            return { success: true, messageId: info.messageId };
        } catch (error) {
            logger.error('EMAIL_SEND_FAILED', {
                to: to,
                subject: subject,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Send SMS
     */
    async sendSMS(to, message) {
        try {
            if (this.testMode) {
                logger.info('SMS (TEST MODE)', { to, message });
                return { success: true, sid: 'test-' + Date.now(), testMode: true };
            }

            // Initialize Twilio if not already done
            this.initializeTwilio();

            if (!this.twilioClient || !this.twilioConfigured || !this.twilioPhoneNumber) {
                throw new Error('Twilio not configured properly');
            }

            const result = await this.twilioClient.messages.create({
                body: message,
                from: this.twilioPhoneNumber,
                to: to
            });

            logger.info('SMS_SENT', {
                to: to,
                sid: result.sid
            });

            return { success: true, sid: result.sid };
        } catch (error) {
            logger.error('SMS_SEND_FAILED', {
                to: to,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Send OTP email
     */
    async sendOTPEmail(to, otp, expirationMinutes = 10) {
        try {
            return await sendEmail(to, `🔐 Mã Xác Minh OTP - ${otp}`, `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; }
                        .container { max-width: 600px; margin: 0 auto; }
                        .header { background: #667eea; color: white; padding: 20px; text-align: center; }
                        .content { padding: 30px; background: #f9f9f9; }
                        .otp-box { background: white; border: 2px solid #667eea; padding: 20px; text-align: center; margin: 20px 0; }
                        .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; font-family: 'Courier New'; }
                        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header"><h2>Mã Xác Minh OTP</h2></div>
                        <div class="content">
                            <p>Xin chào,</p>
                            <p>Bạn đã yêu cầu xác minh tài khoản. Vui lòng sử dụng mã OTP dưới đây:</p>
                            <div class="otp-box">
                                <div class="otp-code">${otp}</div>
                                <p style="color: #666; margin: 10px 0;">Hết hạn trong: <strong>${expirationMinutes} phút</strong></p>
                            </div>
                            <div class="warning">
                                <strong>⚠️ Cảnh báo bảo mật:</strong><br>
                                Không bao giờ chia sẻ mã OTP này với bất kỳ ai.
                            </div>
                            <p>Nếu bạn không yêu cầu xác minh này, vui lòng bỏ qua email này.</p>
                            <div class="footer"><p>© 2026 Hệ thống Ký Túc Xá.</p></div>
                        </div>
                    </div>
                </body>
                </html>
            `);
        } catch (error) {
            logger.error('OTP_EMAIL_SEND_FAILED', { to, error: error.message });
            throw error;
        }
    }

    /**
     * Send OTP SMS
     */
    async sendOTPSMS(phone, otp, expirationMinutes = 10) {
        const message = `Mã xác minh của bạn là: ${otp}. Mã này sẽ hết hạn trong ${expirationMinutes} phút.`;
        return this.sendSMS(phone, message);
    }

    /**
     * Send 2FA enabled notification
     */
    async send2FAEnabledNotification(email, method) {
        const methodLabel = this.getMethodLabel(method);
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #28a745;">✓ Xác thực 2 yếu tố đã bật</h2>
                <p>Tài khoản của bạn hiện đang được bảo vệ bằng xác thực 2 yếu tố.</p>
                <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Phương pháp xác thực:</strong> ${methodLabel}</p>
                </div>
                <p style="color: #666; font-size: 14px;">
                    Bạn sẽ cần nhập mã xác minh mỗi khi đăng nhập.
                </p>
            </div>
        `;

        return this.sendEmail(email, '🔒 Xác Thực 2 Yếu Tố Đã Bật', html);
    }

    /**
     * Send violation notification
     */
    async sendViolationNotification(email, violationData) {
        const subject = `Thông báo: Vi phạm nội quy ký túc xá`;
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #dc3545;">⚠️ Thông báo vi phạm nội quy</h2>
                <p>Bạn đã có một vi phạm nội quy ký túc xá.</p>
                <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Loại vi phạm:</strong> ${violationData.violationType || 'N/A'}</p>
                    <p><strong>Mô tả:</strong> ${violationData.description || 'N/A'}</p>
                    <p><strong>Ngày vi phạm:</strong> ${new Date(violationData.violationDate).toLocaleDateString('vi-VN')}</p>
                    ${violationData.fine ? `<p><strong>Phạt:</strong> ${violationData.fine.toLocaleString('vi-VN')} VND</p>` : ''}
                </div>
                <p style="color: #666; font-size: 14px;">
                    Để xem chi tiết, vui lòng đăng nhập vào tài khoản của bạn.
                </p>
            </div>
        `;

        return this.sendEmail(email, subject, html);
    }

    /**
     * Send maintenance notification
     */
    async sendMaintenanceNotification(email, maintenanceData) {
        const subject = `Thông báo: ${maintenanceData.status === 'completed' ? 'Sửa chữa hoàn thành' : 'Yêu cầu sửa chữa mới'}`;
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #007bff;">🔧 Thông báo bảo trì</h2>
                <p>Có cập nhật mới về yêu cầu bảo trì của bạn.</p>
                <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Loại sửa chữa:</strong> ${maintenanceData.type || 'N/A'}</p>
                    <p><strong>Mô tả:</strong> ${maintenanceData.description || 'N/A'}</p>
                    <p><strong>Trạng thái:</strong> ${maintenanceData.status || 'N/A'}</p>
                    ${maintenanceData.completedDate ? `<p><strong>Hoàn thành:</strong> ${new Date(maintenanceData.completedDate).toLocaleDateString('vi-VN')}</p>` : ''}
                </div>
            </div>
        `;

        return this.sendEmail(email, subject, html);
    }

    /**
     * Helper function to get method label
     */
    getMethodLabel(method) {
        const labels = {
            totp: 'Google Authenticator',
            smsOtp: 'SMS OTP',
            emailOtp: 'Email OTP'
        };
        return labels[method] || method;
    }

    /**
     * Test email configuration
     */
    async testEmailConfiguration() {
        try {
            await this.emailTransporter.verify();
            logger.info('Email configuration verified successfully');
            return { success: true, message: 'Email configuration is valid' };
        } catch (error) {
            logger.error('Email configuration verification failed', { error: error.message });
            throw error;
        }
    }
}

module.exports = new NotificationService();
