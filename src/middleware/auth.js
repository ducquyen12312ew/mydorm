const { logger } = require('../config/logger');

const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    res.redirect('/login');
};

const isAdmin = (req, res, next) => {
    logger.info('isAdmin middleware session check', {
        hasSession: !!req.session,
        role: req.session?.role,
        userId: req.session?.userId,
        path: req.path
    });

    if (req.session && req.session.role === 'admin') {
        return next();
    }

    logger.warn('isAdmin access denied, redirecting to login', { path: req.path });
    res.redirect('/login');
};

module.exports = { isAuthenticated, isAdmin };
