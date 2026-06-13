const nodemailer = require('nodemailer');
const { logger } = require('../config/logger');

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !smtpPass) {
        logger.warn('Email service not configured — SMTP_HOST/SMTP_USER/SMTP_PASS missing. Emails will be logged only.');
        return null;
    }

    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: smtpPass
        }
    });
    return transporter;
}

const FROM_NAME = 'KTX HUST';
const FROM_EMAIL = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@hust.edu.vn';

async function sendEmail({ to, subject, html }) {
    const tp = getTransporter();
    if (!tp) {
        logger.info('[EMAIL-DEV] Would send email', { to, subject });
        return { skipped: true };
    }
    try {
        const info = await tp.sendMail({ from: `"${FROM_NAME}" <${FROM_EMAIL}>`, to, subject, html });
        logger.info('Email sent', { to, subject, messageId: info.messageId });
        return info;
    } catch (err) {
        logger.error('Email send failed', { to, subject, error: err.message });
        throw err;
    }
}

// ============================================
// EMAIL TEMPLATES
// ============================================

function baseTemplate(content) {
    return `
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin:0; padding:0; font-family: 'Segoe UI', Arial, sans-serif; background:#f5f2ee; }
  .wrap { max-width:560px; margin:32px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
  .header { background:#C8102E; padding:28px 32px; text-align:center; }
  .header h1 { margin:0; color:#fff; font-size:1.5rem; font-weight:700; letter-spacing:-0.02em; }
  .header p { margin:4px 0 0; color:rgba(255,255,255,0.85); font-size:0.9rem; }
  .body { padding:32px; color:#201a17; }
  .body p { line-height:1.65; margin:0 0 16px; }
  .btn { display:inline-block; background:#C8102E; color:#fff!important; text-decoration:none; padding:13px 28px; border-radius:10px; font-weight:700; font-size:0.98rem; margin:8px 0 16px; }
  .footer { padding:20px 32px; background:#f9f7f4; border-top:1px solid #ede8e3; color:#8d817a; font-size:0.82rem; text-align:center; }
  .code { font-size:2.2rem; font-weight:800; letter-spacing:0.1em; color:#C8102E; text-align:center; padding:20px; background:#fff5f5; border-radius:12px; margin:16px 0; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>KTX HUST</h1>
    <p>Hệ thống Quản lý Ký túc xá — Đại học Bách Khoa Hà Nội</p>
  </div>
  <div class="body">${content}</div>
  <div class="footer">Email tự động từ hệ thống KTX HUST. Vui lòng không trả lời email này.</div>
</div>
</body>
</html>`;
}

async function sendVerificationEmail(to, name, token) {
    const appUrl = process.env.APP_URL || 'http://localhost:5000';
    const link = `${appUrl}/auth/verify-email?token=${token}`;
    const html = baseTemplate(`
        <p>Xin chào <strong>${name}</strong>,</p>
        <p>Bạn vừa đăng ký tài khoản tại hệ thống Ký túc xá HUST. Nhấn nút bên dưới để xác nhận địa chỉ email của bạn:</p>
        <p style="text-align:center"><a class="btn" href="${link}">Xác nhận Email</a></p>
        <p>Hoặc copy đường dẫn này vào trình duyệt:</p>
        <p style="word-break:break-all; font-size:0.85rem; color:#736660">${link}</p>
        <p>Liên kết có hiệu lực trong <strong>24 giờ</strong>. Nếu bạn không thực hiện đăng ký này, hãy bỏ qua email.</p>
    `);
    return sendEmail({ to, subject: 'Xác nhận email tài khoản KTX HUST', html });
}

async function sendWelcomeEmail(to, name) {
    const html = baseTemplate(`
        <p>Xin chào <strong>${name}</strong>,</p>
        <p>Chào mừng bạn đến với hệ thống Quản lý Ký túc xá Đại học Bách Khoa Hà Nội!</p>
        <p>Tài khoản của bạn đã được kích hoạt thành công. Bạn có thể đăng nhập và bắt đầu đăng ký ký túc xá ngay bây giờ.</p>
        <p style="text-align:center"><a class="btn" href="${process.env.APP_URL || 'http://localhost:5000'}/login">Đăng nhập ngay</a></p>
        <p>Chúc bạn một năm học thành công!</p>
    `);
    return sendEmail({ to, subject: 'Chào mừng đến KTX HUST!', html });
}

async function sendPasswordResetEmail(to, name, token) {
    const appUrl = process.env.APP_URL || 'http://localhost:5000';
    const link = `${appUrl}/reset-password?token=${token}`;
    const html = baseTemplate(`
        <p>Xin chào <strong>${name}</strong>,</p>
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Nhấn nút bên dưới để tiến hành:</p>
        <p style="text-align:center"><a class="btn" href="${link}">Đặt lại mật khẩu</a></p>
        <p>Liên kết có hiệu lực trong <strong>1 giờ</strong>. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
    `);
    return sendEmail({ to, subject: 'Đặt lại mật khẩu KTX HUST', html });
}

module.exports = { sendEmail, sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail };
