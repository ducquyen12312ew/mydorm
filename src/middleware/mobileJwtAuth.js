const { verifyMobileAccessToken } = require('../auth/mobileTokenService');

function requireMobileJwt(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, error: 'Missing mobile access token' });
  }

  try {
    const payload = verifyMobileAccessToken(token);
    req.mobileAuth = {
      userId: payload.sub,
      role: payload.role
    };
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired access token' });
  }
}

module.exports = {
  requireMobileJwt
};
