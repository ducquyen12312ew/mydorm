/**
 * mobileWebViewAuth.js
 *
 * Cho phép WebView của app mobile truy cập các trang web (EJS) dùng session.
 * App mobile xác thực bằng JWT; middleware này đọc JWT từ:
 *   - header `Authorization: Bearer <token>` (lần load đầu của WebView), hoặc
 *   - cookie `mobile_token` (WebView inject cho các request con)
 * rồi gán req.session.userId/role/name để các middleware web (isAuthenticated,
 * requireLogin, requireStudentAuth) hoạt động bình thường — KHÔNG sửa route nào.
 *
 * KHÔNG dùng cookie-parser (tránh thêm dependency): tự parse req.headers.cookie.
 */
const { verifyMobileAccessToken } = require('../auth/mobileTokenService');
const { StudentCollection } = require('../config/config');

function readMobileToken(req) {
  // 1) Authorization header
  const authz = req.headers && req.headers.authorization;
  if (authz) {
    const parts = String(authz).split(' ');
    if (parts[0] === 'Bearer' && parts[1]) return parts[1];
  }
  // 2) cookie mobile_token (parse thủ công)
  const rawCookie = req.headers && req.headers.cookie;
  if (rawCookie) {
    const match = String(rawCookie)
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('mobile_token='));
    if (match) return decodeURIComponent(match.slice('mobile_token='.length));
  }
  return null;
}

async function mobileWebViewAuth(req, res, next) {
  // Đã có session web hợp lệ → bỏ qua.
  if (req.session && req.session.userId) return next();

  const token = readMobileToken(req);
  if (!token) return next();

  try {
    const payload = verifyMobileAccessToken(token);
    if (!payload || !payload.sub) return next();

    const student = await StudentCollection.findById(payload.sub)
      .select('role studentId name email')
      .lean();

    req.session = req.session || {};
    req.session.userId = String(payload.sub);
    if (student) {
      req.session.role = student.role || 'user';
      req.session.studentId = student.studentId;
      req.session.name = student.name; // trang student/home dùng req.session.name
    }
  } catch (_) {
    // Token không hợp lệ — tiếp tục như chưa đăng nhập.
  }

  return next();
}

module.exports = { mobileWebViewAuth };
