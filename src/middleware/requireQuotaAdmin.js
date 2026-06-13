function deny(req, res, message, statusCode = 403) {
  if (req.path.startsWith('/admin/')) {
    if (statusCode === 401) {
      return res.redirect('/login');
    }
    return res.status(statusCode).send(message || 'Forbidden');
  }
  return res.status(statusCode).json({ success: false, error: message || 'Forbidden' });
}

async function requireQuotaViewer(req, res, next) {
  if (!req.session || !req.session.userId) {
    return deny(req, res, 'Unauthorized', 401);
  }
  if (req.session.role !== 'admin') {
    return deny(req, res, 'Admin only', 403);
  }
  return next();
}

async function requireQuotaAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return deny(req, res, 'Unauthorized', 401);
  }
  if (req.session.role !== 'admin') {
    return deny(req, res, 'Admin only', 403);
  }
  if (!req.session.isSuperAdmin) {
    return deny(req, res, 'Chỉ Giám đốc Ký túc xá mới có thể thực hiện thao tác này', 403);
  }
  return next();
}

module.exports = {
  requireQuotaViewer,
  requireQuotaAdmin
};
