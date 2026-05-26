const nodemailer = require('nodemailer');
const { logger } = require('../config/logger');

/**
 * Email Sender Utility
 * Sử dụng Gmail SMTP
 */

const transporter = nodemailer.createTransport({
    service: process.env.SMTP_SERVICE || 'gmail',
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,  // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    }
});

/**
 * Send email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML content
 * @param {object} options - Additional options
 * @returns {Promise}
 */
const sendEmail = async (to, subject, html, options = {}) => {
    try {
        // Development mode: log only
        if (process.env.NODE_ENV === 'development' && process.env.SKIP_EMAIL === 'true') {
            logger.info('EMAIL (DEV MODE - SKIPPED)', {
                to: to,
                subject: subject,
                preview: html.substring(0, 100)
            });
            return { success: true, testMode: true };
        }

        // Validate email
        if (!to || !to.includes('@')) {
            throw new Error('Invalid email address: ' + to);
        }

        const mailOptions = {
            from: process.env.SMTP_FROM || process.env.SMTP_FROM_EMAIL,
            to: to,
            subject: subject,
            html: html,
            replyTo: process.env.SMTP_REPLY_TO || process.env.SMTP_FROM_EMAIL,
            ...options  // Allow overrides (cc, bcc, attachments, etc)
        };

        const info = await transporter.sendMail(mailOptions);

        logger.info('EMAIL_SENT_SUCCESS', {
            to: to,
            subject: subject,
            messageId: info.messageId,
            response: info.response
        });

        return {
            success: true,
            messageId: info.messageId,
            message: 'Email sent successfully'
        };
    } catch (error) {
        logger.error('EMAIL_SEND_FAILED', {
            to: to,
            subject: subject,
            error: error.message,
            stack: error.stack
        });

        throw {
            success: false,
            error: error.message,
            code: 'EMAIL_SEND_ERROR'
        };
    }
};

/**
 * Send email with template
 */
const sendEmailWithTemplate = async (to, subject, templateName, data = {}) => {
    try {
        // Simple template rendering - can be enhanced with template engine
        let html = templateName;

        // Replace placeholders
        Object.keys(data).forEach(key => {
            const placeholder = `{{${key}}}`;
            html = html.replace(new RegExp(placeholder, 'g'), data[key]);
        });

        return await sendEmail(to, subject, html);
    } catch (error) {
        logger.error('TEMPLATE_EMAIL_FAILED', {
            to: to,
            template: templateName,
            error: error.message
        });
        throw error;
    }
};

/**
 * Test email configuration
 */
const testEmailConfig = async () => {
    try {
        await transporter.verify();
        logger.info('EMAIL_CONFIG_VERIFIED', {
            service: process.env.SMTP_SERVICE,
            user: process.env.SMTP_USER
        });
        return {
            success: true,
            message: 'Email configuration is valid',
            service: process.env.SMTP_SERVICE,
            user: process.env.SMTP_USER
        };
    } catch (error) {
        logger.error('EMAIL_CONFIG_INVALID', {
            error: error.message
        });
        throw {
            success: false,
            error: error.message,
            code: 'EMAIL_CONFIG_ERROR'
        };
    }
};

/**
 * Send OTP email
 */
const sendOTPEmail = async (to, otp, expirationMinutes = 10) => {
    const html = `
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
                <div class="header">
                    <h2>Mã Xác Minh OTP</h2>
                </div>
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

                    <div class="footer">
                        <p>© 2026 Hệ thống Ký Túc Xá. Tất cả quyền được bảo lưu.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendEmail(to, '🔐 Mã Xác Minh OTP', html);
};

/**
 * Send 2FA enabled confirmation
 */
const send2FAEnabledEmail = async (to, method = 'TOTP') => {
    const methodLabel = {
        'TOTP': 'Google Authenticator',
        'SMS': 'SMS OTP',
        'EMAIL': 'Email OTP'
    }[method] || method;

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; }
                .container { max-width: 600px; margin: 0 auto; }
                .header { background: #28a745; color: white; padding: 20px; text-align: center; }
                .content { padding: 30px; background: #f9f9f9; }
                .info-box { background: white; border: 1px solid #28a745; padding: 20px; margin: 20px 0; }
                .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>✓ Xác Thực 2 Yếu Tố Đã Bật</h2>
                </div>
                <div class="content">
                    <p>Tài khoản của bạn hiện đang được bảo vệ bằng xác thực 2 yếu tố.</p>
                    
                    <div class="info-box">
                        <p><strong>Phương pháp xác thực:</strong> ${methodLabel}</p>
                        <p style="color: #666; font-size: 14px;">
                            Bạn sẽ cần nhập mã xác minh mỗi khi đăng nhập. Điều này giúp bảo vệ tài khoản của bạn.
                        </p>
                    </div>

                    <p style="color: #666;">Nếu bạn không thực hiện thay đổi này, vui lòng liên hệ hỗ trợ ngay.</p>

                    <div class="footer">
                        <p>© 2026 Hệ thống Ký Túc Xá. Tất cả quyền được bảo lưu.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendEmail(to, '🔒 Xác Thực 2 Yếu Tố Đã Bật', html);
};

module.exports = {
    sendEmail,
    sendEmailWithTemplate,
    testEmailConfig,
    sendOTPEmail,
    send2FAEnabledEmail,
    transporter
};
