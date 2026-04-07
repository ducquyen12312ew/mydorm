const { StudentCollection } = require('../config/config');

const QUOTA_MANAGERS = new Set(['admin1']);

function deny(req, res, message, statusCode = 403) {
  if (req.path.startsWith('/admin/')) {
    if (statusCode === 401) {
      return res.redirect('/login');
    }
    return res.status(statusCode).send(message || 'Forbidden');
  }

  return res.status(statusCode).json({ success: false, error: message || 'Forbidden' });
}

async function resolveQuotaAccess(req) {
  if (!req.session || !req.session.userId) {
    return { error: { code: 401, message: 'Unauthorized' } };
  }

  if (req.session.role !== 'admin') {
    return { error: { code: 403, message: 'Admin only' } };
  }

  if (req.quotaAccess) {
    return { access: req.quotaAccess };
  }

  let username = req.session.username || null;
  if (!username) {
    const actor = await StudentCollection.findById(req.session.userId)
      .select({ username: 1 })
      .lean();
    username = actor?.username || null;
  }

  const access = {
    username,
    canManage: QUOTA_MANAGERS.has(String(username || '').toLowerCase())
  };

  req.quotaAccess = access;
  return { access };
}

async function requireQuotaViewer(req, res, next) {
  try {
    const resolved = await resolveQuotaAccess(req);
    if (resolved.error) {
      return deny(req, res, resolved.error.message, resolved.error.code);
    }
    return next();
  } catch (error) {
    return deny(req, res, error.message || 'Access check failed', 500);
  }
}

async function requireQuotaAdmin(req, res, next) {
  try {
    const resolved = await resolveQuotaAccess(req);
    if (resolved.error) {
      return deny(req, res, resolved.error.message, resolved.error.code);
    }

    if (!resolved.access.canManage) {
      return deny(req, res, 'Only admin1 can modify quota data', 403);
    }

    return next();
  } catch (error) {
    return deny(req, res, error.message || 'Access check failed', 500);
  }
}

module.exports = {
  requireQuotaViewer,
  requireQuotaAdmin
};