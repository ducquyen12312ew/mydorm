const { logger } = require('../config/logger');

const isSimulationAdmin = (req, res, next) => {
  const isAdmin = req.session && req.session.role === 'admin';
  const isTestAccount = req.session && req.session.username === 'admintest';

  if (isAdmin && isTestAccount) {
    return next();
  }

  logger.warn('isSimulationAdmin access denied', {
    userId: req.session?.userId,
    username: req.session?.username,
    path: req.path
  });

  if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(403).json({
      success: false,
      error: 'Chức năng này chỉ dành cho tài khoản admintest'
    });
  }

  res.redirect('/admin/dashboard');
};

module.exports = { isSimulationAdmin };
